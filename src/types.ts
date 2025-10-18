export interface Env {
  BEARER_TOKEN: string;
  BROWSER: Fetcher;
}

export interface ParseResult {
  content: string;
  title: string;
}

export interface ApiSuccessResponse {
  success: true;
  content: string;
  metadata: {
    atchmnflNo: string;
    title: string;
    parsedAt: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
