import { apiClient } from './api';

export interface ActionRequiredListRequestOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  assignee?: string;
  signal?: AbortSignal;
}

export interface ActionRequiredDetailRequestOptions {
  signal?: AbortSignal;
}

export interface ActionRequiredStatusPatchOptions {
  status: string;
  memo?: string | null;
  signal?: AbortSignal;
}

export interface ActionRequiredMemoPatchOptions {
  memo: string;
  signal?: AbortSignal;
}

export interface ActionRequiredTypeCountOptions {
  pageSize?: number;
  signal?: AbortSignal;
}

const LIST_COLLECTION_KEYS = ['items', 'rows', 'list', 'actionRequired', 'actionItems'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumberValue(value: unknown): number | null {
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

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function getCollectionFromPayload(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of LIST_COLLECTION_KEYS) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (isRecord(payload.data)) {
    return getCollectionFromPayload(payload.data);
  }

  return null;
}

function toTotalCount(payload: unknown, fallback: number): number {
  if (!isRecord(payload)) {
    return fallback;
  }

  const direct = toNumberValue(payload.total)
    ?? toNumberValue(payload.totalCount)
    ?? toNumberValue(payload.count)
    ?? toNumberValue(payload.size);
  if (direct !== null) {
    return Math.max(0, Math.trunc(direct));
  }

  if (isRecord(payload.meta)) {
    const metaCount = toNumberValue(payload.meta.total)
      ?? toNumberValue(payload.meta.totalCount)
      ?? toNumberValue(payload.meta.count)
      ?? toNumberValue(payload.meta.size);
    if (metaCount !== null) {
      return Math.max(0, Math.trunc(metaCount));
    }
  }

  return fallback;
}

function hasPaymentInfo(source: Record<string, unknown>): boolean {
  const paymentSource = isRecord(source.paymentInfo)
    ? source.paymentInfo
    : isRecord(source.payment)
      ? source.payment
      : source;

  return (
    toNumberValue(paymentSource.amount) !== null
    || toNumberValue(paymentSource.overdueDays) !== null
    || toNumberValue(paymentSource.lateFee) !== null
    || toStringValue(paymentSource.dueDate) !== null
    || toStringValue(paymentSource.paymentDueDate) !== null
    || toStringValue(paymentSource.status) !== null
    || toStringValue(paymentSource.paymentStatus) !== null
    || toStringValue(paymentSource.paymentId) !== null
    || toStringValue(paymentSource.id) !== null
    || toStringValue(source.paymentId) !== null
  );
}

function normalizeActionItemType(rawValue: string | null, paymentInfoPresent: boolean): string | null {
  if (!rawValue) {
    return paymentInfoPresent ? '미납/결제 문제' : null;
  }

  const normalized = rawValue.replace(/\s+/g, '').toLowerCase();
  if (normalized.includes('정기점검')) {
    return '정기점검 만료 임박';
  }
  if (normalized.includes('미납') || normalized.includes('결제') || normalized.includes('연체')) {
    return '미납/결제 문제';
  }
  if (normalized.includes('반납지연')) {
    return '반납 지연';
  }
  if (normalized.includes('단말') && normalized.includes('off')) {
    return '단말 OFF';
  }
  if (normalized.includes('도난')) {
    return '도난 의심';
  }
  if (normalized.includes('사고')) {
    return '사고 접수';
  }
  if (normalized.includes('차량이상')) {
    return '차량이상';
  }
  if (normalized.includes('보험만료')) {
    return '보험 만료 임박';
  }

  return rawValue;
}

export function getActionRequiredList(options: ActionRequiredListRequestOptions = {}): Promise<unknown> {
  const { page, pageSize, status, priority, assignee, signal } = options;

  return apiClient.requestData<unknown>({
    path: '/api/v2/action-items',
    method: 'GET',
    query: {
      page,
      pageSize,
      status,
      priority,
      assignee,
    },
    signal,
  });
}

export async function getActionItemTypeCounts(
  options: ActionRequiredTypeCountOptions = {},
): Promise<Record<string, number>> {
  const { pageSize = 100, signal } = options;
  const counts: Record<string, number> = {};
  const seenActionIds = new Set<string>();
  let page = 1;
  let expectedTotal = 0;

  while (true) {
    const payload = await getActionRequiredList({ page, pageSize, signal });
    const rows = getCollectionFromPayload(payload) ?? [];
    expectedTotal = Math.max(expectedTotal, toTotalCount(payload, rows.length));

    rows.forEach((row, index) => {
      if (!isRecord(row)) {
        return;
      }

      const actionId = pickString(row, ['id', 'actionId', 'actionItemId', 'paymentId']) ?? `action-${page}-${index + 1}`;
      if (seenActionIds.has(actionId)) {
        return;
      }

      const vehicleNumber = pickString(row, ['vehicleNumber', 'plateNumber', 'vehicleNo', 'plate']);
      if (!vehicleNumber) {
        return;
      }

      const type = normalizeActionItemType(
        pickString(row, ['type', 'category', 'issueType', 'issue', 'title']),
        hasPaymentInfo(row),
      );
      if (!type) {
        return;
      }

      seenActionIds.add(actionId);
      counts[type] = (counts[type] ?? 0) + 1;
    });

    if (rows.length === 0 || rows.length < pageSize || seenActionIds.size >= expectedTotal) {
      break;
    }

    page += 1;
  }

  return counts;
}

export function getActionRequiredDetail(
  actionId: string,
  options: ActionRequiredDetailRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/action-items/${encodeURIComponent(actionId)}`,
    method: 'GET',
    signal: options.signal,
  });
}

function requestStatusPatch(
  path: string,
  status: string,
  memo: string | null | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const body: Record<string, unknown> = { status };
  if (memo !== undefined) {
    body.memo = memo;
  }

  return apiClient.requestData<unknown>({
    path,
    method: 'PATCH',
    body,
    signal,
  });
}

function requestMemoPatch(path: string, method: 'PATCH' | 'POST', memo: string, signal?: AbortSignal): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path,
    method,
    body: { memo },
    signal,
  });
}

export async function patchActionRequiredStatus(
  actionId: string,
  options: ActionRequiredStatusPatchOptions,
): Promise<unknown> {
  const encodedActionId = encodeURIComponent(actionId);
  return requestStatusPatch(`/api/v2/action-items/${encodedActionId}/status`, options.status, options.memo, options.signal);
}

export async function patchActionRequiredMemo(
  actionId: string,
  options: ActionRequiredMemoPatchOptions,
): Promise<unknown> {
  const encodedActionId = encodeURIComponent(actionId);
  return requestMemoPatch(`/api/v2/action-items/${encodedActionId}/memos`, 'POST', options.memo, options.signal);
}
