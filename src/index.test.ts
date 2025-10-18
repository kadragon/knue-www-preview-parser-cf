import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import worker from './index';

// Mock env for testing
const mockEnv = {
  ...env,
  BEARER_TOKEN: 'test-token-123',
  BROWSER: {} as any, // Mock browser binding
};

describe('Worker API', () => {
  it('should return 401 without Authorization header', async () => {
    const request = new Request('https://worker.dev/?atchmnflNo=78541');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const json = await response.json() as any;
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 with invalid token', async () => {
    const request = new Request('https://worker.dev/?atchmnflNo=78541', {
      headers: { 'Authorization': 'Bearer wrong-token' }
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const json = await response.json() as any;
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 400 without atchmnflNo param', async () => {
    const request = new Request('https://worker.dev/', {
      headers: { 'Authorization': 'Bearer test-token-123' }
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const json = await response.json() as any;
    expect(json.success).toBe(false);
    expect(json.error).toBe('Bad Request');
    expect(json.message).toContain('atchmnflNo');
  });

  it('should have correct Content-Type header', async () => {
    const request = new Request('https://worker.dev/');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should have CORS headers', async () => {
    const request = new Request('https://worker.dev/');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
