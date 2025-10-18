import type { KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  BEARER_TOKEN: string;
  BROWSER: Fetcher;
  CACHE: KVNamespace;
  CACHE_TTL_SECONDS?: string;
}

export interface ParseResult {
  content: string;
  title: string;
}

export interface ResponseMetadata {
  atchmnflNo: string;
  title?: string;
  parsedAt?: string;
  cached: boolean;
  cacheTtlSeconds: number;
}

export interface ApiSuccessResponse {
  success: true;
  content: string | null;
  metadata: ResponseMetadata;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
