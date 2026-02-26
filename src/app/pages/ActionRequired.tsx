import { Layout } from '../components/Layout';
import { useSearchParams, useNavigate } from 'react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ArrowUp, ArrowDown, Clock, User, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { ApiError } from '../../services/api';
import { getActionRequiredDetail, getActionRequiredList } from '../../services/actionRequired';
import type { MemoLog } from '../data/mockData';

interface ActionItem {
  id: string;
  type: string;
  vehicleNumber: string;
  customerName: string;
  date: string;
  severity: 'High' | 'Medium' | 'Low';
  status: string;
  assignee: string;
  description?: string;
  memos?: MemoLog[];
  paymentInfo?: {
    amount: number;
    overdueDays: number;
    lateFee: number;
    totalAmount: number;
    dueDate: string;
    paymentType: string;
  };
}

type SortField = 'type' | 'vehicleNumber' | 'customerName' | 'date' | 'severity' | 'status' | 'assignee';
type SortDirection = 'asc' | 'desc' | null;
type ActionStatusFilter = 'all' | 'pending' | 'in-progress' | 'resolved';
type ActionPriorityFilter = 'all' | 'high' | 'medium' | 'low';

const STATUS_OPTIONS = ['대기중', '진행중', '완료'] as const;
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

function normalizeMemoStatus(rawValue: string | null): MemoLog['status'] {
  const normalizedLabel = normalizeStatusLabel(rawValue);
  if (normalizedLabel.includes('완료')) {
    return 'resolved';
  }
  if (normalizedLabel.includes('진행')) {
    return 'in-progress';
  }
  return 'pending';
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

  const amount = toNumberValue(paymentSource.amount);
  const dueDate = pickString(paymentSource, ['dueDate', 'paymentDueDate']);
  const overdueDays = toNumberValue(paymentSource.overdueDays) ?? 0;
  const lateFee = toNumberValue(paymentSource.lateFee) ?? 0;
  const totalAmount = toNumberValue(paymentSource.totalAmount) ?? (amount ?? 0) + lateFee;

  if (amount === null && dueDate === null && overdueDays === 0 && lateFee === 0) {
    return undefined;
  }

  return {
    amount: amount ?? 0,
    overdueDays,
    lateFee,
    totalAmount,
    dueDate: dueDate ?? '-',
    paymentType: pickString(paymentSource, ['paymentType', 'type']) ?? '-',
  };
}

