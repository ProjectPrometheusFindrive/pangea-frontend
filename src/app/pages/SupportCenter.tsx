import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Loader2, Paperclip, RefreshCw, Search, Send } from 'lucide-react';

import { useAuthorization } from '../context/AuthorizationContext';
import { useAuth } from '../context/AuthContext';
import { ACTION_PERMISSIONS } from '../authorization';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  usePageEndpointState,
  type PageErrorKind,
} from '../hooks/usePageEndpointState';
import { ApiError } from '../../services/api';
import {
  createSupportTicket,
  getSupportCategories,
  getSupportTicketDetail,
  listSupportTickets,
  type SupportCategory,
  type SupportTicket,
  type SupportTicketStatus,
  uploadSupportTicketAttachment,
  updateSupportTicketStatus,
} from '../../services/support';
import { formatDateTimeKst } from '../utils/dateTimeFormat';
import type { SupportCenterLocationState, SupportPrefillState } from '../utils/premiumInquiry';

type SupportField = 'companyId' | 'category' | 'title' | 'content' | 'contactPhone' | 'attachments';
type SupportFieldErrors = Partial<Record<SupportField, string>>;

interface SupportErrorState {
  message: string;
  kind: PageErrorKind;
  fieldErrors: SupportFieldErrors;
}

interface StoredSupportReceipt {
  id: string;
  companyId?: string;
  category: string;
  title: string;
  status: SupportTicketStatus;
  createdAt?: string;
  updatedAt?: string;
}

const SUPPORT_RECEIPT_STORAGE_KEY = 'pangea.support.last-ticket.v1';
const DEFAULT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_ATTACHMENT_MAX_COUNT = 3;

function toPositiveInteger(value: string | undefined, fallbackValue: number): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }
  return Math.floor(parsedValue);
}

