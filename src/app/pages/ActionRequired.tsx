import { Layout } from '../components/Layout';
import { useSearchParams, useNavigate } from 'react-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, X, ArrowUp, ArrowDown, Clock, User, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { usePaymentStatusSync } from '../hooks/usePaymentStatusSync';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { ACTION_PERMISSIONS, ROUTE_PERMISSIONS } from '../authorization';
import { ApiError } from '../../services/api';
import {
  getActionRequiredDetail,
  getActionRequiredList,
  patchActionRequiredMemo,
  patchActionRequiredStatus,
} from '../../services/actionRequired';
import { paymentStatusToLabel, toCanonicalPaymentStatus } from '../utils/paymentStatusSync';

type ActionStatusCode = 'pending' | 'in-progress' | 'resolved';

interface MemoLog {
  id: string;
  content: string;
  timestamp: string;
  author: string;
  status: ActionStatusCode;
  statusLabel: string;
}

interface ActionItem {
  id: string;
  type: string;
  vehicleNumber: string;
  customerName: string;
  date: string;
  severity: 'High' | 'Medium' | 'Low';
  status: string;
  statusCode: ActionStatusCode;
  assignee: string;
  reservationId?: string;
  paymentId?: string;
  description?: string;
  memos?: MemoLog[];
  paymentInfo?: {
    paymentId?: string;
    reservationId?: string;
    amount: number;
    overdueDays: number;
    lateFee: number;
    totalAmount: number;
    dueDate: string;
    paymentType: string;
    status?: string;
    statusLabel?: string;
    updatedAt?: string;
  };
}

type SortField = 'type' | 'vehicleNumber' | 'customerName' | 'date' | 'severity' | 'status' | 'assignee';
type SortDirection = 'asc' | 'desc' | null;
type ActionStatusFilter = 'all' | 'pending' | 'in-progress' | 'resolved';
type ActionPriorityFilter = 'all' | 'high' | 'medium' | 'low';
type ActionWriteKind = 'status' | 'memo' | 'resolve';

const ACTION_REQUIRED_DATETIME_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const STATUS_OPTIONS = ['대기중', '진행중', '완료'] as const;
const LIST_COLLECTION_KEYS = ['items', 'rows', 'list', 'actionRequired', 'actionItems'];
const ACTION_PRIORITY_LABELS: Record<ActionItem['severity'], string> = {
  High: '높음',
  Medium: '보통',
  Low: '낮음',
};

interface ActionWriteErrorState {
  kind: ActionWriteKind;
  message: string;
  retryable: boolean;
}

interface OptimisticActionSnapshot {
  selectedItem: ActionItem | null;
  sourceActionItems: ActionItem[];
  totalItems: number;
}

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

// vehicleNumber 전용 추출: '?' 문자가 포함된 값(한글 깨짐)보다 정상 값을 우선 선택
function pickVehicleNumber(source: Record<string, unknown>): string | null {
  const keys = ['vehicleNumber', 'plateNumber', 'vehicleNo', 'plate'];
  // 첫 번째 패스: '?' 없는 정상 값 우선
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate && !candidate.includes('?')) {
      return candidate;
    }
  }
  // 폴백: '?' 포함 여부 관계없이 첫 번째 유효 값 반환
  return pickString(source, keys);
}

