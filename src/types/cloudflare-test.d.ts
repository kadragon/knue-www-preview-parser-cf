import type { ExecutionContext } from '@cloudflare/workers-types';

declare module 'cloudflare:test' {
  export const env: Record<string, unknown>;
  export const SELF: ServiceWorkerGlobalScope;
  export function createExecutionContext(): ExecutionContext;
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
}
