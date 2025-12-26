import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import type { KVNamespace, KVNamespacePutOptions } from '@cloudflare/workers-types';
import worker from './index';
import { parseDocument } from './parser';

// Trace:
//   spec_id: SPEC-API-001
//   task_id: TASK-API-ALIGN-001

vi.mock('./parser', () => ({
  parseDocument: vi.fn(),
}));

const mockParseDocument = vi.mocked(parseDocument);

interface MockKVRecord {
  value: string;
  expirationTtl?: number | null;
  metadata?: Record<string, unknown> | null;
}

function createMemoryKV() {
  const store = new Map<string, MockKVRecord>();

  const namespace = {
    get: vi.fn(async (key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream') => {
      const record = store.get(key);
      if (!record) {
        return null;
      }

      if (type === 'json') {
        return JSON.parse(record.value);
      }

      return record.value;
    }),
    put: vi.fn(async (key: string, value: string, options?: KVNamespacePutOptions) => {
      store.set(key, {
        value,
        expirationTtl: options?.expirationTtl ?? null,
        metadata: options?.metadata ?? null,
      });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };

  return { store, namespace };
}

function createMockEnv(options: { ttlSeconds?: number | null } = {}) {
  const { store, namespace } = createMemoryKV();

  const envWithCache = {
    ...env,
    BEARER_TOKEN: 'test-token-123',
    BROWSER: {} as any,
    CACHE: namespace as unknown as KVNamespace,
    CACHE_TTL_SECONDS:
      options.ttlSeconds === undefined || options.ttlSeconds === null
        ? undefined
        : String(options.ttlSeconds),
  };

  return {
    env: envWithCache,
    kv: { store, namespace },
  };
}

function authorizedRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer test-token-123');
  }

  return new Request(url, { ...init, headers });
}

