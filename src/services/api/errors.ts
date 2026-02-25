import type { ApiErrorEnvelope, ApiErrorField, ApiSuccessEnvelope } from './types';

export type ApiErrorCode =
  | 'TIMEOUT'
  | 'ABORTED'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'HTTP_ERROR'
  | 'API_ERROR';

interface ApiErrorDetails {
  status?: number;
  requestId?: string;
  fields?: ApiErrorField[];
  cause?: unknown;
  payload?: unknown;
}

export class ApiError extends Error {
  code: ApiErrorCode | string;
  status?: number;
  requestId?: string;
  fields?: ApiErrorField[];
  payload?: unknown;

  constructor(code: ApiErrorCode | string, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = details.status;
    this.requestId = details.requestId;
    this.fields = details.fields;
    this.payload = details.payload;

    if (details.cause !== undefined) {
      this.cause = details.cause;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getRequestIdFromEnvelope(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  if (!isRecord(payload.meta)) {
    return undefined;
  }
  return toNonEmptyString(payload.meta.requestId);
}

function getMessageFromPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (isRecord(payload.error)) {
    const errorMessage = toNonEmptyString(payload.error.message);
    if (errorMessage) {
      return errorMessage;
    }
  }

  return toNonEmptyString(payload.message);
}

function mapStatusToErrorCode(status: number): ApiErrorCode {
  if (status === 401) {
    return 'UNAUTHORIZED';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  if (status === 422) {
    return 'VALIDATION_ERROR';
  }
  if (status >= 500) {
    return 'SERVER_ERROR';
  }
  return 'HTTP_ERROR';
}

export function isApiErrorEnvelope(payload: unknown): payload is ApiErrorEnvelope {
  if (!isRecord(payload)) {
    return false;
  }
  if (payload.success !== false) {
    return false;
  }
  if (!isRecord(payload.error)) {
    return false;
  }
  return (
    typeof payload.error.code === 'string'
    && typeof payload.error.message === 'string'
    && isRecord(payload.meta)
  );
}

export function isApiSuccessEnvelope<TData = unknown>(
  payload: unknown,
): payload is ApiSuccessEnvelope<TData> {
  if (!isRecord(payload)) {
    return false;
  }
  return payload.success === true && isRecord(payload.meta);
}

export function buildApiErrorFromResponse(
  status: number,
  payload: unknown,
  requestId?: string,
): ApiError {
  if (isApiErrorEnvelope(payload)) {
    return new ApiError(payload.error.code || mapStatusToErrorCode(status), payload.error.message, {
      status,
      requestId: getRequestIdFromEnvelope(payload) ?? requestId,
      fields: Array.isArray(payload.error.fields) ? payload.error.fields : undefined,
      payload,
    });
  }

  return new ApiError(mapStatusToErrorCode(status), getMessageFromPayload(payload) ?? `HTTP ${status}`, {
    status,
    requestId,
    payload,
  });
}

export function buildNetworkError(cause: unknown, timeoutTriggered: boolean): ApiError {
  if (timeoutTriggered) {
    return new ApiError('TIMEOUT', 'Request timed out', { cause });
  }

  if (cause instanceof ApiError) {
    return cause;
  }

  if (typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'AbortError') {
    return new ApiError('ABORTED', 'Request aborted', { cause });
  }

  if (cause instanceof TypeError) {
    return new ApiError('NETWORK_ERROR', 'Network request failed', { cause });
  }

  return new ApiError('NETWORK_ERROR', 'Unexpected network failure', { cause });
}
