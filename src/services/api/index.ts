import { ApiClient, type ApiClientOptions } from './client';
import type { AccessTokenProvider } from './types';

const DEFAULT_API_BASE_URL = 'https://api.pangea.local';
const DEFAULT_API_TIMEOUT_MS = 10_000;

function resolveTimeoutMs(timeoutValue?: string): number {
  const parsedValue = Number(timeoutValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_API_TIMEOUT_MS;
  }
  return parsedValue;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options);
}

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  timeoutMs: resolveTimeoutMs(import.meta.env.VITE_API_TIMEOUT_MS),
});

export function setApiAccessTokenProvider(provider?: AccessTokenProvider): void {
  apiClient.setAccessTokenProvider(provider);
}

export { ApiClient, type ApiClientOptions, type RequestOptions } from './client';
export { ApiError, type ApiErrorCode } from './errors';
export type {
  AccessTokenProvider,
  ApiEnvelope,
  ApiErrorEnvelope,
  ApiErrorField,
  ApiMeta,
  ApiRequestConfig,
  ApiRequestContext,
  ApiRequestInterceptor,
  ApiResponseContext,
  ApiResponseInterceptor,
  ApiSuccessEnvelope,
} from './types';
