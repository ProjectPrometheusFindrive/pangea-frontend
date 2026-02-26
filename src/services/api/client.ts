import { buildApiErrorFromResponse, buildNetworkError, isApiErrorEnvelope, isApiSuccessEnvelope } from './errors';
import type {
  AccessTokenProvider,
  ApiUnauthorizedHandler,
  ApiRequestConfig,
  ApiRequestContext,
  ApiRequestInterceptor,
  ApiResponseContext,
  ApiResponseInterceptor,
  FetchLike,
} from './types';

const DEFAULT_BASE_URL = 'https://api.pangea.local';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  fetchImpl?: FetchLike;
  accessTokenProvider?: AccessTokenProvider;
  unauthorizedHandler?: ApiUnauthorizedHandler;
}

export type RequestOptions = Omit<ApiRequestConfig, 'path' | 'method' | 'body'>;

interface AbortSignalContext {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function toNumber(value: unknown): number | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  return numericValue;
}

function isBodyInit(body: unknown): body is BodyInit {
  if (
    typeof body === 'string'
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body)
  ) {
    return true;
  }

  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    return true;
  }

  return false;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const url = isAbsoluteUrl(path) ? new URL(path) : new URL(path, baseUrl);

  if (!query) {
    return url.toString();
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function createAbortSignal(timeoutMs: number, sourceSignal?: AbortSignal): AbortSignalContext {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutTriggered = false;

  const abortFromSource = () => {
    controller.abort(sourceSignal?.reason);
  };

  if (sourceSignal?.aborted) {
    abortFromSource();
  } else if (sourceSignal) {
    sourceSignal.addEventListener('abort', abortFromSource, { once: true });
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    didTimeout: () => timeoutTriggered,
    cleanup: () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      sourceSignal?.removeEventListener('abort', abortFromSource);
    },
  };
}

