import { ApiError } from '../../services/api';
import {
  getPaymentById,
  getPaymentStatusByReservation,
} from '../../services/payments';

export type PaymentStatusCanonical =
  | 'pending'
  | 'paid'
  | 'unpaid'
  | 'partial'
  | 'canceled'
  | 'unknown'
  | 'not-found';

type PaymentStatusSource =
  | 'status-endpoint'
  | 'payment-detail'
  | 'fallback'
  | 'cache'
  | 'not-found';

export interface PaymentStatusSnapshot {
  status: PaymentStatusCanonical;
  statusLabel: string;
  reservationId: string | null;
  paymentId: string | null;
  updatedAt: string | null;
  source: PaymentStatusSource;
}

export interface PaymentSyncTarget {
  reservationId?: string | null;
  paymentId?: string | null;
  fallbackStatus?: string | null;
  fallbackUpdatedAt?: string | null;
}

interface ResolvePaymentStatusesOptions {
  signal?: AbortSignal;
}

export interface PaymentStatusResolveResult {
  byReservationId: Record<string, PaymentStatusSnapshot>;
  byPaymentId: Record<string, PaymentStatusSnapshot>;
  hasRetriableFailure: boolean;
  errorMessage: string | null;
}

const STATUS_PRIORITY: Record<PaymentStatusCanonical, number> = {
  unpaid: 700,
  partial: 600,
  pending: 500,
  paid: 400,
  canceled: 300,
  unknown: 200,
  'not-found': 100,
};

const SOURCE_PRIORITY: Record<PaymentStatusSource, number> = {
  'payment-detail': 600,
  'status-endpoint': 500,
  fallback: 400,
  cache: 300,
  'not-found': 100,
};

const CACHE_BY_RESERVATION_ID = new Map<string, PaymentStatusSnapshot>();
const CACHE_BY_PAYMENT_ID = new Map<string, PaymentStatusSnapshot>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function normalizeStatusToken(rawValue: string): string {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function unwrapPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }
  if ('data' in payload) {
    return payload.data;
  }
  return payload;
}