function formatActionDate(rawValue: string): string {
  const normalized = rawValue.trim();
  if (!normalized || normalized === '-') {
    return '-';
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return ACTION_REQUIRED_DATETIME_FORMATTER.format(parsed);
}

function normalizeSeverity(rawValue: string | null): ActionItem['severity'] {
  if (!rawValue) {
    return 'Low';
  }

  const normalized = rawValue.toLowerCase().replace(/_/g, '-');
  if (normalized === 'high' || normalized === '상') {
    return 'High';
  }
  if (normalized === 'medium' || normalized === 'mid' || normalized === '중') {
    return 'Medium';
  }
  return 'Low';
}

function normalizeActionItemType(rawValue: string | null, hasPaymentInfo: boolean): string | null {
  if (!rawValue) {
    return hasPaymentInfo ? '미납/결제 문제' : null;
  }

  const normalized = rawValue.replace(/\s+/g, '').toLowerCase();
  if (normalized.includes('정기점검')) {
    return '정기점검';
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

function normalizeStatusLabel(rawValue: string | null): string {
  if (!rawValue) {
    return '대기중';
  }
  if (rawValue.includes('연체')) {
    return rawValue;
  }

  const normalized = rawValue.toLowerCase().replace(/_/g, '-');
  if (normalized === 'pending' || normalized === 'open') {
    return '대기중';
  }
  if (normalized === 'in-progress' || normalized === 'in progress' || normalized === 'processing') {
    return '진행중';
  }
  if (normalized === 'resolved' || normalized === 'done' || normalized === 'closed') {
    return '완료';
  }
  if (rawValue === '대기' || rawValue === '대기중') {
    return '대기중';
  }
  if (rawValue === '진행중') {
    return '진행중';
  }
  if (rawValue === '완료') {
    return '완료';
  }

  return rawValue;
}

function normalizeStatusCode(rawValue: string | null): ActionStatusCode {
  if (!rawValue) {
    return 'pending';
  }

  if (rawValue.includes('완료')) {
    return 'resolved';
  }
  if (rawValue.includes('진행')) {
    return 'in-progress';
  }
  if (rawValue.includes('대기') || rawValue.includes('연체')) {
    return 'pending';
  }

  const normalized = rawValue.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '');
  if (normalized === 'resolved' || normalized === 'done' || normalized === 'closed') {
    return 'resolved';
  }
  if (normalized === 'in-progress' || normalized === 'inprogress' || normalized === 'processing') {
    return 'in-progress';
  }
  if (normalized === 'pending' || normalized === 'open') {
    return 'pending';
  }

  return 'pending';
}

function toStatusLabel(statusCode: ActionStatusCode): string {
  if (statusCode === 'resolved') {
    return '완료';
  }
  if (statusCode === 'in-progress') {
    return '진행중';
  }
  return '대기중';
}

function toStatusPatchValue(statusCode: ActionStatusCode): string {
  return statusCode;
}

function normalizeMemoStatus(rawValue: string | null): MemoLog['status'] {
  const normalizedStatusCode = normalizeStatusCode(rawValue);
  if (normalizedStatusCode === 'resolved') {
    return 'resolved';
  }
  if (normalizedStatusCode === 'in-progress') {
    return 'in-progress';
  }
  return 'pending';
}

function toActionWriteError(kind: ActionWriteKind, error: unknown): ActionWriteErrorState {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      if (kind === 'memo') {
        return {
          kind,
          message: '메모 형식이 올바르지 않거나 허용 길이를 초과했습니다. 입력값을 확인해 주세요.',
          retryable: false,
        };
      }
      return {
        kind,
        message: '허용되지 않은 상태 값입니다. 상태 값을 다시 선택해 주세요.',
        retryable: false,
      };
    }

    if (error.status === 401) {
      return {
        kind,
        message: '세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.',
        retryable: false,
      };
    }

    if (error.status === 403) {
      return {
        kind,
        message: '권한이 없어 요청을 처리할 수 없습니다.',
        retryable: false,
      };
    }

    if (error.status === 404) {
      return {
        kind,
        message: '대상 항목을 찾을 수 없습니다. 목록을 새로고침한 뒤 재시도해 주세요.',
        retryable: false,
      };
    }

    if (error.status === 409) {
      return {
        kind,
        message: '다른 사용자가 먼저 수정했습니다. 최신 데이터로 재시도해 주세요.',
        retryable: false,
      };
    }

    if (error.status !== undefined && error.status >= 500) {
      return {
        kind,
        message: '서버 오류가 발생했습니다. 재시도해 주세요.',
        retryable: true,
      };
    }

    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return {
        kind,
        message: '네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 재시도해 주세요.',
        retryable: true,
      };
    }

    if (error.code === 'ABORTED') {
      return {
        kind,
        message: '요청이 중단되었습니다. 재시도해 주세요.',
        retryable: true,
      };
    }

    return {
      kind,
      message: error.message || '요청 처리 중 오류가 발생했습니다.',
      retryable: false,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      kind,
      message: error.message,
      retryable: false,
    };
  }

  return {
    kind,
    message: '요청 처리 중 오류가 발생했습니다.',
    retryable: false,
  };
}

function toMemoLogs(value: unknown): MemoLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const content = pickString(entry, ['content', 'memo', 'note']);
      if (!content) {
        return null;
      }

      const statusValue = pickString(entry, ['status']);
      return {
        id: pickString(entry, ['id', 'memoId']) ?? `memo-${index + 1}`,
        content,
        timestamp: pickString(entry, ['timestamp', 'createdAt', 'changedAt', 'updatedAt']) ?? new Date().toISOString(),
        author: pickString(entry, ['author', 'createdBy', 'changedBy', 'updatedBy']) ?? '-',
        status: normalizeMemoStatus(statusValue),
        statusLabel: pickString(entry, ['statusLabel']) ?? normalizeStatusLabel(statusValue),
      };
    })
    .filter((entry): entry is MemoLog => entry !== null);
}

function toPaymentInfo(source: Record<string, unknown>): ActionItem['paymentInfo'] | undefined {
  const paymentSource = isRecord(source.paymentInfo)
    ? source.paymentInfo
    : isRecord(source.payment)
      ? source.payment
      : source;

  const paymentId = pickString(paymentSource, ['paymentId', 'id']) ?? pickString(source, ['paymentId']);
  const reservationId = pickString(paymentSource, ['reservationId', 'rentalId']) ?? pickString(source, ['reservationId', 'rentalId']);
  const amount = toNumberValue(paymentSource.amount);
  const dueDate = pickString(paymentSource, ['dueDate', 'paymentDueDate']);
  const overdueDays = toNumberValue(paymentSource.overdueDays) ?? 0;
  const lateFee = toNumberValue(paymentSource.lateFee) ?? 0;
  const totalAmount = toNumberValue(paymentSource.totalAmount) ?? (amount ?? 0) + lateFee;
  const rawStatus = pickString(paymentSource, ['status', 'paymentStatus']);
  const normalizedStatus = rawStatus ? toCanonicalPaymentStatus(rawStatus) : null;
  const statusLabel = normalizedStatus ? paymentStatusToLabel(normalizedStatus) : null;
  const updatedAt = pickString(paymentSource, ['updatedAt', 'statusUpdatedAt', 'paidAt', 'createdAt']);

  if (
    amount === null
    && dueDate === null
    && overdueDays === 0
    && lateFee === 0
    && !statusLabel
    && !paymentId
    && !reservationId
  ) {
    return undefined;
  }

  return {
    paymentId: paymentId ?? undefined,
    reservationId: reservationId ?? undefined,
    amount: amount ?? 0,
    overdueDays,
    lateFee,
    totalAmount,
    dueDate: dueDate ?? '-',
    paymentType: pickString(paymentSource, ['paymentType', 'type']) ?? '-',
    status: normalizedStatus ?? undefined,
    statusLabel: statusLabel ?? undefined,
    updatedAt: updatedAt ?? undefined,
  };
}

