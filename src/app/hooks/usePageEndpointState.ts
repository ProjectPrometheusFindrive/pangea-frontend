import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '../../services/api';

const DEFAULT_COLLECTION_KEYS = [
  'items',
  'list',
  'rows',
  'results',
  'data',
  'assets',
  'reservations',
  'actionItems',
  'records',
  'content',
];

const COUNT_KEYS = ['total', 'totalCount', 'count', 'size', 'itemsCount'];
const PAGE_FORBIDDEN_REDIRECT_TOAST = '페이지 접근 권한이 없어 홈으로 이동합니다.';

export type PageErrorKind = 'unauthorized' | 'forbidden' | 'not-found' | 'retryable' | 'unknown';

interface PageErrorState {
  kind: PageErrorKind;
  message: string;
}

interface UsePageEndpointStateOptions<TPayload> {
  request: (signal: AbortSignal) => Promise<TPayload>;
  onSuccess?: (payload: TPayload) => void;
  isEmpty?: (payload: TPayload) => boolean;
}

interface UsePageEndpointStateResult {
  isLoading: boolean;
  error: string | null;
  errorKind: PageErrorKind | null;
  isEmpty: boolean;
  run: () => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }
  return null;
}

function getCountValue(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of COUNT_KEYS) {
    const countValue = toNumber(value[key]);
    if (countValue !== null) {
      return countValue;
    }
  }

  return null;
}

function resolveCollectionKeys(preferredKeys: string[]): string[] {
  return Array.from(new Set([...preferredKeys, ...DEFAULT_COLLECTION_KEYS]));
}

export function getCollectionFromPayload(payload: unknown, preferredKeys: string[] = []): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const collectionKeys = resolveCollectionKeys(preferredKeys);
  for (const key of collectionKeys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (isRecord(payload.data)) {
    return getCollectionFromPayload(payload.data, collectionKeys);
  }

  return null;
}

export function isPayloadEmpty(payload: unknown, preferredKeys: string[] = []): boolean {
  const collection = getCollectionFromPayload(payload, preferredKeys);
  if (collection) {
    return collection.length === 0;
  }

  const countValue = getCountValue(payload);
  if (countValue !== null) {
    return countValue === 0;
  }

  if (isRecord(payload) && isRecord(payload.meta)) {
    const metaCountValue = getCountValue(payload.meta);
    if (metaCountValue !== null) {
      return metaCountValue === 0;
    }
  }

  return false;
}

function toPageErrorState(error: unknown): PageErrorState {
  if (error instanceof ApiError) {
    const errorCode = typeof error.code === 'string' ? error.code : '';
    const isUnauthorized = error.status === 401 || errorCode === 'UNAUTHORIZED';
    const isForbidden = error.status === 403 || errorCode === 'FORBIDDEN';
    const isNotFound = error.status === 404 || errorCode === 'NOT_FOUND';
    const isRetryable = error.status !== undefined && error.status >= 500
      || errorCode === 'TIMEOUT'
      || errorCode === 'NETWORK_ERROR'
      || errorCode === 'SERVER_ERROR'
      || errorCode === 'ABORTED';

    if (isUnauthorized) {
      return {
        kind: 'unauthorized',
        message: '세션이 만료되었습니다. 로그인 후 다시 시도해 주세요.',
      };
    }

    if (isForbidden) {
      return {
        kind: 'forbidden',
        message: '요청한 데이터에 접근할 권한이 없습니다. 홈으로 이동해 주세요.',
      };
    }

    if (isNotFound) {
      return {
        kind: 'not-found',
        message: '요청한 정보를 찾을 수 없습니다. 홈으로 이동해 다시 확인해 주세요.',
      };
    }

    if (isRetryable) {
      return {
        kind: 'retryable',
        message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }

    return {
      kind: 'unknown',
      message: error.message || '요청을 처리하는 중 오류가 발생했습니다.',
    };
  }

  if (error instanceof Error && error.message) {
    return {
      kind: 'unknown',
      message: error.message,
    };
  }

  return {
    kind: 'unknown',
    message: '요청을 처리하는 중 오류가 발생했습니다.',
  };
}

export function getPageErrorActionLabel(errorKind: PageErrorKind | null): string | undefined {
  if (errorKind === 'unauthorized') {
    return '로그인으로 이동';
  }
  if (errorKind === 'not-found') {
    return '홈으로 돌아가기';
  }
  if (errorKind === 'forbidden') {
    return '홈으로 돌아가기';
  }
  return undefined;
}

export function handlePageErrorAction(errorKind: PageErrorKind | null, navigate: NavigateFunction): void {
  if (errorKind === 'unauthorized') {
    navigate('/login', { replace: true });
    return;
  }

  if (errorKind === 'not-found') {
    navigate('/', { replace: true });
    return;
  }

  if (errorKind === 'forbidden') {
    // Page API 403 policy: show guidance toast and return to home.
    // Route permission denial is handled separately in RequireAuth as /forbidden.
    toast.error(PAGE_FORBIDDEN_REDIRECT_TOAST);
    navigate('/', { replace: true });
  }
}

export function usePageEndpointState<TPayload>({
  request,
  onSuccess,
  isEmpty,
}: UsePageEndpointStateOptions<TPayload>): UsePageEndpointStateResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PageErrorKind | null>(null);
  const [isEmptyState, setIsEmptyState] = useState(false);

  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
    controllerRef.current?.abort();
  }, []);

  const run = useCallback(async () => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    try {
      const payload = await request(controller.signal);
      if (!mountedRef.current || requestSequenceRef.current !== requestSequence || controller.signal.aborted) {
        return;
      }

      onSuccess?.(payload);
      setIsEmptyState(isEmpty ? isEmpty(payload) : isPayloadEmpty(payload as unknown));
    } catch (requestError) {
      if (!mountedRef.current || requestSequenceRef.current !== requestSequence || controller.signal.aborted) {
        return;
      }

      const pageErrorState = toPageErrorState(requestError);
      setError(pageErrorState.message);
      setErrorKind(pageErrorState.kind);
      setIsEmptyState(false);
    } finally {
      if (!mountedRef.current || requestSequenceRef.current !== requestSequence) {
        return;
      }

      setIsLoading(false);
    }
  }, [isEmpty, onSuccess, request]);

  return {
    isLoading,
    error,
    errorKind,
    isEmpty: isEmptyState,
    run,
  };
}