function pickCollection(source: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

function toRecordCollection(payload: unknown): Record<string, unknown>[] {
  const unwrapped = unwrapPayload(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped.filter((entry): entry is Record<string, unknown> => isRecord(entry));
  }

  if (!isRecord(unwrapped)) {
    return [];
  }

  const directCollection = pickCollection(unwrapped, [
    'items',
    'list',
    'rows',
    'payments',
    'paymentStatuses',
    'records',
    'results',
  ]);
  if (directCollection) {
    return directCollection.filter((entry): entry is Record<string, unknown> => isRecord(entry));
  }

  if (isRecord(unwrapped.payment)) {
    return [unwrapped.payment];
  }

  if (isRecord(unwrapped.paymentInfo)) {
    return [unwrapped.paymentInfo];
  }

  return [unwrapped];
}

function isRetryableApiError(error: ApiError): boolean {
  return (
    (error.status !== undefined && error.status >= 500)
    || error.code === 'NETWORK_ERROR'
    || error.code === 'TIMEOUT'
    || error.code === 'SERVER_ERROR'
    || error.code === 'ABORTED'
  );
}

function toUpdatedAt(source: Record<string, unknown>): string | null {
  return pickString(source, [
    'updatedAt',
    'statusUpdatedAt',
    'statusChangedAt',
    'paidAt',
    'capturedAt',
    'createdAt',
    'dueDate',
  ]);
}

function toEpochMs(value: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

export function toCanonicalPaymentStatus(rawValue: string | null): PaymentStatusCanonical {
  if (!rawValue) {
    return 'unknown';
  }

  const token = normalizeStatusToken(rawValue);

  if (
    token.includes('overdue')
    || token.includes('unpaid')
    || token.includes('delinquent')
    || token.includes('late')
    || rawValue.includes('미납')
    || rawValue.includes('연체')
  ) {
    return 'unpaid';
  }

  if (
    token.includes('partial')
    || token.includes('partially_paid')
    || token.includes('partially_refunded')
    || rawValue.includes('부분납')
    || rawValue.includes('부분결제')
    || rawValue.includes('부분환불')
  ) {
    return 'partial';
  }

  if (
    token.includes('paid')
    || token.includes('complete')
    || token.includes('settled')
    || token.includes('captured')
    || rawValue.includes('완료')
    || rawValue.includes('완납')
  ) {
    return 'paid';
  }

  if (
    token.includes('pending')
    || token.includes('wait')
    || token.includes('open')
    || rawValue.includes('대기')
    || rawValue.includes('예정')
  ) {
    return 'pending';
  }

  if (
    token.includes('cancel')
    || token.includes('refund')
    || rawValue.includes('환불')
    || rawValue.includes('취소')
  ) {
    return 'canceled';
  }

  return 'unknown';
}

export function paymentStatusToLabel(status: PaymentStatusCanonical): string {
  if (status === 'pending') {
    return '대기';
  }
  if (status === 'paid') {
    return '완료';
  }
  if (status === 'unpaid') {
    return '미납';
  }
  if (status === 'partial') {
    return '부분납부';
  }
  if (status === 'canceled') {
    return '취소/환불';
  }
  if (status === 'not-found') {
    return '결제정보 없음';
  }
  return '확인 필요';
}

export function toReservationPaymentStatus(status: PaymentStatusCanonical): '대기' | '완료' | '미납' | '부분납부' {
  if (status === 'paid' || status === 'canceled') {
    return '완료';
  }
  if (status === 'unpaid') {
    return '미납';
  }
  if (status === 'partial') {
    return '부분납부';
  }
  return '대기';
}

export function isUnpaidPaymentStatus(status: PaymentStatusCanonical): boolean {
  return status === 'unpaid' || status === 'partial';
}

function toSnapshot(
  status: PaymentStatusCanonical,
  source: PaymentStatusSource,
  reservationId: string | null,
  paymentId: string | null,
  updatedAt: string | null,
): PaymentStatusSnapshot {
  return {
    status,
    statusLabel: paymentStatusToLabel(status),
    reservationId,
    paymentId,
    updatedAt,
    source,
  };
}

function toSnapshotFromRecord(
  row: Record<string, unknown>,
  source: PaymentStatusSource,
  hints: { reservationId?: string | null; paymentId?: string | null } = {},
): PaymentStatusSnapshot | null {
  const rawStatus = pickString(row, ['status', 'paymentStatus', 'state', 'payment_state']);
  const status = toCanonicalPaymentStatus(rawStatus);
  const reservationId = pickString(row, ['reservationId', 'reservation_id', 'rentalId']) ?? hints.reservationId ?? null;
  const paymentId = pickString(row, ['paymentId', 'id']) ?? hints.paymentId ?? null;
  const updatedAt = toUpdatedAt(row);

  if (!reservationId && !paymentId && status === 'unknown') {
    return null;
  }

  return toSnapshot(status, source, reservationId, paymentId, updatedAt);
}

function chooseBetterSnapshot(
  currentSnapshot: PaymentStatusSnapshot | null,
  nextSnapshot: PaymentStatusSnapshot | null,
): PaymentStatusSnapshot | null {
  if (!nextSnapshot) {
    return currentSnapshot;
  }
  if (!currentSnapshot) {
    return nextSnapshot;
  }

  const currentTs = toEpochMs(currentSnapshot.updatedAt);
  const nextTs = toEpochMs(nextSnapshot.updatedAt);
  if (nextTs > currentTs) {
    return nextSnapshot;
  }
  if (nextTs < currentTs) {
    return currentSnapshot;
  }

  const currentPriority = STATUS_PRIORITY[currentSnapshot.status];
  const nextPriority = STATUS_PRIORITY[nextSnapshot.status];
  if (nextPriority > currentPriority) {
    return nextSnapshot;
  }
  if (nextPriority < currentPriority) {
    return currentSnapshot;
  }

  const currentSourcePriority = SOURCE_PRIORITY[currentSnapshot.source];
  const nextSourcePriority = SOURCE_PRIORITY[nextSnapshot.source];
  if (nextSourcePriority > currentSourcePriority) {
    return nextSnapshot;
  }
  return currentSnapshot;
}

function chooseBestSnapshot(candidates: PaymentStatusSnapshot[]): PaymentStatusSnapshot | null {
  return candidates.reduce<PaymentStatusSnapshot | null>(
    (selected, candidate) => chooseBetterSnapshot(selected, candidate),
    null,
  );
}

function cacheSnapshot(snapshot: PaymentStatusSnapshot): void {
  if (snapshot.reservationId) {
    const currentSnapshot = CACHE_BY_RESERVATION_ID.get(snapshot.reservationId) ?? null;
    const selected = chooseBetterSnapshot(currentSnapshot, snapshot);
    if (selected) {
      CACHE_BY_RESERVATION_ID.set(snapshot.reservationId, selected);
    }
  }

  if (snapshot.paymentId) {
    const currentSnapshot = CACHE_BY_PAYMENT_ID.get(snapshot.paymentId) ?? null;
    const selected = chooseBetterSnapshot(currentSnapshot, snapshot);
    if (selected) {
      CACHE_BY_PAYMENT_ID.set(snapshot.paymentId, selected);
    }
  }
}

function toFallbackSnapshot(target: PaymentSyncTarget): PaymentStatusSnapshot | null {
  const fallbackStatus = toCanonicalPaymentStatus(target.fallbackStatus ?? null);
  if (!target.fallbackStatus && fallbackStatus === 'unknown') {
    return null;
  }

  return toSnapshot(
    fallbackStatus,
    'fallback',
    target.reservationId ?? null,
    target.paymentId ?? null,
    target.fallbackUpdatedAt ?? null,
  );
}

function getCachedSnapshot(target: PaymentSyncTarget): PaymentStatusSnapshot | null {
  if (target.reservationId) {
    const cachedSnapshot = CACHE_BY_RESERVATION_ID.get(target.reservationId);
    if (cachedSnapshot) {
      return {
        ...cachedSnapshot,
        source: 'cache',
      };
    }
  }

  if (target.paymentId) {
    const cachedSnapshot = CACHE_BY_PAYMENT_ID.get(target.paymentId);
    if (cachedSnapshot) {
      return {
        ...cachedSnapshot,
        source: 'cache',
      };
    }
  }

  return null;
}

function dedupeTargets(targets: PaymentSyncTarget[]): PaymentSyncTarget[] {
  const map = new Map<string, PaymentSyncTarget>();

  for (const target of targets) {
    const reservationId = target.reservationId?.trim();
    const paymentId = target.paymentId?.trim();
    if (!reservationId && !paymentId) {
      continue;
    }

    const key = `${reservationId ?? ''}::${paymentId ?? ''}`;
    if (!map.has(key)) {
      map.set(key, {
        reservationId,
        paymentId,
        fallbackStatus: target.fallbackStatus ?? null,
        fallbackUpdatedAt: target.fallbackUpdatedAt ?? null,
      });
    }
  }

  return Array.from(map.values());
}

function resolveErrorMessage(error: ApiError): string {
  if (error.status === 401) {
    return '세션이 만료되었습니다. 다시 로그인해 주세요.';
  }
  if (error.status === 403) {
    return '결제 상태 조회 권한이 없습니다.';
  }
  if (error.status === 404) {
    return '결제 정보를 찾을 수 없습니다.';
  }
  if (isRetryableApiError(error)) {
    return '결제 상태 동기화가 일시적으로 실패했습니다.';
  }
  return error.message || '결제 상태 동기화에 실패했습니다.';
}

export function getCachedPaymentStatusByReservationId(reservationId: string): PaymentStatusSnapshot | null {
  return CACHE_BY_RESERVATION_ID.get(reservationId) ?? null;
}

export async function resolvePaymentStatuses(
  targets: PaymentSyncTarget[],
  options: ResolvePaymentStatusesOptions = {},
): Promise<PaymentStatusResolveResult> {
  const normalizedTargets = dedupeTargets(targets);
  const byReservationId: Record<string, PaymentStatusSnapshot> = {};
  const byPaymentId: Record<string, PaymentStatusSnapshot> = {};

  if (normalizedTargets.length === 0) {
    return {
      byReservationId,
      byPaymentId,
      hasRetriableFailure: false,
      errorMessage: null,
    };
  }

  let hasRetriableFailure = false;
  let errorMessage: string | null = null;

  for (const target of normalizedTargets) {
    const candidates: PaymentStatusSnapshot[] = [];
    const fallbackSnapshot = toFallbackSnapshot(target);
    if (fallbackSnapshot) {
      candidates.push(fallbackSnapshot);
    }

    let isNotFoundFromStatusEndpoint = false;

    if (target.reservationId) {
      try {
        const payload = await getPaymentStatusByReservation(target.reservationId, { signal: options.signal });
        const statusSnapshots = toRecordCollection(payload)
          .map((row) => toSnapshotFromRecord(row, 'status-endpoint', { reservationId: target.reservationId }))
          .filter((snapshot): snapshot is PaymentStatusSnapshot => snapshot !== null);

        candidates.push(...statusSnapshots);

        const paymentIds = Array.from(new Set(
          statusSnapshots
            .map((snapshot) => snapshot.paymentId)
            .filter((value): value is string => Boolean(value)),
        ));

        for (const paymentId of paymentIds) {
          try {
            const detailPayload = await getPaymentById(paymentId, { signal: options.signal });
            const detailSnapshot = chooseBestSnapshot(
              toRecordCollection(detailPayload)
                .map((row) => toSnapshotFromRecord(row, 'payment-detail', {
                  reservationId: target.reservationId,
                  paymentId,
                }))
                .filter((snapshot): snapshot is PaymentStatusSnapshot => snapshot !== null),
            );
            if (detailSnapshot) {
              candidates.push(detailSnapshot);
            }
          } catch (error) {
            if (error instanceof ApiError) {
              if (error.status === 404) {
                continue;
              }
              errorMessage ??= resolveErrorMessage(error);
              if (isRetryableApiError(error)) {
                hasRetriableFailure = true;
              }
            } else if (error instanceof Error) {
              errorMessage ??= error.message;
            }
          }
        }
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            isNotFoundFromStatusEndpoint = true;
          } else {
            errorMessage ??= resolveErrorMessage(error);
            if (isRetryableApiError(error)) {
              hasRetriableFailure = true;
            }
          }
        } else if (error instanceof Error) {
          errorMessage ??= error.message;
        } else {
          errorMessage ??= '결제 상태 동기화에 실패했습니다.';
        }
      }
    }

    if (target.paymentId) {
      try {
        const detailPayload = await getPaymentById(target.paymentId, { signal: options.signal });
        const detailSnapshot = chooseBestSnapshot(
          toRecordCollection(detailPayload)
            .map((row) => toSnapshotFromRecord(row, 'payment-detail', {
              reservationId: target.reservationId,
              paymentId: target.paymentId,
            }))
            .filter((snapshot): snapshot is PaymentStatusSnapshot => snapshot !== null),
        );
        if (detailSnapshot) {
          candidates.push(detailSnapshot);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status !== 404) {
            errorMessage ??= resolveErrorMessage(error);
            if (isRetryableApiError(error)) {
              hasRetriableFailure = true;
            }
          }
        } else if (error instanceof Error) {
          errorMessage ??= error.message;
        }
      }
    }

    let selectedSnapshot = chooseBestSnapshot(candidates);

    if (!selectedSnapshot) {
      const cachedSnapshot = getCachedSnapshot(target);
      if (cachedSnapshot) {
        selectedSnapshot = cachedSnapshot;
      } else if (isNotFoundFromStatusEndpoint && target.reservationId) {
        selectedSnapshot = toSnapshot('not-found', 'not-found', target.reservationId, target.paymentId ?? null, null);
      }
    }

    if (!selectedSnapshot) {
      continue;
    }

    cacheSnapshot(selectedSnapshot);

    if (target.reservationId) {
      byReservationId[target.reservationId] = selectedSnapshot;
    }
    if (target.paymentId) {
      byPaymentId[target.paymentId] = selectedSnapshot;
    }
    if (selectedSnapshot.reservationId && !byReservationId[selectedSnapshot.reservationId]) {
      byReservationId[selectedSnapshot.reservationId] = selectedSnapshot;
    }
    if (selectedSnapshot.paymentId && !byPaymentId[selectedSnapshot.paymentId]) {
      byPaymentId[selectedSnapshot.paymentId] = selectedSnapshot;
    }
  }

  return {
    byReservationId,
    byPaymentId,
    hasRetriableFailure,
    errorMessage,
  };
}