function toActionItem(row: unknown, index: number, fallbackId?: string): ActionItem | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = pickString(row, ['id', 'actionId', 'actionItemId', 'paymentId']) ?? fallbackId ?? `action-${index + 1}`;
  const paymentInfo = toPaymentInfo(row);
  const reservationId = pickString(row, ['reservationId', 'rentalId']) ?? paymentInfo?.reservationId;
  const paymentId = pickString(row, ['paymentId']) ?? paymentInfo?.paymentId;
  const type = normalizeActionItemType(
    pickString(row, ['type', 'category', 'issueType', 'issue', 'title']),
    Boolean(paymentInfo),
  );
  const vehicleNumber = pickVehicleNumber(row);

  if (!type || !vehicleNumber) {
    return null;
  }

  const memos = toMemoLogs(row.memos ?? row.memoHistory);
  const latestMemo = pickString(row, ['memo']);
  if (memos.length === 0 && latestMemo) {
    const statusValue = pickString(row, ['status', 'statusLabel']);
    memos.push({
      id: `memo-inline-${id}`,
      content: latestMemo,
      timestamp: pickString(row, ['updatedAt', 'createdAt']) ?? new Date().toISOString(),
      author: pickString(row, ['updatedBy', 'createdBy']) ?? '-',
      status: normalizeMemoStatus(statusValue),
      statusLabel: normalizeStatusLabel(statusValue),
    });
  }

  const statusRawValue = pickString(row, ['status', 'statusLabel']);

  return {
    id,
    type,
    vehicleNumber,
    customerName: pickString(row, ['customerName', 'customer', 'customerDisplayName']) ?? '-',
    date: pickString(row, ['date', 'dueDate', 'occurredAt', 'createdAt']) ?? '-',
    severity: normalizeSeverity(pickString(row, ['severity', 'priority'])),
    status: normalizeStatusLabel(statusRawValue),
    statusCode: normalizeStatusCode(statusRawValue),
    assignee: pickString(row, ['assignee', 'assigneeName', 'owner', 'assignedTo']) ?? '-',
    reservationId: reservationId ?? undefined,
    paymentId: paymentId ?? undefined,
    description: pickString(row, ['description', 'detail']),
    memos: memos.length > 0 ? memos : undefined,
    paymentInfo,
  };
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
    return direct;
  }

  if (isRecord(payload.meta)) {
    const metaCount = toNumberValue(payload.meta.total)
      ?? toNumberValue(payload.meta.totalCount)
      ?? toNumberValue(payload.meta.count)
      ?? toNumberValue(payload.meta.size);
    if (metaCount !== null) {
      return metaCount;
    }
  }

  return fallback;
}

function toActionItemCollection(payload: unknown): { items: ActionItem[]; total: number } {
  const rows = getCollectionFromPayload(payload, LIST_COLLECTION_KEYS);
  if (!rows) {
    return { items: [], total: toTotalCount(payload, 0) };
  }

  const uniqueIds = new Set<string>();
  const items: ActionItem[] = [];

  rows.forEach((row, index) => {
    const actionItem = toActionItem(row, index);
    if (!actionItem) {
      return;
    }
    if (uniqueIds.has(actionItem.id)) {
      return;
    }
    uniqueIds.add(actionItem.id);
    items.push(actionItem);
  });

  return {
    items,
    total: toTotalCount(payload, items.length),
  };
}

function toActionItemDetail(payload: unknown, fallbackItem: ActionItem): ActionItem {
  if (isRecord(payload)) {
    const detailCandidate = payload.item
      ?? payload.actionRequired
      ?? payload.actionItem
      ?? payload.detail
      ?? payload.data
      ?? payload;

    const detailItem = toActionItem(detailCandidate, 0, fallbackItem.id);
    if (detailItem) {
      return {
        ...fallbackItem,
        ...detailItem,
        paymentInfo: detailItem.paymentInfo ?? fallbackItem.paymentInfo,
        memos: detailItem.memos ?? fallbackItem.memos,
      };
    }
  }

  const detailItem = toActionItem(payload, 0, fallbackItem.id);
  if (detailItem) {
    return {
      ...fallbackItem,
      ...detailItem,
      paymentInfo: detailItem.paymentInfo ?? fallbackItem.paymentInfo,
      memos: detailItem.memos ?? fallbackItem.memos,
    };
  }

  return fallbackItem;
}

