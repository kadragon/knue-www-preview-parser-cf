import { Env, ApiResponse, ResponseMetadata } from './types';
import { extractBearerToken, validateToken } from './auth';
import { parseDocument } from './parser';

// Trace:
//   spec_id: SPEC-API-001
//   task_id: TASK-API-ALIGN-001

const DEFAULT_CACHE_TTL_SECONDS = 86400;

interface CacheEntry {
  content: string;
  metadata: Omit<ResponseMetadata, 'cached'>;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const token = extractBearerToken(request);
    if (!validateToken(token, env.BEARER_TOKEN)) {
      return errorResponse('Unauthorized', 'Invalid or missing bearer token', 401);
    }

    const url = new URL(request.url);

    if (request.method === 'DELETE') {
      if (url.pathname !== '/cache') {
        return errorResponse('Not Found', 'Unsupported path for deletion', 404);
      }

      return handleCacheInvalidation(url, env);
    }

    if (request.method !== 'GET') {
      return errorResponse('Method Not Allowed', 'Unsupported HTTP method', 405);
    }

    const atchmnflNo = url.searchParams.get('atchmnflNo');

    if (!atchmnflNo) {
      return errorResponse('Bad Request', 'Missing required parameter: atchmnflNo', 400);
    }

    const effectiveTtl = resolveCacheTtl(env.CACHE_TTL_SECONDS);
    const cachingEnabled = effectiveTtl > 0;
    const cacheKey = buildCacheKey(atchmnflNo);

    if (cachingEnabled) {
      try {
        const cachedEntry = (await env.CACHE.get(cacheKey, 'json')) as unknown;
        if (isValidCacheEntry(cachedEntry)) {
          console.log(`[Cache] HIT ${cacheKey}`);
          const metadata: ResponseMetadata = {
            atchmnflNo: cachedEntry.metadata.atchmnflNo ?? atchmnflNo,
            title: cachedEntry.metadata.title,
            parsedAt: cachedEntry.metadata.parsedAt,
            cacheTtlSeconds:
              cachedEntry.metadata.cacheTtlSeconds ?? effectiveTtl,
            cached: true,
          };
          return successResponse(cachedEntry.content, metadata);
        }

        if (cachedEntry !== null) {
          console.warn(`[Cache] Invalid entry for ${cacheKey}, treating as miss.`);
        }

        console.log(`[Cache] MISS ${cacheKey}`);
      } catch (error) {
        logCacheError('read', cacheKey, error);
      }
    } else {
      console.log('[Cache] Disabled (TTL <= 0)');
    }

    try {
      const result = await withTimeout(
        parseDocument(atchmnflNo, env.BROWSER),
        30000,
        'Document parsing timeout'
      );

      const parsedAt = new Date().toISOString();
      const metadata: ResponseMetadata = {
        atchmnflNo,
        title: result.title,
        parsedAt,
        cached: false,
        cacheTtlSeconds: cachingEnabled ? effectiveTtl : 0,
      };

      if (cachingEnabled) {
        const cacheEntry: CacheEntry = {
          content: result.content,
          metadata: {
            atchmnflNo,
            title: result.title,
            parsedAt,
            cacheTtlSeconds: effectiveTtl,
          },
        };

        ctx.waitUntil(
          env.CACHE.put(cacheKey, JSON.stringify(cacheEntry), {
            expirationTtl: effectiveTtl,
          }).catch(error => {
            logCacheError('write', cacheKey, error);
          })
        );
      }

      return successResponse(result.content, metadata);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';

      console.error('Parse error:', errorMessage);
      console.error('Stack trace:', errorStack);

      if (errorMessage.includes('timeout')) {
        return errorResponse('Gateway Timeout', errorMessage, 504);
      }

      if (errorMessage.includes('Iframe not found')) {
        return errorResponse('Internal Server Error', 'Document viewer failed to load', 500);
      }

      return errorResponse('Internal Server Error', `Failed to parse document: ${errorMessage}`, 500);
    }
  },
};

function jsonResponse(data: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function errorResponse(error: string, message: string, status: number): Response {
  return jsonResponse({ success: false, error, message }, status);
}

function successResponse(
  content: string | null,
  metadata: ResponseMetadata
): Response {
  return jsonResponse({ success: true, content, metadata });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

function resolveCacheTtl(rawTtl?: string): number {
  if (!rawTtl) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  const parsed = Number.parseInt(rawTtl, 10);
  if (Number.isNaN(parsed)) {
    console.warn(
      `[Cache] Invalid CACHE_TTL_SECONDS value "${rawTtl}". Falling back to ${DEFAULT_CACHE_TTL_SECONDS} seconds.`
    );
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  if (parsed <= 0) {
    return 0;
  }

  return parsed;
}

function buildCacheKey(atchmnflNo: string): string {
  return `doc:${atchmnflNo}`;
}

async function handleCacheInvalidation(url: URL, env: Env): Promise<Response> {
  const atchmnflNo = url.searchParams.get('atchmnflNo');

  if (!atchmnflNo) {
    return errorResponse('Bad Request', 'Missing required parameter: atchmnflNo', 400);
  }

  const cacheKey = buildCacheKey(atchmnflNo);
  try {
    await env.CACHE.delete(cacheKey);
    console.log(`[Cache] DELETE ${cacheKey}`);
  } catch (error) {
    logCacheError('delete', cacheKey, error);
    return errorResponse('Internal Server Error', 'Failed to invalidate cache entry', 500);
  }

  const metadata: ResponseMetadata = {
    atchmnflNo,
    cached: false,
    cacheTtlSeconds: resolveCacheTtl(env.CACHE_TTL_SECONDS),
  };

  return successResponse(null, metadata);
}

function logCacheError(operation: 'read' | 'write' | 'delete', key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[Cache] ${operation.toUpperCase()} failed for ${key}: ${message}`);
  if (stack) {
    console.error(stack);
  }
}

function isValidCacheEntry(candidate: unknown): candidate is CacheEntry {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const entry = candidate as Partial<CacheEntry>;
  if (typeof entry.content !== 'string') {
    return false;
  }

  if (!entry.metadata || typeof entry.metadata !== 'object') {
    return false;
  }

  const metadata = entry.metadata as Record<string, unknown>;
  if ('cacheTtlSeconds' in metadata && typeof metadata.cacheTtlSeconds !== 'number') {
    return false;
  }

  if ('atchmnflNo' in metadata && typeof metadata.atchmnflNo !== 'string') {
    return false;
  }

  if ('title' in metadata && typeof metadata.title !== 'string') {
    return false;
  }

  if ('parsedAt' in metadata && typeof metadata.parsedAt !== 'string') {
    return false;
  }

  return true;
}
