export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ApiErrorField {
  name?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  fields?: ApiErrorField[];
  [key: string]: unknown;
}

export interface ApiSuccessEnvelope<TData = unknown> {
  success: true;
  data: TData;
  meta: ApiMeta;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorPayload;
  meta: ApiMeta;
}

export type ApiEnvelope<TData = unknown> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

export interface ApiRequestConfig {
  path: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  skipAuth?: boolean;
  timeoutMs?: number;
  responseType?: 'json' | 'text' | 'raw';
  internal?: {
    hasRetriedAuth?: boolean;
  };
}

export interface ApiRequestContext {
  url: string;
  init: RequestInit;
  config: ApiRequestConfig;
}

export interface ApiResponseContext {
  request: ApiRequestContext;
  response: Response;
  body: unknown;
}

export type ApiRequestInterceptor =
  (context: ApiRequestContext) => Promise<ApiRequestContext> | ApiRequestContext;

export type ApiResponseInterceptor =
  (context: ApiResponseContext) => Promise<ApiResponseContext> | ApiResponseContext;

export type AccessTokenProvider = () => string | null | Promise<string | null>;

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