export default function ActionRequired() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canPerformAction, canAccessRoute } = useAuthorization();
  const canWriteActionRequired = canPerformAction(ACTION_PERMISSIONS.actionRequiredWrite);
  const canViewAssets = canAccessRoute(ROUTE_PERMISSIONS.assets);
  const canViewReservations = canAccessRoute(ROUTE_PERMISSIONS.reservations);

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ActionStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<ActionPriorityFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentMemo, setCurrentMemo] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [sourceActionItems, setSourceActionItems] = useState<ActionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [writeError, setWriteError] = useState<ActionWriteErrorState | null>(null);
  const [writeNotice, setWriteNotice] = useState<string | null>(null);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [isMemoSaving, setIsMemoSaving] = useState(false);
  const [isResolveSaving, setIsResolveSaving] = useState(false);

  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailNotFound, setIsDetailNotFound] = useState(false);

  const detailRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);

  const isWriteSaving = isStatusSaving || isMemoSaving || isResolveSaving;

  const filterChips = [
    '사고 접수',
    '반납 지연',
    '미납/결제 문제',
    '단말 OFF',
    '도난 의심',
    '정기점검',
    '차량이상',
    '보험 만료 임박',
  ];

  const paymentSyncTargets = useMemo(() => (
    sourceActionItems
      .filter((item) => item.type === '미납/결제 문제' || Boolean(item.paymentInfo))
      .map((item) => ({
        reservationId: item.reservationId ?? item.paymentInfo?.reservationId ?? null,
        paymentId: item.paymentId ?? item.paymentInfo?.paymentId ?? null,
        fallbackStatus: item.paymentInfo?.status ?? null,
        fallbackUpdatedAt: item.paymentInfo?.updatedAt ?? null,
      }))
      .filter((target) => Boolean(target.reservationId || target.paymentId))
  ), [sourceActionItems]);

  const {
    byReservationId: syncedPaymentByReservationId,
    byPaymentId: syncedPaymentByPaymentId,
    isSyncing: isPaymentSyncing,
    error: paymentSyncError,
    usingLastKnown: isPaymentSyncUsingLastKnown,
    retry: retryPaymentSync,
  } = usePaymentStatusSync({
    targets: paymentSyncTargets,
    enabled: sourceActionItems.length > 0,
    pollIntervalMs: 20_000,
  });

  const requestActionItems = useCallback((signal: AbortSignal) => getActionRequiredList({
    page,
    pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    assignee: assigneeFilter === 'all' ? undefined : assigneeFilter,
    signal,
  }), [assigneeFilter, page, pageSize, priorityFilter, statusFilter]);

  const handleActionItemsSuccess = useCallback((payload: unknown) => {
    const { items, total } = toActionItemCollection(payload);
    setSourceActionItems(items);
    setTotalItems(total);
  }, []);

  const isActionItemsPayloadEmpty = useCallback((payload: unknown) => {
    const rows = getCollectionFromPayload(payload, LIST_COLLECTION_KEYS);
    if (rows) {
      return rows.length === 0;
    }
    return isPayloadEmpty(payload, LIST_COLLECTION_KEYS);
  }, []);

  const {
    isLoading: isItemsLoading,
    error: itemsError,
    errorKind: itemsErrorKind,
    isEmpty: isActionApiEmpty,
    run: hydrateActionItems,
  } = usePageEndpointState<unknown>({
    request: requestActionItems,
    onSuccess: handleActionItemsSuccess,
    isEmpty: isActionItemsPayloadEmpty,
  });

  useEffect(() => {
    void hydrateActionItems();
  }, [hydrateActionItems]);

  useEffect(() => () => {
    detailControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const searchParam = searchParams.get('search');

    const normalizedFilterParam = filterParam === '정기점검 만료 임박'
      ? '정기점검'
      : filterParam;

    if (normalizedFilterParam && filterChips.includes(normalizedFilterParam)) {
      setSelectedFilters([normalizedFilterParam]);
    }

    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

  const handleActionItemsRetry = useCallback(() => {
    void hydrateActionItems();
  }, [hydrateActionItems]);

  const resetActionFilters = useCallback(() => {
    setSelectedFilters([]);
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setPage(1);
  }, []);

  const handleActionErrorAction = useCallback(() => {
    handlePageErrorAction(itemsErrorKind, navigate);
  }, [itemsErrorKind, navigate]);

  const clearWriteFeedback = useCallback(() => {
    setWriteError(null);
    setWriteNotice(null);
    retryActionRef.current = null;
  }, []);

  const restoreOptimisticActionSnapshot = useCallback((snapshot: OptimisticActionSnapshot) => {
    setSelectedItem(snapshot.selectedItem);
    setSourceActionItems(snapshot.sourceActionItems);
    setTotalItems(snapshot.totalItems);
  }, []);

  const handleWriteRetry = useCallback(() => {
    if (isWriteSaving) {
      return;
    }
    const retryAction = retryActionRef.current;
    if (!retryAction) {
      return;
    }
    void retryAction();
  }, [isWriteSaving]);

  const hydrateActionDetail = useCallback(async (actionId: string, fallbackItem: ActionItem) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;

    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;

    setIsDetailLoading(true);
    setDetailError(null);
    setIsDetailNotFound(false);

    try {
      const payload = await getActionRequiredDetail(actionId, { signal: controller.signal });
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setSelectedItem(toActionItemDetail(payload, fallbackItem));
    } catch (error) {
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setSelectedItem(fallbackItem);
        return;
      }

      setDetailError(error instanceof Error ? error.message : '상세 정보를 불러오는 중 오류가 발생했습니다.');
      setSelectedItem(fallbackItem);
    } finally {
      if (detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  }, []);

  const handleOpenDetail = useCallback((item: ActionItem) => {
    setSelectedItem(item);
    setCurrentMemo('');
    setCurrentStatus('');
    clearWriteFeedback();
    void hydrateActionDetail(item.id, item);
  }, [clearWriteFeedback, hydrateActionDetail]);

  const handleCloseDetail = useCallback(() => {
    if (isWriteSaving) {
      return;
    }
    detailControllerRef.current?.abort();
    setSelectedItem(null);
    setCurrentMemo('');
    setCurrentStatus('');
    setIsDetailLoading(false);
    setDetailError(null);
    setIsDetailNotFound(false);
    clearWriteFeedback();
  }, [clearWriteFeedback, isWriteSaving]);

  const allItems: ActionItem[] = useMemo(() => (
    sourceActionItems.map((item) => {
      const paymentSnapshot = (
        (item.paymentId ? syncedPaymentByPaymentId[item.paymentId] : undefined)
        ?? (item.reservationId ? syncedPaymentByReservationId[item.reservationId] : undefined)
      );

      if (!paymentSnapshot) {
        return item;
      }

      if (!item.paymentInfo && item.type !== '미납/결제 문제') {
        return item;
      }

      return {
        ...item,
        reservationId: item.reservationId ?? paymentSnapshot.reservationId ?? undefined,
        paymentId: item.paymentId ?? paymentSnapshot.paymentId ?? undefined,
        paymentInfo: {
          amount: item.paymentInfo?.amount ?? 0,
          overdueDays: item.paymentInfo?.overdueDays ?? 0,
          lateFee: item.paymentInfo?.lateFee ?? 0,
          totalAmount: item.paymentInfo?.totalAmount ?? 0,
          dueDate: item.paymentInfo?.dueDate ?? '-',
          paymentType: item.paymentInfo?.paymentType ?? '-',
          paymentId: item.paymentInfo?.paymentId ?? paymentSnapshot.paymentId ?? undefined,
          reservationId: item.paymentInfo?.reservationId ?? paymentSnapshot.reservationId ?? undefined,
          status: paymentSnapshot.status,
          statusLabel: paymentSnapshot.statusLabel,
          updatedAt: paymentSnapshot.updatedAt ?? item.paymentInfo?.updatedAt ?? undefined,
        },
      };
    })
  ), [sourceActionItems, syncedPaymentByPaymentId, syncedPaymentByReservationId]);

  useEffect(() => {
    setSelectedItem((previousItem) => {
      if (!previousItem) {
        return previousItem;
      }

      const nextItem = allItems.find((item) => item.id === previousItem.id);
      if (!nextItem || !nextItem.paymentInfo) {
        return previousItem;
      }

      const previousStatus = previousItem.paymentInfo?.status ?? null;
      const nextStatus = nextItem.paymentInfo.status ?? null;
      if (previousStatus === nextStatus) {
        return previousItem;
      }

      return {
        ...previousItem,
        reservationId: previousItem.reservationId ?? nextItem.reservationId,
        paymentId: previousItem.paymentId ?? nextItem.paymentId,
        paymentInfo: {
          ...(previousItem.paymentInfo ?? {}),
          ...nextItem.paymentInfo,
        },
      };
    });
  }, [allItems]);

  const toggleFilter = (filter: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((entry) => entry !== filter)
        : [...prev, filter],
    );
  };

  const filteredItems = allItems.filter((item) => {
    const matchesFilter = selectedFilters.length === 0 || selectedFilters.includes(item.type);
    const matchesSearch = searchQuery === ''
      || item.vehicleNumber.includes(searchQuery)
      || item.customerName.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const isUnpaidFilterActive = selectedFilters.includes('미납/결제 문제');
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / pageSize));
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High':
        return 'bg-red-100 text-red-700';
      case 'Medium':
        return 'bg-orange-100 text-orange-700';
      case 'Low':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPaymentStatusBadgeColor = (paymentStatusLabel: string | undefined): string => {
    if (!paymentStatusLabel) {
      return 'bg-gray-100 text-gray-600';
    }
    if (paymentStatusLabel === '미납') {
      return 'bg-red-100 text-red-700';
    }
    if (paymentStatusLabel === '부분납부') {
      return 'bg-amber-100 text-amber-700';
    }
    if (paymentStatusLabel === '완료') {
      return 'bg-green-100 text-green-700';
    }
    if (paymentStatusLabel === '대기') {
      return 'bg-blue-100 text-blue-700';
    }
    if (paymentStatusLabel === '결제정보 없음') {
      return 'bg-gray-100 text-gray-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = [...filteredItems].sort((left, right) => {
    if (!sortField) return 0;
    const leftValue = left[sortField];
    const rightValue = right[sortField];
    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return sortDirection === 'asc'
        ? leftValue.localeCompare(rightValue, 'ko')
        : rightValue.localeCompare(leftValue, 'ko');
    }
    return 0;
  });

  const applyOptimisticActionPatch = (
    actionId: string,
    patch: Partial<ActionItem>,
    shouldRemoveFromList: boolean,
  ) => {
    setSelectedItem((prev) => {
      if (!prev || prev.id !== actionId) {
        return prev;
      }
      return {
        ...prev,
        ...patch,
      };
    });

    setSourceActionItems((prev) => {
      if (shouldRemoveFromList) {
        return prev.filter((item) => item.id !== actionId);
      }
      return prev.map((item) => (item.id === actionId ? { ...item, ...patch } : item));
    });

    if (shouldRemoveFromList) {
      setTotalItems((prev) => Math.max(0, prev - 1));
    }
  };

  async function runStatusUpdate(
    actionId: string,
    nextStatusCode: ActionStatusCode,
    kind: 'status' | 'resolve',
  ): Promise<void> {
    if (!canWriteActionRequired) {
      setWriteError({
        kind,
        message: '권한이 없어 상태를 변경할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    if (isWriteSaving) {
      return;
    }

    const targetItem = selectedItem?.id === actionId
      ? selectedItem
      : sourceActionItems.find((item) => item.id === actionId);
    if (!targetItem) {
      return;
    }

    const previousSelectedItem = targetItem;
    const previousCurrentStatus = currentStatus;
    const optimisticSnapshot: OptimisticActionSnapshot = {
      selectedItem,
      sourceActionItems,
      totalItems,
    };

    clearWriteFeedback();

    const nextStatusLabel = toStatusLabel(nextStatusCode);
    const shouldRemoveFromList = statusFilter !== 'all' && statusFilter !== nextStatusCode;

    const optimisticAssignee = user?.name ?? user?.email ?? user?.userId;
    applyOptimisticActionPatch(
      actionId,
      {
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        ...(optimisticAssignee ? { assignee: optimisticAssignee } : {}),
      },
      shouldRemoveFromList,
    );
    setCurrentStatus(nextStatusLabel);

    if (kind === 'resolve') {
      setIsResolveSaving(true);
    } else {
      setIsStatusSaving(true);
    }

    try {
      const currentAssignee = user?.name ?? user?.email ?? user?.userId;
      await patchActionRequiredStatus(actionId, {
        status: toStatusPatchValue(nextStatusCode),
        assignee: currentAssignee,
      });
      setCurrentStatus('');
      setWriteNotice(
        shouldRemoveFromList
          ? '상태 변경으로 현재 필터 결과에서 제외되었습니다.'
          : kind === 'resolve'
            ? '이슈를 해결 완료로 저장했습니다.'
            : '상태를 저장했습니다.',
      );
      retryActionRef.current = null;

      const fallbackItem: ActionItem = {
        ...targetItem,
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        ...(currentAssignee ? { assignee: currentAssignee } : {}),
      };
      void hydrateActionItems();
      void hydrateActionDetail(actionId, fallbackItem);
    } catch (error) {
      setCurrentStatus(previousCurrentStatus);
      restoreOptimisticActionSnapshot(optimisticSnapshot);

      const mappedError = toActionWriteError(kind, error);
      setWriteError(mappedError);

      if (mappedError.retryable) {
        retryActionRef.current = () => runStatusUpdate(actionId, nextStatusCode, kind);
      } else {
        retryActionRef.current = null;
      }

      void hydrateActionItems();
      void hydrateActionDetail(actionId, previousSelectedItem);
    } finally {
      if (kind === 'resolve') {
        setIsResolveSaving(false);
      } else {
        setIsStatusSaving(false);
      }
    }
  }

  async function runMemoWrite(
    actionId: string,
    memoContent: string,
    nextStatusCode: ActionStatusCode,
  ): Promise<void> {
    if (!canWriteActionRequired) {
      setWriteError({
        kind: 'memo',
        message: '권한이 없어 메모를 저장할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    if (isWriteSaving) {
      return;
    }

    const targetItem = selectedItem?.id === actionId
      ? selectedItem
      : sourceActionItems.find((item) => item.id === actionId);
    if (!targetItem) {
      return;
    }

    const trimmedMemo = memoContent.trim();
    if (!trimmedMemo) {
      return;
    }

    const previousSelectedItem = targetItem;
    const previousCurrentStatus = currentStatus;
    const previousCurrentMemo = currentMemo;
    const optimisticSnapshot: OptimisticActionSnapshot = {
      selectedItem,
      sourceActionItems,
      totalItems,
    };

    clearWriteFeedback();

    const nextStatusLabel = toStatusLabel(nextStatusCode);
    const shouldRemoveFromList = statusFilter !== 'all' && statusFilter !== nextStatusCode;
    const createdMemo: MemoLog = {
      id: `memo-${Date.now()}`,
      content: trimmedMemo,
      timestamp: new Date().toISOString(),
      author: user?.name ?? user?.userId ?? '-',
      status: normalizeMemoStatus(nextStatusLabel),
      statusLabel: nextStatusLabel,
    };

    const currentAssignee = user?.name ?? user?.email ?? user?.userId;
    applyOptimisticActionPatch(
      actionId,
      {
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        memos: [...(targetItem.memos ?? []), createdMemo],
        ...(currentAssignee ? { assignee: currentAssignee } : {}),
      },
      shouldRemoveFromList,
    );
    setCurrentStatus(nextStatusLabel);
    setIsMemoSaving(true);
    try {
      if (targetItem.statusCode !== nextStatusCode) {
        await patchActionRequiredStatus(actionId, {
          status: toStatusPatchValue(nextStatusCode),
          assignee: currentAssignee,
        });
      }
      await patchActionRequiredMemo(actionId, { memo: trimmedMemo, assignee: currentAssignee });

      setCurrentMemo('');
      setCurrentStatus('');
      setWriteNotice(
        shouldRemoveFromList
          ? '메모와 상태가 저장되어 현재 필터 결과에서 제외되었습니다.'
          : '메모를 저장했습니다.',
      );
      retryActionRef.current = null;

      const fallbackItem: ActionItem = {
        ...targetItem,
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        memos: [...(targetItem.memos ?? []), createdMemo],
        ...(currentAssignee ? { assignee: currentAssignee } : {}),
      };
      void hydrateActionItems();
      void hydrateActionDetail(actionId, fallbackItem);
    } catch (error) {
      setCurrentStatus(previousCurrentStatus);
      setCurrentMemo(previousCurrentMemo);
      restoreOptimisticActionSnapshot(optimisticSnapshot);

      const mappedError = toActionWriteError('memo', error);
      setWriteError(mappedError);

      if (mappedError.retryable) {
        retryActionRef.current = () => runMemoWrite(actionId, memoContent, nextStatusCode);
      } else {
        retryActionRef.current = null;
      }

      void hydrateActionItems();
      void hydrateActionDetail(actionId, previousSelectedItem);
    } finally {
      setIsMemoSaving(false);
    }
  }

  const handleStatusSave = () => {
    if (!selectedItem) {
      return;
    }
    const nextStatusCode = normalizeStatusCode(currentStatus || selectedItem.status);
    if (nextStatusCode === selectedItem.statusCode) {
      setWriteError(null);
      setWriteNotice('변경된 상태가 없습니다.');
      retryActionRef.current = null;
      return;
    }
    void runStatusUpdate(selectedItem.id, nextStatusCode, 'status');
  };

  const handleMemoAdd = () => {
    if (!selectedItem) {
      return;
    }
    const memoContent = currentMemo.trim();
    if (!memoContent) {
      return;
    }
    const nextStatusCode = normalizeStatusCode(currentStatus || selectedItem.status);
    void runMemoWrite(selectedItem.id, memoContent, nextStatusCode);
  };

  const handleResolveIssue = () => {
    if (!selectedItem || isWriteSaving) {
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`"${selectedItem.type}" 이슈를 해결 완료 처리하시겠습니까?`);
      if (!confirmed) {
        return;
      }
    }

    void runStatusUpdate(selectedItem.id, 'resolved', 'resolve');
  };

  return (
    <Layout title="조치 필요 항목">
      <div className="p-6">
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="action-required-search-query"
                name="searchQuery"
                type="text"
                aria-label="차량번호 또는 고객명 검색"
                placeholder="차량번호 또는 고객명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const isSelected = selectedFilters.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleFilter(chip)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {chip}
                  {isSelected && <X className="inline-block ml-1 w-3 h-3" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <div>
              총 <span className="font-bold text-blue-600">{sortedItems.length}</span>건의 조치 필요 항목
              {null}
              {null}
            </div>

            <div className="hidden items-center gap-2" aria-hidden="true">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={isItemsLoading || page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                이전
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={isItemsLoading || page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          </div>

          {(paymentSyncError || isPaymentSyncing) && (
            <div className={`hidden items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
              paymentSyncError
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}>
              <span>
                {paymentSyncError
                  ? (
                    isPaymentSyncUsingLastKnown
                      ? '결제 상태 동기화에 실패해 마지막 정상 상태를 표시 중입니다.'
                      : paymentSyncError
                  )
                  : '결제 상태를 동기화하는 중입니다.'}
              </span>
              {paymentSyncError && (
                <button
                  type="button"
                  onClick={retryPaymentSync}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                >
                  재시도
                </button>
              )}
            </div>
          )}
        </div>

        <PageStateBoundary
          isLoading={isItemsLoading}
          error={itemsError}
          isEmpty={!isItemsLoading && !itemsError && (isActionApiEmpty || sortedItems.length === 0)}
          errorDescription="조치 필요 항목 목록을 불러오는 중 문제가 발생했습니다."
          emptyTitle="조건에 맞는 조치 항목이 없습니다"
          emptyDescription="필터나 검색어를 조정해 다시 확인해 주세요."
          onRetry={handleActionItemsRetry}
          errorActionLabel={getPageErrorActionLabel(itemsErrorKind)}
          onErrorAction={handleActionErrorAction}
          emptyActionLabel="필터 초기화"
          onEmptyAction={resetActionFilters}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                      유형
                      {sortField === 'type' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('vehicleNumber')}>
                      차량번호
                      {sortField === 'vehicleNumber' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('customerName')}>
                      고객명
                      {sortField === 'customerName' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>
                      발생일
                      {sortField === 'date' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    {isUnpaidFilterActive && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        미납금액
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('severity')}>
                      심각도
                      {sortField === 'severity' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                      상태
                      {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('assignee')}>
                      담당자
                      {sortField === 'assignee' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assets?vehicle=${encodeURIComponent(item.vehicleNumber)}`);
                        }}
                      >
                        {item.vehicleNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatActionDate(item.date)}</td>
                      {isUnpaidFilterActive && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {item.paymentInfo ? (
                            <span className="font-bold text-red-600">
                              {item.paymentInfo.totalAmount.toLocaleString()}원
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(item.severity)}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.assignee}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleOpenDetail(item)}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PageStateBoundary>

        {selectedItem && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#1e2939]">상세 정보</h2>
                <button
                  onClick={handleCloseDetail}
                  disabled={isWriteSaving}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isDetailLoading && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  상세 데이터를 불러오는 중입니다.
                </div>
              )}

              {detailError && (
                <div className={`mb-4 p-3 rounded-lg text-sm border flex items-start gap-2 ${
                  isDetailNotFound
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {writeNotice && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {writeNotice}
                </div>
              )}

              {writeError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-2">
                      <p>{writeError.message}</p>
                      {writeError.retryable && (
                        <button
                          type="button"
                          onClick={handleWriteRetry}
                          disabled={isWriteSaving}
                          className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          재시도
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">유형</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.type}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">차량번호</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.vehicleNumber}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">고객명</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.customerName}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">발생일</label>
                  <p className="text-base text-gray-900 mt-1">{formatActionDate(selectedItem.date)}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">심각도</label>
                  <p className="text-base text-gray-900 mt-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedItem.severity)}`}>
                      {selectedItem.severity}
                    </span>
                  </p>
                </div>

                {selectedItem.description && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">상세 설명</label>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{selectedItem.description}</p>
                  </div>
                )}

                {selectedItem.type === '미납/결제 문제' && selectedItem.paymentInfo && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="text-sm font-semibold text-gray-600 mb-3 block">결제 정보</label>
                    <div className="bg-red-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">결제 유형</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedItem.paymentInfo.paymentType}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">원금</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedItem.paymentInfo.amount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">연체 일수</span>
                        <span className="text-sm font-bold text-red-600">{selectedItem.paymentInfo.overdueDays}일</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">연체료</span>
                        <span className="text-sm font-semibold text-red-600">{selectedItem.paymentInfo.lateFee.toLocaleString()}원</span>
                      </div>
                      <div className="border-t border-red-200 pt-2 mt-2 flex justify-between items-center">
                        <span className="text-base font-bold text-gray-900">총 청구금액</span>
                        <span className="text-lg font-bold text-red-600">{selectedItem.paymentInfo.totalAmount.toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-600">상태 변경</label>
                  <div className="flex gap-2 mt-1">
                    <select
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentStatus || selectedItem.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        setCurrentStatus(nextStatus);
                        if (!canWriteActionRequired || isWriteSaving || !selectedItem) {
                          return;
                        }
                        const nextStatusCode = normalizeStatusCode(nextStatus);
                        if (nextStatusCode === selectedItem.statusCode) {
                          return;
                        }
                        void runStatusUpdate(selectedItem.id, nextStatusCode, 'status');
                      }}
                      disabled={!canWriteActionRequired || isWriteSaving}
                    >
                      {!STATUS_OPTIONS.includes(selectedItem.status as typeof STATUS_OPTIONS[number]) && (
                        <option value={selectedItem.status}>{selectedItem.status}</option>
                      )}
                      {STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">처리 메모</label>
                  <textarea
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="처리 내용을 입력하세요..."
                    value={currentMemo}
                    onChange={(e) => setCurrentMemo(e.target.value)}
                    disabled={!canWriteActionRequired || isWriteSaving}
                  />
                  <button
                    className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    onClick={handleMemoAdd}
                    disabled={!canWriteActionRequired || !currentMemo.trim() || isWriteSaving}
                  >
                    {isMemoSaving ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        저장중
                      </span>
                    ) : (
                      '메모 저장'
                    )}
                  </button>
                </div>

                {selectedItem.memos && selectedItem.memos.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">메모 이력</label>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedItem.memos.map((memo) => (
                        <div key={memo.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {formatActionDate(memo.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-semibold text-blue-700">{memo.author}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              memo.status === 'resolved'
                                ? 'bg-green-100 text-green-700'
                                : memo.status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}>
                              {memo.statusLabel}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{memo.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  <button
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    onClick={() => {
                      if (!canViewAssets) {
                        navigate('/forbidden');
                        return;
                      }
                      navigate(`/assets?vehicle=${encodeURIComponent(selectedItem.vehicleNumber)}`);
                    }}
                    disabled={!canViewAssets}
                  >
                    관련 자산 보기
                  </button>
                  <button
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    onClick={() => {
                      if (!canViewReservations) {
                        navigate('/forbidden');
                        return;
                      }
                      navigate(`/reservations?search=${encodeURIComponent(selectedItem.customerName)}`);
                    }}
                    disabled={!canViewReservations}
                  >
                    관련 예약 보기
                  </button>

                  {selectedItem.status !== '완료' && (
                    <button
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleResolveIssue}
                      disabled={!canWriteActionRequired || isWriteSaving}
                    >
                      {isResolveSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          해결 처리 중
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          이슈 해결 완료
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