describe('Worker API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication and validation', () => {
    it('returns 401 without Authorization header', async () => {
      const { env: localEnv } = createMockEnv();
      const request = new Request('https://worker.dev/?atchmnflNo=78541');
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const json = (await response.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 with invalid token', async () => {
      const { env: localEnv } = createMockEnv();
      const request = new Request('https://worker.dev/?atchmnflNo=78541', {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const json = (await response.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 400 without atchmnflNo param', async () => {
      const { env: localEnv } = createMockEnv();
      const request = authorizedRequest('https://worker.dev/');
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const json = (await response.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error).toBe('Bad Request');
      expect(json.message).toContain('atchmnflNo');
    });

    it('sets JSON Content-Type header', async () => {
      const { env: localEnv } = createMockEnv();
      const request = new Request('https://worker.dev/');
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('sets CORS headers', async () => {
      const { env: localEnv } = createMockEnv();
      const request = new Request('https://worker.dev/');
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('returns 405 for unsupported HTTP methods', async () => {
      const { env: localEnv } = createMockEnv();
      const request = authorizedRequest('https://worker.dev/?atchmnflNo=78541', {
        method: 'POST',
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(405);
      const json = (await response.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error).toBe('Method Not Allowed');
    });

    it('returns 404 for unsupported delete paths', async () => {
      const { env: localEnv } = createMockEnv();
      const request = authorizedRequest('https://worker.dev/invalid?atchmnflNo=78541', {
        method: 'DELETE',
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const json = (await response.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error).toBe('Not Found');
    });
  });

  describe('caching', () => {
    it('parses and stores result on cache miss', async () => {
      const { env: localEnv, kv } = createMockEnv();
      mockParseDocument.mockResolvedValueOnce({
        content: '# Sample',
        title: 'Sample Title',
      });

      const request = authorizedRequest('https://worker.dev/?atchmnflNo=78541');
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.success).toBe(true);
      expect(json.metadata.cached).toBe(false);
      expect(json.metadata.cacheTtlSeconds).toBe(86400);
      expect(mockParseDocument).toHaveBeenCalledTimes(1);
      expect(kv.namespace.put).toHaveBeenCalledWith(
        'doc:78541',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 })
      );
    });

    it('serves cached result on cache hit without invoking parser', async () => {
      const { env: localEnv, kv } = createMockEnv();
      mockParseDocument.mockResolvedValue({
        content: '# Sample',
        title: 'Sample Title',
      });

      const firstRequest = authorizedRequest('https://worker.dev/?atchmnflNo=78541');
      let ctx = createExecutionContext();
      let response = await worker.fetch(firstRequest, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      mockParseDocument.mockClear();

      const secondRequest = authorizedRequest('https://worker.dev/?atchmnflNo=78541');
      ctx = createExecutionContext();
      response = await worker.fetch(secondRequest, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.metadata.cached).toBe(true);
      expect(json.metadata.cacheTtlSeconds).toBe(86400);
      expect(mockParseDocument).not.toHaveBeenCalled();
      expect(kv.namespace.get).toHaveBeenCalledWith('doc:78541', 'json');
    });

    it('treats malformed cache entry as a miss and re-parses', async () => {
      const { env: localEnv, kv } = createMockEnv();
      kv.store.set('doc:12345', {
        value: JSON.stringify({
          content: '# Stale content without metadata',
        }),
      });

      mockParseDocument.mockResolvedValueOnce({
        content: '# Fresh',
        title: 'Fresh Title',
      });

      const request = authorizedRequest('https://worker.dev/?atchmnflNo=12345');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.metadata.cached).toBe(false);
      expect(json.metadata.cacheTtlSeconds).toBe(86400);
      expect(mockParseDocument).toHaveBeenCalledTimes(1);
      expect(kv.namespace.put).toHaveBeenCalledWith(
        'doc:12345',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 })
      );
    });

    it('falls back to effective TTL when cached metadata lacks ttl', async () => {
      const { env: localEnv, kv } = createMockEnv({ ttlSeconds: 3600 });
      kv.store.set('doc:33333', {
        value: JSON.stringify({
          content: '# Cached',
          metadata: {
            atchmnflNo: '33333',
            title: 'Cached Title',
            parsedAt: '2025-10-18T01:23:45.000Z',
          },
        }),
      });

      const request = authorizedRequest('https://worker.dev/?atchmnflNo=33333');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.metadata.cached).toBe(true);
      expect(json.metadata.cacheTtlSeconds).toBe(3600);
      expect(json.metadata.title).toBe('Cached Title');
      expect(mockParseDocument).not.toHaveBeenCalled();
    });

    it('uses TTL override from environment', async () => {
      const { env: localEnv, kv } = createMockEnv({ ttlSeconds: 60 });
      mockParseDocument.mockResolvedValueOnce({
        content: '# Sample',
        title: 'Sample Title',
      });

      const request = authorizedRequest('https://worker.dev/?atchmnflNo=11111');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.metadata.cacheTtlSeconds).toBe(60);
      expect(kv.namespace.put).toHaveBeenCalledWith(
        'doc:11111',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 60 })
      );
    });

    it('bypasses cache when TTL override disables caching', async () => {
      const { env: localEnv, kv } = createMockEnv({ ttlSeconds: 0 });
      mockParseDocument.mockResolvedValueOnce({
        content: '# Sample',
        title: 'Sample Title',
      });

      const request = authorizedRequest('https://worker.dev/?atchmnflNo=22222');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.metadata.cached).toBe(false);
      expect(json.metadata.cacheTtlSeconds).toBe(0);
      expect(kv.namespace.get).not.toHaveBeenCalled();
      expect(kv.namespace.put).not.toHaveBeenCalled();
      expect(mockParseDocument).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache entry via DELETE endpoint', async () => {
      const { env: localEnv, kv } = createMockEnv();
      kv.store.set('doc:78541', {
        value: JSON.stringify({
          content: '# Sample',
          metadata: {
            atchmnflNo: '78541',
            title: 'Sample Title',
            parsedAt: '2025-10-18T12:00:00.000Z',
            cacheTtlSeconds: 86400,
          },
        }),
      });

      const request = authorizedRequest('https://worker.dev/cache?atchmnflNo=78541', {
        method: 'DELETE',
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, localEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = (await response.json()) as any;
      expect(json.success).toBe(true);
      expect(json.content).toBeNull();
      expect(json.metadata.cached).toBe(false);
      expect(json.metadata.atchmnflNo).toBe('78541');
      expect(json.metadata.cacheTtlSeconds).toBe(86400);
      expect(kv.namespace.delete).toHaveBeenCalledWith('doc:78541');
    });
  });
});