const MAX_ATTACHMENT_BYTES = toPositiveInteger(
  import.meta.env.VITE_SUPPORT_ATTACHMENT_MAX_BYTES,
  DEFAULT_ATTACHMENT_MAX_BYTES,
);
const MAX_ATTACHMENT_COUNT = toPositiveInteger(
  import.meta.env.VITE_SUPPORT_ATTACHMENT_MAX_COUNT,
  DEFAULT_ATTACHMENT_MAX_COUNT,
);
const SUPPORT_STATUS_TRANSITIONS: Record<string, SupportTicketStatus[]> = {
  RECEIVED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const DEFAULT_SUPPORT_ADMIN_FILTERS = {
  companyId: '',
  status: '',
  from: '',
  to: '',
};

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

function readSupportPrefillState(locationState: unknown): SupportPrefillState | null {
  const nextLocationState = locationState as SupportCenterLocationState | null;
  if (!isRecord(nextLocationState) || !isRecord(nextLocationState.supportPrefill)) {
    return null;
  }

  const category = toStringValue(nextLocationState.supportPrefill.category);
  const title = toStringValue(nextLocationState.supportPrefill.title);
  const content = toStringValue(nextLocationState.supportPrefill.content);

  if (!category || !title || !content) {
    return null;
  }

  return {
    category,
    title,
    content,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${bytes}B`;
}

function formatDateTime(value?: string): string {
  return formatDateTimeKst(value, '-');
}

function normalizeSupportStatus(status: SupportTicketStatus): string {
  return String(status || 'RECEIVED').toUpperCase().replace(/-/g, '_');
}

function toSupportStatusLabel(status: SupportTicketStatus): string {
  switch (normalizeSupportStatus(status)) {
    case 'IN_PROGRESS':
      return '처리중';
    case 'RESOLVED':
      return '해결됨';
    case 'CLOSED':
      return '종료';
    case 'RECEIVED':
    default:
      return '접수됨';
  }
}

function toSupportStatusBadgeClass(status: SupportTicketStatus): string {
  switch (normalizeSupportStatus(status)) {
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-700';
    case 'RESOLVED':
      return 'bg-green-100 text-green-700';
    case 'CLOSED':
      return 'bg-gray-200 text-gray-700';
    case 'RECEIVED':
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function toErrorFieldEntries(error: ApiError): Array<{ name: string; reason: string }> {
  const entries: Array<{ name: string; reason: string }> = [];

  if (Array.isArray(error.fields)) {
    for (const fieldEntry of error.fields) {
      if (!isRecord(fieldEntry)) {
        continue;
      }

      const name = toStringValue(fieldEntry.name) ?? toStringValue(fieldEntry.field);
      const reason = toStringValue(fieldEntry.reason) ?? toStringValue(fieldEntry.message);
      if (!name || !reason) {
        continue;
      }
      entries.push({ name, reason });
    }
  }

  const payloadError = isRecord(error.payload) && isRecord(error.payload.error)
    ? error.payload.error
    : null;
  if (payloadError && Array.isArray(payloadError.details)) {
    for (const detailEntry of payloadError.details) {
      if (!isRecord(detailEntry)) {
        continue;
      }

      const name = toStringValue(detailEntry.field)
        ?? toStringValue(detailEntry.name)
        ?? toStringValue(detailEntry.path);
      const reason = toStringValue(detailEntry.message)
        ?? toStringValue(detailEntry.reason)
        ?? toStringValue(detailEntry.detail);

      if (!name || !reason) {
        continue;
      }

      entries.push({ name, reason });
    }
  }

  return entries;
}

function mapSupportFieldErrors(entries: Array<{ name: string; reason: string }>): SupportFieldErrors {
  const fieldMap: Record<string, SupportField> = {
    companyId: 'companyId',
    company_id: 'companyId',
    category: 'category',
    title: 'title',
    content: 'content',
    contactPhone: 'contactPhone',
    contact_phone: 'contactPhone',
    phone: 'contactPhone',
    attachments: 'attachments',
    files: 'attachments',
  };

  const mappedErrors: SupportFieldErrors = {};
  for (const { name, reason } of entries) {
    const targetField = fieldMap[name];
    if (!targetField || mappedErrors[targetField]) {
      continue;
    }
    mappedErrors[targetField] = reason;
  }

  return mappedErrors;
}

function toSupportErrorState(error: unknown, fallbackMessage: string): SupportErrorState {
  if (error instanceof ApiError) {
    const fieldErrors = mapSupportFieldErrors(toErrorFieldEntries(error));
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;

    if (error.status === 401 || error.code === 'UNAUTHORIZED') {
      return {
        message: '세션이 만료되었습니다. 로그인 후 다시 시도해 주세요.',
        kind: 'unauthorized',
        fieldErrors,
      };
    }

    if (error.status === 403 || error.code === 'FORBIDDEN') {
      return {
        message: '고객센터 기능에 접근할 권한이 없습니다.',
        kind: 'forbidden',
        fieldErrors,
      };
    }

    const isRetryable = (
      (error.status !== undefined && error.status >= 500)
      || error.code === 'NETWORK_ERROR'
      || error.code === 'TIMEOUT'
      || error.code === 'SERVER_ERROR'
      || error.code === 'ABORTED'
    );

    if (isRetryable) {
      return {
        message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        kind: 'retryable',
        fieldErrors,
      };
    }

    if (error.status === 400 || error.code === 'VALIDATION_ERROR' || hasFieldErrors) {
      if (error.message.includes('companyId is required for super_admin')) {
        return {
          message: '조회할 회사를 지정한 뒤 다시 시도해 주세요.',
          kind: 'unknown',
          fieldErrors,
        };
      }
      return {
        message: hasFieldErrors ? '입력값을 확인해 주세요.' : (error.message || fallbackMessage),
        kind: 'unknown',
        fieldErrors,
      };
    }

    return {
      message: error.message || fallbackMessage,
      kind: 'unknown',
      fieldErrors,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      message: error.message,
      kind: 'unknown',
      fieldErrors: {},
    };
  }

  return {
    message: fallbackMessage,
    kind: 'unknown',
    fieldErrors: {},
  };
}

function toSupportTicketReceipt(ticket: SupportTicket): StoredSupportReceipt {
  return {
    id: ticket.id,
    companyId: ticket.companyId,
    category: ticket.category,
    title: ticket.title,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function saveSupportReceipt(ticket: SupportTicket): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      SUPPORT_RECEIPT_STORAGE_KEY,
      JSON.stringify(toSupportTicketReceipt(ticket)),
    );
  } catch {
    // storage 접근이 제한된 환경에서는 저장을 건너뛴다.
  }
}

function readSupportReceipt(): StoredSupportReceipt | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(SUPPORT_RECEIPT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isRecord(parsedValue)) {
      return null;
    }

    const id = toStringValue(parsedValue.id);
    const category = toStringValue(parsedValue.category);
    const title = toStringValue(parsedValue.title);
    if (!id || !category || !title) {
      return null;
    }

    return {
      id,
      companyId: toStringValue(parsedValue.companyId) ?? undefined,
      category,
      title,
      status: normalizeSupportStatus(toStringValue(parsedValue.status) ?? 'RECEIVED'),
      createdAt: toStringValue(parsedValue.createdAt) ?? undefined,
      updatedAt: toStringValue(parsedValue.updatedAt) ?? undefined,
    };
  } catch {
    return null;
  }
}

function restoreTicketFromReceipt(receipt: StoredSupportReceipt): SupportTicket {
  return {
    id: receipt.id,
    companyId: receipt.companyId,
    category: receipt.category,
    title: receipt.title,
    content: '',
    status: receipt.status,
    replyHistory: [],
    statusHistory: [],
    attachments: [],
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };
}

function buildSubmitFingerprint(payload: {
  companyId: string;
  category: string;
  title: string;
  content: string;
  contactPhone: string;
  attachments: File[];
}): string {
  return JSON.stringify({
    companyId: payload.companyId,
    category: payload.category,
    title: payload.title,
    content: payload.content,
    contactPhone: payload.contactPhone,
    attachments: payload.attachments.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
  });
}

function isSameSupportTicket(left: SupportTicket | null, right: SupportTicket | null): boolean {
  if (!left || !right) {
    return false;
  }

  return (left.companyId ?? '') === (right.companyId ?? '') && left.id === right.id;
}

function toSupportTicketRowTestId(ticket: SupportTicket): string {
  return `support-admin-ticket-row-${ticket.companyId ?? 'unknown'}-${ticket.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function SupportAttachmentList({
  attachments,
  title = '첨부파일',
}: {
  attachments: SupportTicket['attachments'];
  title?: string;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <ul className="mt-3 space-y-2">
        {attachments.map((attachment, index) => (
          <li
            key={`${attachment.fileName}-${attachment.sizeBytes ?? 0}-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            <Paperclip className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-medium text-gray-900">{attachment.fileName}</span>
            {typeof attachment.sizeBytes === 'number' && (
              <span className="text-xs text-gray-500">({formatBytes(attachment.sizeBytes)})</span>
            )}
            {attachment.contentType && (
              <span className="rounded bg-white px-2 py-0.5 text-xs text-gray-500">{attachment.contentType}</span>
            )}
            {attachment.url ? (
              <>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-white px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  열기
                </a>
                <a
                  href={attachment.url}
                  download={attachment.fileName}
                  className="rounded bg-white px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  다운로드
                </a>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SupportAdminManagementView({
  canUpdateStatus,
  isSuperAdmin,
  onOpenSubmitView,
}: {
  canUpdateStatus: boolean;
  isSuperAdmin: boolean;
  onOpenSubmitView?: () => void;
}) {
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState(DEFAULT_SUPPORT_ADMIN_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_SUPPORT_ADMIN_FILTERS);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketsError, setTicketsError] = useState<SupportErrorState | null>(null);
  const [detailError, setDetailError] = useState<SupportErrorState | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<SupportErrorState | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusDraft, setStatusDraft] = useState<SupportTicketStatus>('IN_PROGRESS');
  const [statusNote, setStatusNote] = useState('');
  const detailRequestSeqRef = useRef(0);
  const detailAbortControllerRef = useRef<AbortController | null>(null);

  const isShowingStaleTickets = Boolean(ticketsError) && tickets.length > 0;

  const availableStatusTransitions = useMemo<SupportTicketStatus[]>(() => {
    if (!canUpdateStatus) {
      return [];
    }
    return SUPPORT_STATUS_TRANSITIONS[normalizeSupportStatus(selectedTicket?.status ?? 'RECEIVED')] ?? [];
  }, [canUpdateStatus, selectedTicket]);

  useEffect(() => {
    if (!selectedTicket) {
      setStatusDraft('IN_PROGRESS');
      setStatusNote('');
      setStatusUpdateError(null);
      setStatusUpdateSuccess(null);
      return;
    }

    setStatusDraft(availableStatusTransitions[0] ?? normalizeSupportStatus(selectedTicket.status));
    setStatusNote('');
    setStatusUpdateError(null);
  }, [availableStatusTransitions, selectedTicket]);

  useEffect(() => {
    const abortController = new AbortController();
    let isActive = true;

    setIsTicketsLoading(true);
    setTicketsError(null);

    void listSupportTickets({
      limit: 200,
      offset: 0,
      companyId: appliedFilters.companyId || undefined,
      status: appliedFilters.status,
      from: appliedFilters.from,
      to: appliedFilters.to,
      signal: abortController.signal,
    }).then((items) => {
      if (!isActive) {
        return;
      }

      setTickets(items);
      setSelectedTicket((previousTicket) => {
        if (!previousTicket) {
          return null;
        }

        const matchedTicket = items.find((item) => isSameSupportTicket(item, previousTicket));
        return matchedTicket ?? null;
      });
    }).catch((error) => {
      if (!isActive || (error instanceof ApiError && error.code === 'ABORTED')) {
        return;
      }

      setSelectedTicket(null);
      setDetailError(null);
      setStatusUpdateError(null);
      setStatusUpdateSuccess(null);
      setTicketsError(toSupportErrorState(error, '문의 목록을 불러오는 중 오류가 발생했습니다.'));
    }).finally(() => {
      if (!isActive) {
        return;
      }
      setIsTicketsLoading(false);
    });

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [appliedFilters, reloadNonce]);

  const openTicketDetail = useCallback(async (ticket: SupportTicket) => {
    detailAbortControllerRef.current?.abort();
    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;
    const abortController = new AbortController();
    detailAbortControllerRef.current = abortController;

    setSelectedTicket(ticket);
    setDetailError(null);
    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);
    setIsDetailLoading(true);

    try {
      const detail = await getSupportTicketDetail(ticket.id, {
        companyId: ticket.companyId,
        signal: abortController.signal,
      });
      if (detailRequestSeqRef.current !== requestSeq) {
        return;
      }
      setSelectedTicket(detail);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ABORTED') {
        return;
      }
      if (detailRequestSeqRef.current !== requestSeq) {
        return;
      }
      setSelectedTicket(ticket);
      setDetailError(toSupportErrorState(error, '문의 상세를 불러오는 중 오류가 발생했습니다.'));
    } finally {
      if (detailRequestSeqRef.current !== requestSeq) {
        return;
      }
      detailAbortControllerRef.current = null;
      setIsDetailLoading(false);
    }
  }, []);

  const handleAdminFilterSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    detailAbortControllerRef.current?.abort();
    setSelectedTicket(null);
    setDetailError(null);
    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);
    setAppliedFilters({ ...draftFilters });
  }, [draftFilters]);

  const handleAdminFilterReset = useCallback(() => {
    detailAbortControllerRef.current?.abort();
    setDraftFilters({ ...DEFAULT_SUPPORT_ADMIN_FILTERS });
    setAppliedFilters({ ...DEFAULT_SUPPORT_ADMIN_FILTERS });
    setSelectedTicket(null);
    setDetailError(null);
    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);
    setReloadNonce((previousValue) => previousValue + 1);
  }, []);

  const handleTicketsErrorAction = useCallback(() => {
    if (!ticketsError) {
      return;
    }
    handlePageErrorAction(ticketsError.kind, navigate);
  }, [navigate, ticketsError]);

  const handleDetailErrorAction = useCallback(() => {
    if (!detailError) {
      return;
    }
    handlePageErrorAction(detailError.kind, navigate);
  }, [detailError, navigate]);

  const submitStatusUpdate = useCallback(async () => {
    if (!canUpdateStatus || !selectedTicket || availableStatusTransitions.length === 0 || isStatusUpdating) {
      return;
    }

    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);
    setIsStatusUpdating(true);

    try {
      const updatedTicket = await updateSupportTicketStatus(
        selectedTicket.id,
        {
          status: statusDraft,
          replyContent: statusNote,
        },
        {
          companyId: selectedTicket.companyId,
        },
      );

      setSelectedTicket(updatedTicket);
      setTickets((previousTickets) => previousTickets.map((ticket) => (
        isSameSupportTicket(ticket, selectedTicket)
          ? { ...ticket, ...updatedTicket }
          : ticket
      )));
      setStatusUpdateSuccess('문의 상태가 업데이트되었습니다.');
      setReloadNonce((previousValue) => previousValue + 1);
    } catch (error) {
      setStatusUpdateError(toSupportErrorState(error, '문의 상태 변경 중 오류가 발생했습니다.'));
    } finally {
      setIsStatusUpdating(false);
    }
  }, [availableStatusTransitions.length, canUpdateStatus, isStatusUpdating, selectedTicket, statusDraft, statusNote]);

  const ticketsErrorActionLabel = getPageErrorActionLabel(ticketsError?.kind ?? null);
  const detailErrorActionLabel = getPageErrorActionLabel(detailError?.kind ?? null);
  const statusUpdateErrorActionLabel = getPageErrorActionLabel(statusUpdateError?.kind ?? null);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="rounded-lg bg-gradient-to-r from-slate-800 to-blue-700 px-5 py-4 text-white">
        <h2 className="text-lg font-bold" data-testid="support-admin-heading">고객센터 문의 관리</h2>
        <p className="mt-1 text-sm text-blue-100">
          전체 테넌트 문의를 조회하고 상태를 업데이트할 수 있습니다.
        </p>
      </div>

        {onOpenSubmitView && (
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="support-admin-open-submit"
              onClick={() => navigate('?mode=submit')}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              문의 등록
            </button>
          </div>
        )}

        <form onSubmit={handleAdminFilterSubmit} className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">필터</h3>
              <p className="mt-1 text-sm text-gray-500">기본 진입 시 전체 테넌트 문의를 바로 로드합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAdminFilterReset}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                초기화
              </button>
              <button
                type="submit"
                data-testid="support-admin-filter-apply"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                필터 적용
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="support-admin-filter-company" className="mb-1 block text-sm font-semibold text-gray-700">
                테넌트
              </label>
              <input
                id="support-admin-filter-company"
                data-testid="support-admin-filter-company"
                type="text"
                value={draftFilters.companyId}
                onChange={(event) => setDraftFilters((previousValue) => ({
                  ...previousValue,
                  companyId: event.target.value,
                }))}
                placeholder="예) C1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="support-admin-filter-status" className="mb-1 block text-sm font-semibold text-gray-700">
                상태
              </label>
              <select
                id="support-admin-filter-status"
                value={draftFilters.status}
                onChange={(event) => setDraftFilters((previousValue) => ({
                  ...previousValue,
                  status: event.target.value,
                }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">전체 상태</option>
                <option value="RECEIVED">접수됨</option>
                <option value="IN_PROGRESS">처리중</option>
                <option value="RESOLVED">해결됨</option>
                <option value="CLOSED">종료</option>
              </select>
            </div>

            <div>
              <label htmlFor="support-admin-filter-from" className="mb-1 block text-sm font-semibold text-gray-700">
                시작일
              </label>
              <input
                id="support-admin-filter-from"
                type="date"
                value={draftFilters.from}
                onChange={(event) => setDraftFilters((previousValue) => ({
                  ...previousValue,
                  from: event.target.value,
                }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="support-admin-filter-to" className="mb-1 block text-sm font-semibold text-gray-700">
                종료일
              </label>
              <input
                id="support-admin-filter-to"
                type="date"
                value={draftFilters.to}
                onChange={(event) => setDraftFilters((previousValue) => ({
                  ...previousValue,
                  to: event.target.value,
                }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </form>

        {ticketsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{ticketsError.message}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReloadNonce((previousValue) => previousValue + 1)}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                다시 시도
              </button>
              {ticketsErrorActionLabel && (
                <button
                  type="button"
                  onClick={handleTicketsErrorAction}
                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  {ticketsErrorActionLabel}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">문의 목록</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {isShowingStaleTickets
                    ? `재조회 실패로 이전 조회 결과 ${tickets.length}건을 표시 중입니다.`
                    : `현재 조건에 맞는 문의 ${tickets.length}건`}
                </p>
              </div>
              {isTicketsLoading && (
                <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  불러오는 중...
                </div>
              )}
            </div>

            {isTicketsLoading && tickets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                문의 목록을 불러오는 중입니다.
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                필터 조건에 맞는 문의가 없습니다.
              </div>
            ) : (
              <div className="space-y-3" data-testid="support-admin-ticket-list">
                {tickets.map((ticket) => {
                  const isSelected = isSameSupportTicket(ticket, selectedTicket);
                  return (
                    <button
                      key={`${ticket.companyId ?? 'unknown'}-${ticket.id}`}
                      type="button"
                      data-testid={toSupportTicketRowTestId(ticket)}
                      onClick={() => {
                        if (isShowingStaleTickets) {
                          return;
                        }
                        void openTicketDetail(ticket);
                      }}
                      disabled={isShowingStaleTickets}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'
                      } ${isShowingStaleTickets ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{ticket.id}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {ticket.companyId ?? '-'}
                          </span>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toSupportStatusBadgeClass(ticket.status)}`}>
                          {toSupportStatusLabel(ticket.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900">{ticket.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span>카테고리: {ticket.category}</span>
                        <span>등록: {formatDateTime(ticket.createdAt)}</span>
                        {ticket.requesterName && <span>요청자: {ticket.requesterName}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">문의 상세</h3>
                <p className="mt-1 text-sm text-gray-500">목록에서 문의를 선택하면 상세와 상태 변경이 가능합니다.</p>
              </div>
              {isDetailLoading && (
                <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  불러오는 중...
                </div>
              )}
            </div>

            {detailError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{detailError.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  {selectedTicket && (
                    <button
                      type="button"
                      onClick={() => {
                        void openTicketDetail(selectedTicket);
                      }}
                      className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      다시 시도
                    </button>
                  )}
                  {detailErrorActionLabel && (
                    <button
                      type="button"
                      onClick={handleDetailErrorAction}
                      className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      {detailErrorActionLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            {statusUpdateError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{statusUpdateError.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  {statusUpdateError.kind === 'retryable' && (
                    <button
                      type="button"
                      onClick={() => {
                        void submitStatusUpdate();
                      }}
                      className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      다시 시도
                    </button>
                  )}
                  {statusUpdateErrorActionLabel && (
                    <button
                      type="button"
                      onClick={() => handlePageErrorAction(statusUpdateError.kind, navigate)}
                      className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      {statusUpdateErrorActionLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            {statusUpdateSuccess && (
              <div
                className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                data-testid="support-admin-status-success"
              >
                {statusUpdateSuccess}
              </div>
            )}

            {!selectedTicket ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                왼쪽 목록에서 문의를 선택해 주세요.
              </div>
            ) : (
              <div className="space-y-4" data-testid="support-admin-detail">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{selectedTicket.id}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toSupportStatusBadgeClass(selectedTicket.status)}`}
                      data-testid="support-admin-detail-status"
                    >
                      {toSupportStatusLabel(selectedTicket.status)}
                    </span>
                  </div>

                  <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-gray-500">테넌트</dt>
                      <dd className="font-medium text-gray-900" data-testid="support-admin-detail-company">
                        {selectedTicket.companyId ?? '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">카테고리</dt>
                      <dd className="font-medium text-gray-900">{selectedTicket.category}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">요청자</dt>
                      <dd className="font-medium text-gray-900">{selectedTicket.requesterName ?? selectedTicket.requesterUserId ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">등록 일시</dt>
                      <dd className="font-medium text-gray-900">{formatDateTime(selectedTicket.createdAt)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-gray-500">제목</dt>
                      <dd className="font-medium text-gray-900">{selectedTicket.title}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-gray-500">내용</dt>
                      <dd className="whitespace-pre-wrap font-medium text-gray-900">{selectedTicket.content || '-'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-gray-500">Reply</dt>
                      <dd className="whitespace-pre-wrap font-medium text-gray-900" data-testid="support-detail-reply-content">
                        {selectedTicket.replyContent || '-'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {selectedTicket.attachments.length > 0 && (
                  <SupportAttachmentList attachments={selectedTicket.attachments} />
                )}

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  {!canUpdateStatus && (
                    <p className="mb-2 text-sm text-gray-500">테넌트 관리자 계정은 문의 상태를 변경할 수 없습니다. 상세 조회만 가능합니다.</p>
                  )}
                  <h4 className="text-sm font-semibold text-gray-900">상태 변경</h4>
                  {!canUpdateStatus ? null : availableStatusTransitions.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">현재 상태에서는 추가 전이가 없습니다.</p>
                  ) : (
                    <>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label htmlFor="support-admin-status-select" className="mb-1 block text-sm font-medium text-gray-700">
                            다음 상태
                          </label>
                          <select
                            id="support-admin-status-select"
                            value={statusDraft}
                            onChange={(event) => setStatusDraft(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            {availableStatusTransitions.map((statusValue) => (
                              <option key={statusValue} value={statusValue}>
                                {toSupportStatusLabel(statusValue)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="support-admin-status-note" className="mb-1 block text-sm font-medium text-gray-700">
                            답변 내용 (선택)
                          </label>
                          <textarea
                            id="support-admin-status-note"
                            data-testid="support-admin-status-note"
                            value={statusNote}
                            onChange={(event) => setStatusNote(event.target.value)}
                            rows={3}
                            placeholder="고객에게 표시할 답변 내용을 입력할 수 있습니다."
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          data-testid="support-admin-status-submit"
                          onClick={() => {
                            void submitStatusUpdate();
                          }}
                          disabled={isStatusUpdating || isShowingStaleTickets}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                          {isStatusUpdating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              저장 중...
                            </>
                          ) : (
                            '상태 변경'
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {selectedTicket.replyHistory.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-gray-900">Reply history</h4>
                    <ul className="mt-3 space-y-2">
                      {selectedTicket.replyHistory.map((entry, index) => (
                        <li
                          key={`${selectedTicket.companyId ?? 'unknown'}-${selectedTicket.id}-reply-${index + 1}`}
                          className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.repliedAt && <span className="text-xs text-gray-500">{formatDateTime(entry.repliedAt)}</span>}
                            {entry.repliedBy && <span className="text-xs text-gray-500">{entry.repliedBy}</span>}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{entry.content}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isSuperAdmin && selectedTicket.statusHistory.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-gray-900">상태 이력</h4>
                    <ul className="mt-3 space-y-2">
                      {selectedTicket.statusHistory.map((entry, index) => (
                        <li
                          key={`${selectedTicket.companyId ?? 'unknown'}-${selectedTicket.id}-history-${index + 1}`}
                          className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                              {toSupportStatusLabel(entry.to)}
                            </span>
                            {entry.changedAt && <span className="text-xs text-gray-500">{formatDateTime(entry.changedAt)}</span>}
                            {entry.changedBy && <span className="text-xs text-gray-500">{entry.changedBy}</span>}
                          </div>
                          {entry.note && (
                            <p className="mt-1 text-xs text-gray-500">{entry.note}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

function SupportTicketSubmitView({
  canManageSupport,
  isSuperAdmin,
}: {
  canManageSupport: boolean;
  isSuperAdmin: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [manualCategoryMode, setManualCategoryMode] = useState(false);

  const [companyId, setCompanyId] = useState('');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [fieldErrors, setFieldErrors] = useState<SupportFieldErrors>({});
  const [submitError, setSubmitError] = useState<SupportErrorState | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const appliedSupportPrefillRef = useRef<string | null>(null);
  const lastSubmitFingerprintRef = useRef<string | null>(null);
  const lastSubmitAtRef = useRef<number>(0);

  const [receiptTicket, setReceiptTicket] = useState<SupportTicket | null>(null);
  const [lookupTicketId, setLookupTicketId] = useState('');
  const [lookupTicket, setLookupTicket] = useState<SupportTicket | null>(null);
  const [lookupError, setLookupError] = useState<SupportErrorState | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const supportPrefill = useMemo(() => readSupportPrefillState(location.state), [location.state]);
  const supportPrefillFingerprint = useMemo(
    () => (supportPrefill ? JSON.stringify(supportPrefill) : null),
    [supportPrefill],
  );
  const normalizedCompanyId = companyId.trim();
  const attachmentCompanyId = isSuperAdmin
    ? normalizedCompanyId
    : (user?.companyId?.trim() ?? normalizedCompanyId);

  useEffect(() => {
    const storedReceipt = readSupportReceipt();
    if (!storedReceipt) {
      return;
    }

    const restoredTicket = restoreTicketFromReceipt(storedReceipt);
    setReceiptTicket(restoredTicket);
    setLookupTicket(restoredTicket);
    setLookupTicketId(restoredTicket.id);
    setCompanyId((previousValue) => previousValue || restoredTicket.companyId || '');
    setSubmitSuccessMessage(`최근 접수 내역(${restoredTicket.id})을 복구했습니다.`);
  }, []);

  useEffect(() => {
    if (!supportPrefill || !supportPrefillFingerprint) {
      return;
    }
    if (appliedSupportPrefillRef.current === supportPrefillFingerprint) {
      return;
    }

    setCategory((previousValue) => previousValue.trim().length > 0 ? previousValue : supportPrefill.category);
    setTitle((previousValue) => previousValue.trim().length > 0 ? previousValue : supportPrefill.title);
    setContent((previousValue) => previousValue.trim().length > 0 ? previousValue : supportPrefill.content);
    appliedSupportPrefillRef.current = supportPrefillFingerprint;
  }, [supportPrefill, supportPrefillFingerprint]);

  const requestSupportCategories = useCallback((signal: AbortSignal) => (
    getSupportCategories({ signal })
  ), []);

  const handleSupportCategoriesSuccess = useCallback((payload: SupportCategory[]) => {
    setCategories(payload);
    if (payload.length > 0) {
      setCategory((previousCategory) => {
        if (previousCategory) {
          return previousCategory;
        }
        return payload[0].name;
      });
    }
  }, []);

  const isSupportCategoriesEmpty = useCallback((payload: SupportCategory[]) => payload.length === 0, []);

  const {
    isLoading: isCategoriesLoading,
    error: categoriesError,
    errorKind: categoriesErrorKind,
    isEmpty: categoriesEmpty,
    run: hydrateCategories,
  } = usePageEndpointState<SupportCategory[]>({
    request: requestSupportCategories,
    onSuccess: handleSupportCategoriesSuccess,
    isEmpty: isSupportCategoriesEmpty,
  });

  useEffect(() => {
    void hydrateCategories();
  }, [hydrateCategories]);

  useEffect(() => {
    if ((categoriesEmpty || categoriesError) && !manualCategoryMode) {
      setManualCategoryMode(true);
    }
  }, [categoriesEmpty, categoriesError, manualCategoryMode]);

  useEffect(() => {
    if (!supportPrefill?.category || categories.length === 0) {
      return;
    }
    if (categories.some((item) => item.name === supportPrefill.category)) {
      return;
    }
    setManualCategoryMode(true);
  }, [categories, supportPrefill]);

  const handleCategoryErrorAction = useCallback(() => {
    handlePageErrorAction(categoriesErrorKind, navigate);
  }, [categoriesErrorKind, navigate]);

  const clearFieldError = useCallback((target: SupportField) => {
    setFieldErrors((previousErrors) => {
      if (!previousErrors[target]) {
        return previousErrors;
      }

      const nextErrors = { ...previousErrors };
      delete nextErrors[target];
      return nextErrors;
    });
  }, []);

  const handleAttachmentsChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';

    setSubmitError(null);
    clearFieldError('attachments');

    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > MAX_ATTACHMENT_COUNT) {
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        attachments: `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.`,
      }));
      return;
    }

    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversizedFiles.length > 0) {
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        attachments: `파일당 최대 ${formatBytes(MAX_ATTACHMENT_BYTES)}까지 첨부할 수 있습니다.`,
      }));
      return;
    }

    setAttachments(selectedFiles);
  }, [clearFieldError]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((previousFiles) => previousFiles.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const submitSupportTicket = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setSubmitError(null);
    setSubmitSuccessMessage(null);

    const normalizedCategory = category.trim();
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    const normalizedContactPhone = contactPhone.trim();

    const nextFieldErrors: SupportFieldErrors = {};
    if (isSuperAdmin && !normalizedCompanyId) {
      nextFieldErrors.companyId = '회사 ID를 입력해 주세요.';
    }
    if (!normalizedCategory) {
      nextFieldErrors.category = '문의 카테고리를 선택하거나 입력해 주세요.';
    }
    if (!normalizedTitle) {
      nextFieldErrors.title = '문의 제목을 입력해 주세요.';
    }
    if (!normalizedContent) {
      nextFieldErrors.content = '문의 내용을 입력해 주세요.';
    }
    if (!normalizedContactPhone) {
      nextFieldErrors.contactPhone = '연락처를 입력해 주세요.';
    }
    if (attachments.length > MAX_ATTACHMENT_COUNT) {
      nextFieldErrors.attachments = `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.`;
    }

    const oversizedFiles = attachments.filter((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversizedFiles.length > 0) {
      nextFieldErrors.attachments = `파일당 최대 ${formatBytes(MAX_ATTACHMENT_BYTES)}까지 첨부할 수 있습니다.`;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSubmitError({
        message: '입력값을 확인해 주세요.',
        kind: 'unknown',
        fieldErrors: nextFieldErrors,
      });
      return;
    }

    const fingerprint = buildSubmitFingerprint({
      category: normalizedCategory,
      title: normalizedTitle,
      content: normalizedContent,
      contactPhone: normalizedContactPhone,
      attachments,
    });
    const now = Date.now();
    if (fingerprint === lastSubmitFingerprintRef.current && now - lastSubmitAtRef.current < 1500) {
      setSubmitError({
        message: '중복 제출을 방지하기 위해 잠시 후 다시 시도해 주세요.',
        kind: 'unknown',
        fieldErrors: {},
      });
      return;
    }
    lastSubmitFingerprintRef.current = fingerprint;
    lastSubmitAtRef.current = now;

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const uploadedAttachments = await Promise.all(
        attachments.map((file) => uploadSupportTicketAttachment(file, attachmentCompanyId)),
      );
      const createdTicket = await createSupportTicket({
        companyId: normalizedCompanyId || undefined,
        category: normalizedCategory,
        title: normalizedTitle,
        content: normalizedContent,
        contactPhone: normalizedContactPhone,
        attachments: uploadedAttachments,
      });

      setReceiptTicket(createdTicket);
      setLookupTicket(createdTicket);
      setLookupTicketId(createdTicket.id);
      setCompanyId((previousValue) => previousValue || createdTicket.companyId || normalizedCompanyId);
      setSubmitSuccessMessage(`문의가 접수되었습니다. 접수번호 ${createdTicket.id}`);
      saveSupportReceipt(createdTicket);

      setTitle('');
      setContent('');
      setContactPhone('');
      setAttachments([]);
    } catch (error) {
      const nextErrorState = toSupportErrorState(error, '문의 접수 중 오류가 발생했습니다.');
      setSubmitError(nextErrorState);
      setFieldErrors(nextErrorState.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }, [attachmentCompanyId, attachments, category, contactPhone, content, isSubmitting, isSuperAdmin, normalizedCompanyId, title]);

  const refreshTicketStatus = useCallback(async (inputTicketId?: string) => {
    const targetTicketId = (inputTicketId ?? lookupTicketId).trim();
    const lookupCompanyId = isSuperAdmin
      ? (normalizedCompanyId || lookupTicket?.companyId || receiptTicket?.companyId || '')
      : undefined;
    if (!targetTicketId) {
      setLookupError({
        message: '조회할 접수번호를 입력해 주세요.',
        kind: 'unknown',
        fieldErrors: {},
      });
      return;
    }
    if (isSuperAdmin && !lookupCompanyId) {
      setLookupError({
        message: '최고 관리자는 조회할 회사 ID를 입력해 주세요.',
        kind: 'unknown',
        fieldErrors: {},
      });
      return;
    }

    setLookupError(null);
    setIsLookupLoading(true);

    try {
      const detailedTicket = await getSupportTicketDetail(targetTicketId, {
        companyId: lookupCompanyId || undefined,
      });
      setLookupTicket(detailedTicket);
      setLookupTicketId(detailedTicket.id);
      setCompanyId((previousValue) => previousValue || detailedTicket.companyId || lookupCompanyId);

      if (receiptTicket && receiptTicket.id.toUpperCase() === detailedTicket.id.toUpperCase()) {
        setReceiptTicket(detailedTicket);
      }

      saveSupportReceipt(detailedTicket);
    } catch (error) {
      const nextLookupError = toSupportErrorState(error, '문의 상태 조회 중 오류가 발생했습니다.');
      setLookupError(nextLookupError);
    } finally {
      setIsLookupLoading(false);
    }
  }, [isSuperAdmin, lookupTicket?.companyId, lookupTicketId, normalizedCompanyId, receiptTicket]);

  const handleLookupErrorAction = useCallback(() => {
    if (!lookupError) {
      return;
    }

    if (lookupError.kind === 'unauthorized' || lookupError.kind === 'forbidden') {
      handlePageErrorAction(lookupError.kind, navigate);
    }
  }, [lookupError, navigate]);

  const lookupErrorActionLabel = useMemo(() => {
    if (!lookupError) {
      return undefined;
    }
    return getPageErrorActionLabel(lookupError.kind);
  }, [lookupError]);
  const categoryErrorActionLabel = getPageErrorActionLabel(categoriesErrorKind);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="rounded-lg bg-gradient-to-r from-slate-800 to-blue-700 px-5 py-4 text-white">
        <h2 className="text-lg font-bold">지원 문의 접수</h2>
        <p className="mt-1 text-sm text-blue-100">
          문의 등록 후 접수번호로 상태를 조회할 수 있습니다.
        </p>
      </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">문의 등록</h3>
              <p className="mt-1 text-sm text-gray-500">
                첨부파일은 최대 {MAX_ATTACHMENT_COUNT}개, 파일당 {formatBytes(MAX_ATTACHMENT_BYTES)}까지 가능합니다.
              </p>
            </div>
            {canManageSupport && !supportPrefill && (
              <button
                type="button"
                data-testid="support-submit-open-manage"
                onClick={() => navigate('/support-center?mode=manage')}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                관리 화면으로
              </button>
            )}
            {categories.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setManualCategoryMode((previousMode) => !previousMode);
                  clearFieldError('category');
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {manualCategoryMode ? '목록 선택 모드' : '직접 입력 모드'}
              </button>
            )}
          </div>

          {isCategoriesLoading && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              카테고리 목록을 불러오는 중입니다. 목록이 없어도 직접 입력으로 문의를 접수할 수 있습니다.
            </div>
          )}

          {categoriesError && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <div>카테고리 목록을 불러오지 못했습니다. 직접 입력으로 문의를 접수할 수 있습니다.</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void hydrateCategories();
                  }}
                  className="inline-flex items-center rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  카테고리 다시 불러오기
                </button>
                {categoryErrorActionLabel && (
                  <button
                    type="button"
                    onClick={handleCategoryErrorAction}
                    className="inline-flex items-center rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    {categoryErrorActionLabel}
                  </button>
                )}
              </div>
            </div>
          )}

          {!categoriesError && categoriesEmpty && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              사용 가능한 문의 카테고리가 없어 직접 입력 모드로 접수할 수 있습니다.
            </div>
          )}

          {(submitError || submitSuccessMessage) && (
            <div
              className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                submitError
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-green-200 bg-green-50 text-green-700'
              }`}
            >
              <div>{submitError?.message ?? submitSuccessMessage}</div>
              {submitError?.kind === 'retryable' && (
                <button
                  type="button"
                  onClick={() => {
                    void submitSupportTicket();
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  재시도
                </button>
              )}
              {(submitError?.kind === 'unauthorized' || submitError?.kind === 'forbidden') && (
                <button
                  type="button"
                  onClick={() => handlePageErrorAction(submitError.kind, navigate)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  {submitError.kind === 'unauthorized' ? '로그인으로 이동' : '홈으로 이동'}
                </button>
              )}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitSupportTicket();
            }}
            className="space-y-4"
          >
              {isSuperAdmin && (
                <div>
                  <label htmlFor="support-company-id" className="mb-1 block text-sm font-semibold text-gray-700">
                    회사 ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="support-company-id"
                    data-testid="support-company-id"
                    type="text"
                    value={companyId}
                    onChange={(event) => {
                      setCompanyId(event.target.value);
                      clearFieldError('companyId');
                    }}
                    placeholder="예: C1"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="mt-1 text-xs text-gray-500">최고 관리자는 접수 및 조회 대상 회사를 직접 지정해야 합니다.</p>
                  {fieldErrors.companyId && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.companyId}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="support-category" className="mb-1 block text-sm font-semibold text-gray-700">
                  문의 카테고리 <span className="text-red-600">*</span>
                </label>
                {manualCategoryMode || categories.length === 0 ? (
                  <input
                    id="support-category"
                    type="text"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      clearFieldError('category');
                    }}
                    placeholder="예) 결제 오류, 시스템 장애"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                ) : (
                  <select
                    id="support-category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      clearFieldError('category');
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {categories.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.category && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="support-title" className="mb-1 block text-sm font-semibold text-gray-700">
                  문의 제목 <span className="text-red-600">*</span>
                </label>
                <input
                  id="support-title"
                  type="text"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    clearFieldError('title');
                  }}
                  placeholder="문의 제목을 입력해 주세요."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
                )}
              </div>

              <div>
                <label htmlFor="support-content" className="mb-1 block text-sm font-semibold text-gray-700">
                  문의 내용 <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="support-content"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    clearFieldError('content');
                  }}
                  placeholder="문제 상황과 재현 방법을 자세히 입력해 주세요."
                  rows={6}
                  className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {fieldErrors.content && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.content}</p>
                )}
              </div>

              <div>
                <label htmlFor="support-contact-phone" className="mb-1 block text-sm font-semibold text-gray-700">
                  연락처 <span className="text-red-600">*</span>
                </label>
                <input
                  id="support-contact-phone"
                  type="tel"
                  inputMode="tel"
                  value={contactPhone}
                  onChange={(event) => {
                    setContactPhone(event.target.value);
                    clearFieldError('contactPhone');
                  }}
                  placeholder="010-0000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {fieldErrors.contactPhone && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.contactPhone}</p>
                )}
              </div>

              <div>
                <label htmlFor="support-attachments" className="mb-1 block text-sm font-semibold text-gray-700">
                  첨부파일 (선택)
                </label>
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                  <input
                    id="support-attachments"
                    type="file"
                    multiple
                    onChange={handleAttachmentsChange}
                    className="block w-full cursor-pointer text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                  />

                  {attachments.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {attachments.map((file, index) => (
                        <li
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{file.name}</span>
                            <span className="shrink-0 text-gray-400">({formatBytes(file.size)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="ml-3 rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            제거
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {fieldErrors.attachments && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.attachments}</p>
                )}
              </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    문의 제출
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {receiptTicket && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              접수 완료
            </div>
            <p className="mt-1">
              접수번호 <span className="font-semibold">{receiptTicket.id}</span> 로 상태를 조회할 수 있습니다.
            </p>
          </div>
        )}

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Ticket status</h3>
              <p className="mt-1 text-sm text-gray-500">Check the latest status and customer-visible reply.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshTicketStatus();
              }}
              disabled={isLookupLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={lookupTicketId}
              onChange={(event) => setLookupTicketId(event.target.value)}
              placeholder="Ticket ID"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => {
                void refreshTicketStatus();
              }}
              disabled={isLookupLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>

          {lookupError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{lookupError.message}</p>
              {lookupErrorActionLabel && (
                <button
                  type="button"
                  onClick={handleLookupErrorAction}
                  className="mt-2 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  {lookupErrorActionLabel}
                </button>
              )}
            </div>
          )}

          {lookupTicket && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-900">{lookupTicket.id}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toSupportStatusBadgeClass(lookupTicket.status)}`}>
                  {toSupportStatusLabel(lookupTicket.status)}
                </span>
              </div>
              <dl className="mt-3 grid gap-3 text-gray-700 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">Title</dt>
                  <dd className="font-medium text-gray-900">{lookupTicket.title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Updated</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(lookupTicket.updatedAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">Reply</dt>
                  <dd className="whitespace-pre-wrap font-medium text-gray-900" data-testid="support-customer-reply-content">
                    {lookupTicket.replyContent || '-'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
    </div>
  );
}

export default function SupportCenter() {
  const { user } = useAuth();
  const { canPerformAction } = useAuthorization();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canManageSupport = canPerformAction(ACTION_PERMISSIONS.supportManage);
  const isSuperAdmin = user?.role === 'super_admin';
  const supportPrefill = useMemo(() => readSupportPrefillState(location.state), [location.state]);
  const requestedMode = searchParams.get('mode');
  const isSubmitMode = requestedMode === 'submit';

  if (canManageSupport && !supportPrefill && !isSubmitMode) {
    return (
      <SupportAdminManagementView
        canUpdateStatus={isSuperAdmin}
        isSuperAdmin={isSuperAdmin}
        onOpenSubmitView={() => navigate('?mode=submit')}
      />
    );
  }

  return <SupportTicketSubmitView canManageSupport={canManageSupport} isSuperAdmin={isSuperAdmin} />;
}