function toActionItem(row: unknown, index: number, fallbackId?: string): ActionItem | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = pickString(row, ['id', 'actionId', 'actionItemId', 'paymentId']) ?? fallbackId ?? `action-${index + 1}`;
  const paymentInfo = toPaymentInfo(row);
  const type = pickString(row, ['type', 'category', 'issueType', 'issue', 'title']) ?? (paymentInfo ? '미납/결제 문제' : null);
  const vehicleNumber = pickString(row, ['vehicleNumber', 'plateNumber', 'vehicleNo', 'plate']);

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

  return {
    id,
    type,
    vehicleNumber,
    customerName: pickString(row, ['customerName', 'customer', 'customerDisplayName']) ?? '-',
    date: pickString(row, ['date', 'dueDate', 'occurredAt', 'createdAt']) ?? '-',
    severity: normalizeSeverity(pickString(row, ['severity', 'priority'])),
    status: normalizeStatusLabel(pickString(row, ['statusLabel', 'status'])),
    assignee: pickString(row, ['assignee', 'assigneeName', 'owner', 'assignedTo']) ?? '-',
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
  const [resolvedItemIds, setResolvedItemIds] = useState<Set<string>>(new Set());
  const [sourceActionItems, setSourceActionItems] = useState<ActionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);

  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailNotFound, setIsDetailNotFound] = useState(false);

  const detailRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);

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

  const {
    isLoading: isItemsLoading,
    error: itemsError,
    errorKind: itemsErrorKind,
    isEmpty: isActionApiEmpty,
    run: hydrateActionItems,
  } = usePageEndpointState<unknown>({
    request: (signal) => getActionRequiredList({
      page,
      size: pageSize,
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      assignee: assigneeFilter === 'all' ? undefined : assigneeFilter,
      signal,
    }),
    onSuccess: (payload) => {
      const { items, total } = toActionItemCollection(payload);
      setSourceActionItems(items);
      setTotalItems(total);
    },
    isEmpty: (payload) => {
      const rows = getCollectionFromPayload(payload, LIST_COLLECTION_KEYS);
      if (rows) {
        return rows.length === 0;
      }
      return isPayloadEmpty(payload, LIST_COLLECTION_KEYS);
    },
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

    if (filterParam && filterChips.includes(filterParam)) {
      setSelectedFilters([filterParam]);
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
        setIsDetailNotFound(true);
        setDetailError('선택한 항목이 존재하지 않습니다. 목록 데이터를 기준으로 표시합니다.');
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
    void hydrateActionDetail(item.id, item);
  }, [hydrateActionDetail]);

  const handleCloseDetail = useCallback(() => {
    detailControllerRef.current?.abort();
    setSelectedItem(null);
    setCurrentMemo('');
    setCurrentStatus('');
    setIsDetailLoading(false);
    setDetailError(null);
    setIsDetailNotFound(false);
  }, []);

  const assigneeOptions = Array.from(
    new Set(
      sourceActionItems
        .map((item) => item.assignee)
        .filter((assignee) => assignee && assignee !== '-'),
    ),
  ).sort((left, right) => left.localeCompare(right, 'ko'));

  const allItems: ActionItem[] = sourceActionItems.filter((item) => !resolvedItemIds.has(item.id));

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

  const handleMemoAdd = () => {
    if (selectedItem && currentMemo.trim()) {
      const statusLabel = currentStatus || selectedItem.status;
      const memoStatus = normalizeMemoStatus(statusLabel);

      const newMemo: MemoLog = {
        id: Date.now().toString(),
        content: currentMemo.trim(),
        timestamp: new Date().toISOString(),
        author: '김민수',
        status: memoStatus,
        statusLabel: statusLabel,
      };

      setSelectedItem({
        ...selectedItem,
        status: currentStatus || selectedItem.status,
        memos: [...(selectedItem.memos || []), newMemo],
      });
      setCurrentMemo('');
      setCurrentStatus('');
    }
  };

  const handleResolveIssue = () => {
    if (!selectedItem) return;

    if (confirm(`"${selectedItem.type}" 이슈를 해결 완료 처리하시겠습니까?\n\n해결된 항목은 목록에서 제거됩니다.`)) {
      setResolvedItemIds((prev) => new Set([...prev, selectedItem.id]));
      setSelectedItem(null);
      alert('✅ 이슈가 해결 완료되었습니다.\n목록에서 제거되었습니다.');
    }
  };

  return (
    <Layout title="조치 필요 항목">
      <div className="p-6">
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="차량번호 또는 고객명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ActionStatusFilter);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">상태 전체</option>
              <option value="pending">대기</option>
              <option value="in-progress">진행중</option>
              <option value="resolved">완료</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as ActionPriorityFilter);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">우선순위 전체</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">담당자 전체</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>

            <select
              value={String(pageSize)}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setPageSize(Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 20);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10개씩 보기</option>
              <option value="20">20개씩 보기</option>
              <option value="50">50개씩 보기</option>
            </select>
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
              현재 페이지 <span className="font-bold text-blue-600">{sortedItems.length}</span>건 표시
              {' · '}
              서버 집계 <span className="font-bold text-blue-600">{totalItems}</span>건
              {resolvedItemIds.size > 0 && (
                <span className="ml-2 text-green-600">
                  (해결 완료: {resolvedItemIds.size}건)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.date}</td>
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
                <button onClick={handleCloseDetail} className="p-2 hover:bg-gray-100 rounded-lg">
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
                  <p className="text-base text-gray-900 mt-1">{selectedItem.date}</p>
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

                {selectedItem.paymentInfo && (
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
                  <label className="text-sm font-semibold text-gray-600">현재 상태</label>
                  <div className="flex gap-2 mt-1">
                    <select
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentStatus || selectedItem.status}
                      onChange={(e) => setCurrentStatus(e.target.value)}
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
                  />
                  <button
                    className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    onClick={handleMemoAdd}
                    disabled={!currentMemo.trim()}
                  >
                    메모 저장
                  </button>
                </div>

                {selectedItem.memos && selectedItem.memos.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">처리 내역</label>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedItem.memos.map((memo) => (
                        <div key={memo.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {new Date(memo.timestamp).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
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
                    onClick={() => navigate(`/assets?vehicle=${encodeURIComponent(selectedItem.vehicleNumber)}`)}
                  >
                    관련 자산 보기
                  </button>
                  <button
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    onClick={() => navigate(`/reservations?search=${encodeURIComponent(selectedItem.customerName)}`)}
                  >
                    관련 예약 보기
                  </button>

                  {selectedItem.status !== '완료' && (
                    <button
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                      onClick={handleResolveIssue}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      이슈 해결 완료
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