async function parseResponseBody(
  response: Response,
  responseType?: ApiRequestConfig['responseType'],
): Promise<unknown> {
  if (responseType === 'raw') {
    return response;
  }

  if (responseType === 'text') {
    return response.text();
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  if (contentType.includes('application/json') || responseType === 'json') {
    try {
      return JSON.parse(rawText);
    } catch {
      return rawText;
    }
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

export class ApiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: FetchLike;
  private accessTokenProvider: AccessTokenProvider;
  private unauthorizedHandler?: ApiUnauthorizedHandler;
  private readonly requestInterceptors: ApiRequestInterceptor[] = [];
  private readonly responseInterceptors: ApiResponseInterceptor[] = [];

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = {
      Accept: 'application/json',
      ...options.defaultHeaders,
    };
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.accessTokenProvider = options.accessTokenProvider ?? (() => null);
    this.unauthorizedHandler = options.unauthorizedHandler;

    this.useRequestInterceptor(async (context) => {
      if (context.config.skipAuth) {
        return context;
      }

      const accessToken = await this.accessTokenProvider();
      if (!accessToken) {
        return context;
      }

      const headers = new Headers(context.init.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      return {
        ...context,
        init: {
          ...context.init,
          headers,
        },
      };
    });
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  setTimeoutMs(timeoutMs: number): void {
    if (timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
      return;
    }
    this.timeoutMs = timeoutMs;
  }

  setAccessTokenProvider(provider?: AccessTokenProvider): void {
    this.accessTokenProvider = provider ?? (() => null);
  }

  setUnauthorizedHandler(handler?: ApiUnauthorizedHandler): void {
    this.unauthorizedHandler = handler;
  }

  useRequestInterceptor(interceptor: ApiRequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index >= 0) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  useResponseInterceptor(interceptor: ApiResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index >= 0) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  async request<TResponse = unknown>(config: ApiRequestConfig): Promise<TResponse> {
    return this.requestInternal<TResponse>(config, false);
  }

  private async requestInternal<TResponse = unknown>(
    config: ApiRequestConfig,
    didRetryAfterUnauthorized: boolean,
  ): Promise<TResponse> {
    const requestContext = await this.buildRequestContext(config);
    const interceptedRequest = await this.applyRequestInterceptors(requestContext);
    const timeoutMs = toNumber(interceptedRequest.config.timeoutMs) ?? this.timeoutMs;
    const signalContext = createAbortSignal(timeoutMs, interceptedRequest.config.signal);

    let response: Response;
    let responseBody: unknown;

    try {
      response = await this.fetchImpl(interceptedRequest.url, {
        ...interceptedRequest.init,
        signal: signalContext.signal,
      });
      responseBody = await parseResponseBody(response, interceptedRequest.config.responseType);
    } catch (error) {
      throw buildNetworkError(error, signalContext.didTimeout());
    } finally {
      signalContext.cleanup();
    }

    let responseContext: ApiResponseContext = {
      request: interceptedRequest,
      response,
      body: responseBody,
    };

    responseContext = await this.applyResponseInterceptors(responseContext);

    if (!responseContext.response.ok || isApiErrorEnvelope(responseContext.body)) {
      const shouldAttemptRefresh = (
        !didRetryAfterUnauthorized
        && !interceptedRequest.config.skipAuth
        && !interceptedRequest.config.skipAuthRefresh
        && responseContext.response.status === 401
      );

      if (shouldAttemptRefresh) {
        const refreshSucceeded = await this.tryRefreshAuthorization();
        if (refreshSucceeded) {
          return this.requestInternal<TResponse>({
            ...config,
            skipAuthRefresh: true,
          }, true);
        }
      }

      throw buildApiErrorFromResponse(
        responseContext.response.status,
        responseContext.body,
        responseContext.response.headers.get('x-request-id') ?? undefined,
      );
    }

    return responseContext.body as TResponse;
  }

  private async tryRefreshAuthorization(): Promise<boolean> {
    if (!this.unauthorizedHandler) {
      return false;
    }

    try {
      const result = await this.unauthorizedHandler();
      return Boolean(result);
    } catch {
      return false;
    }
  }

  async requestData<TData = unknown>(config: ApiRequestConfig): Promise<TData> {
    const payload = await this.request<unknown>(config);

    if (isApiSuccessEnvelope<TData>(payload)) {
      return payload.data;
    }

    return payload as TData;
  }

  get<TResponse = unknown>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>({ ...options, path, method: 'GET' });
  }

  post<TResponse = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>({ ...options, path, method: 'POST', body });
  }

  put<TResponse = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>({ ...options, path, method: 'PUT', body });
  }

  patch<TResponse = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>({ ...options, path, method: 'PATCH', body });
  }

  delete<TResponse = unknown>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>({ ...options, path, method: 'DELETE' });
  }

  private async buildRequestContext(config: ApiRequestConfig): Promise<ApiRequestContext> {
    const method = config.method ?? (config.body === undefined ? 'GET' : 'POST');
    const normalizedMethod = method.toUpperCase();
    const headers = new Headers(this.defaultHeaders);

    if (config.headers) {
      for (const [headerKey, headerValue] of Object.entries(config.headers)) {
        headers.set(headerKey, headerValue);
      }
    }

    let body: BodyInit | undefined;
    if (config.body !== undefined && normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
      if (isBodyInit(config.body)) {
        body = config.body;
      } else {
        body = JSON.stringify(config.body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    }

    return {
      url: buildUrl(this.baseUrl, config.path, config.query),
      init: {
        method: normalizedMethod,
        headers,
        body,
      },
      config: {
        ...config,
        method: normalizedMethod as ApiRequestConfig['method'],
      },
    };
  }

  private async applyRequestInterceptors(context: ApiRequestContext): Promise<ApiRequestContext> {
    let currentContext = context;
    for (const interceptor of this.requestInterceptors) {
      currentContext = await interceptor(currentContext);
    }
    return currentContext;
  }

  private async applyResponseInterceptors(context: ApiResponseContext): Promise<ApiResponseContext> {
    let currentContext = context;
    for (const interceptor of this.responseInterceptors) {
      currentContext = await interceptor(currentContext);
    }
    return currentContext;
  }
}
