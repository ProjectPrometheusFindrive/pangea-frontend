import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Loader2, Paperclip, RefreshCw, Search, Send } from 'lucide-react';

import { Layout } from '../components/Layout';
import { PageStateBoundary } from '../components/PageStateBoundary';
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
  type SupportCategory,
  type SupportTicket,
  type SupportTicketStatus,
} from '../../services/support';

type SupportField = 'category' | 'title' | 'content' | 'contactPhone' | 'attachments';
type SupportFieldErrors = Partial<Record<SupportField, string>>;

interface SupportErrorState {
  message: string;
  kind: PageErrorKind;
  fieldErrors: SupportFieldErrors;
}

interface StoredSupportReceipt {
  id: string;
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
  if (!value) {
    return '-';
  }

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return parsedValue.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    category: receipt.category,
    title: receipt.title,
    content: '',
    status: receipt.status,
    statusHistory: [],
    attachments: [],
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };
}

function buildSubmitFingerprint(payload: {
  category: string;
  title: string;
  content: string;
  contactPhone: string;
  attachments: File[];
}): string {
  return JSON.stringify({
    category: payload.category,
    title: payload.title,
    content: payload.content,
    contactPhone: payload.contactPhone,
    attachments: payload.attachments.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
  });
}

export default function SupportCenter() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [manualCategoryMode, setManualCategoryMode] = useState(false);

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [fieldErrors, setFieldErrors] = useState<SupportFieldErrors>({});
  const [submitError, setSubmitError] = useState<SupportErrorState | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitFingerprintRef = useRef<string | null>(null);
  const lastSubmitAtRef = useRef<number>(0);

  const [receiptTicket, setReceiptTicket] = useState<SupportTicket | null>(null);
  const [lookupTicketId, setLookupTicketId] = useState('');
  const [lookupTicket, setLookupTicket] = useState<SupportTicket | null>(null);
  const [lookupError, setLookupError] = useState<SupportErrorState | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  useEffect(() => {
    const storedReceipt = readSupportReceipt();
    if (!storedReceipt) {
      return;
    }

    const restoredTicket = restoreTicketFromReceipt(storedReceipt);
    setReceiptTicket(restoredTicket);
    setLookupTicket(restoredTicket);
    setLookupTicketId(restoredTicket.id);
    setSubmitSuccessMessage(`최근 접수 내역(${restoredTicket.id})을 복구했습니다.`);
  }, []);

  const requestSupportCategories = useCallback((signal: AbortSignal) => (
    getSupportCategories({ signal })
  ), []);

  const handleSupportCategoriesSuccess = useCallback((payload: SupportCategory[]) => {
    setCategories(payload);
    if (payload.length > 0) {
      setCategory((previousCategory) => {
        if (previousCategory && payload.some((item) => item.name === previousCategory)) {
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
    if (!normalizedCategory) {
      nextFieldErrors.category = '문의 카테고리를 선택하거나 입력해 주세요.';
    }
    if (!normalizedTitle) {
      nextFieldErrors.title = '문의 제목을 입력해 주세요.';
    }
    if (!normalizedContent) {
      nextFieldErrors.content = '문의 내용을 입력해 주세요.';
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
      const createdTicket = await createSupportTicket({
        category: normalizedCategory,
        title: normalizedTitle,
        content: normalizedContent,
        contactPhone: normalizedContactPhone || undefined,
        attachments: attachments.map((file) => ({
          fileName: file.name,
          sizeBytes: file.size,
          contentType: file.type || undefined,
        })),
      });

      setReceiptTicket(createdTicket);
      setLookupTicket(createdTicket);
      setLookupTicketId(createdTicket.id);
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
  }, [attachments, category, contactPhone, content, isSubmitting, title]);

  const refreshTicketStatus = useCallback(async (inputTicketId?: string) => {
    const targetTicketId = (inputTicketId ?? lookupTicketId).trim();
    if (!targetTicketId) {
      setLookupError({
        message: '조회할 접수번호를 입력해 주세요.',
        kind: 'unknown',
        fieldErrors: {},
      });
      return;
    }

    setLookupError(null);
    setIsLookupLoading(true);

    try {
      const detailedTicket = await getSupportTicketDetail(targetTicketId);
      setLookupTicket(detailedTicket);
      setLookupTicketId(detailedTicket.id);

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
  }, [lookupTicketId, receiptTicket]);

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

  const isCategoryEmptyState = categoriesEmpty && !manualCategoryMode;

  return (
    <Layout title="고객센터">
      <div className="space-y-4 p-6">
        <div className="rounded-lg bg-gradient-to-r from-slate-800 to-blue-700 px-5 py-4 text-white">
          <h2 className="text-lg font-bold">지원 문의 접수</h2>
          <p className="mt-1 text-sm text-blue-100">
            문의 등록 후 접수번호로 상태를 조회할 수 있습니다.
          </p>
        </div>

        <PageStateBoundary
          isLoading={isCategoriesLoading}
          error={categoriesError}
          isEmpty={isCategoryEmptyState}
          errorTitle="문의 카테고리를 불러오지 못했습니다"
          errorDescription="고객센터 카테고리 조회에 실패했습니다. 다시 시도해 주세요."
          emptyTitle="사용 가능한 문의 카테고리가 없습니다"
          emptyDescription="관리자에게 카테고리 설정을 요청하거나 직접 입력 모드로 접수할 수 있습니다."
          onRetry={() => {
            void hydrateCategories();
          }}
          errorActionLabel={getPageErrorActionLabel(categoriesErrorKind)}
          onErrorAction={handleCategoryErrorAction}
          emptyActionLabel="직접 입력 모드"
          onEmptyAction={() => setManualCategoryMode(true)}
          className="min-h-[260px]"
        >
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">문의 등록</h3>
                <p className="mt-1 text-sm text-gray-500">
                  첨부파일은 최대 {MAX_ATTACHMENT_COUNT}개, 파일당 {formatBytes(MAX_ATTACHMENT_BYTES)}까지 가능합니다.
                </p>
              </div>
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
                  연락처 (선택)
                </label>
                <input
                  id="support-contact-phone"
                  type="text"
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
        </PageStateBoundary>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">접수 상태 조회</h3>
              <p className="mt-1 text-sm text-gray-500">
                접수번호를 입력하면 최신 처리 상태를 확인할 수 있습니다.
              </p>
            </div>
            {receiptTicket && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                최근 접수번호: <span className="font-semibold">{receiptTicket.id}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={lookupTicketId}
              onChange={(event) => setLookupTicketId(event.target.value.toUpperCase())}
              placeholder="예) SUP-0001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:max-w-xs"
            />
            <button
              type="button"
              onClick={() => {
                void refreshTicketStatus();
              }}
              disabled={isLookupLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              조회
            </button>
            {lookupTicket && (
              <button
                type="button"
                onClick={() => {
                  void refreshTicketStatus(lookupTicket.id);
                }}
                disabled={isLookupLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLookupLoading ? 'animate-spin' : ''}`} />
                상태 새로고침
              </button>
            )}
          </div>

          {lookupError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{lookupError.message}</p>
              <div className="mt-2 flex items-center gap-2">
                {lookupError.kind === 'retryable' && (
                  <button
                    type="button"
                    onClick={() => {
                      void refreshTicketStatus();
                    }}
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    재시도
                  </button>
                )}
                {lookupErrorActionLabel && (
                  <button
                    type="button"
                    onClick={handleLookupErrorAction}
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    {lookupErrorActionLabel}
                  </button>
                )}
              </div>
            </div>
          )}

          {lookupTicket && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{lookupTicket.id}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toSupportStatusBadgeClass(lookupTicket.status)}`}>
                  {toSupportStatusLabel(lookupTicket.status)}
                </span>
                {lookupTicket.updatedAt && (
                  <span className="text-xs text-gray-500">
                    최근 갱신: {formatDateTime(lookupTicket.updatedAt)}
                  </span>
                )}
              </div>

              <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">카테고리</dt>
                  <dd className="font-medium text-gray-900">{lookupTicket.category}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">접수 일시</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(lookupTicket.createdAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">제목</dt>
                  <dd className="font-medium text-gray-900">{lookupTicket.title}</dd>
                </div>
              </dl>

              {lookupTicket.statusHistory.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500">상태 이력</p>
                  <ul className="mt-1 space-y-1">
                    {lookupTicket.statusHistory.map((entry, index) => (
                      <li
                        key={`${lookupTicket.id}-history-${index + 1}`}
                        className="flex flex-wrap items-center gap-2 text-xs text-gray-600"
                      >
                        <span className="rounded bg-white px-2 py-0.5">{toSupportStatusLabel(entry.to)}</span>
                        {entry.changedAt && <span>{formatDateTime(entry.changedAt)}</span>}
                        {entry.note && <span className="text-gray-500">({entry.note})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!lookupTicket && !lookupError && (
            <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              접수번호를 조회하면 문의 상태가 여기에 표시됩니다.
            </div>
          )}
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
      </div>
    </Layout>
  );
}
