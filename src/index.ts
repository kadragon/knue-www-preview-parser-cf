import { Env, ApiResponse } from './types';
import { extractBearerToken, validateToken } from './auth';
import { parseDocument } from './parser';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const token = extractBearerToken(request);
    if (!validateToken(token, env.BEARER_TOKEN)) {
      return errorResponse('Unauthorized', 'Invalid or missing bearer token', 401);
    }

    const url = new URL(request.url);
    const atchmnflNo = url.searchParams.get('atchmnflNo');

    if (!atchmnflNo) {
      return errorResponse('Bad Request', 'Missing required parameter: atchmnflNo', 400);
    }

    try {
      const result = await withTimeout(
        parseDocument(atchmnflNo, env.BROWSER),
        55000,
        'Document parsing timeout'
      );

      return successResponse(result.content, {
        atchmnflNo,
        title: result.title,
        parsedAt: new Date().toISOString(),
      });
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
  content: string,
  metadata: { atchmnflNo: string; title: string; parsedAt: string }
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
