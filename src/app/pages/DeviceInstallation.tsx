import { Layout } from '../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera, CheckCircle, XCircle, AlertCircle, Zap, Loader2 } from 'lucide-react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { ACTION_PERMISSIONS } from '../authorization';
import { ApiError } from '../../services/api';
import {
  cancelDeviceInstallation,
  createDeviceInstallation,
  getDeviceInstallationList,
  type DeviceInstallationItem,
  type DeviceInstallationStatus,
} from '../../services/deviceInstallations';

type DeviceInstallationStatusFilter = 'all' | DeviceInstallationStatus;

interface DeviceInstallationSummary {
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

const PAGE_SIZE = 10;

const EMPTY_SUMMARY: DeviceInstallationSummary = {
  scheduled: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
};

const FILTER_OPTIONS: { value: DeviceInstallationStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'scheduled', label: '대기' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function getStatusBadge(status: DeviceInstallationStatus) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          완료
        </span>
      );
    case 'in_progress':
      return (
        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          진행중
        </span>
      );
    case 'cancelled':
      return (
        <span className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
          <XCircle className="h-3 w-3" />
          취소
        </span>
      );
    case 'scheduled':
    default:
      return (
        <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
          <AlertCircle className="h-3 w-3" />
          대기
        </span>
      );
  }
}

function toActionErrorMessage(action: 'create' | 'cancel', error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return action === 'create'
        ? '입력 값을 확인해 주세요. VIN/예약 시간/사진 형식이 올바른지 확인이 필요합니다.'
        : '취소 요청 값이 유효하지 않습니다.';
    }
    if (error.status === 401) {
      return '세션이 만료되었습니다. 다시 로그인해 주세요.';
    }
    if (error.status === 403) {
      return '권한이 없어 요청을 처리할 수 없습니다.';
    }
    if (error.status === 404) {
      return '요청한 장착 작업을 찾을 수 없습니다.';
    }
    if (error.status === 409) {
      return action === 'create'
        ? '이미 처리 중인 장착 작업입니다. 최신 목록으로 다시 확인해 주세요.'
        : '이미 취소되었거나 완료된 작업입니다. 최신 상태로 새로고침합니다.';
    }
    if (error.status !== undefined && error.status >= 500) {
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'ABORTED') {
      return '네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
    }

    return error.message || '요청 처리 중 오류가 발생했습니다.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

function isCancellable(status: DeviceInstallationStatus): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('사진 파일을 읽는 중 오류가 발생했습니다.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result) {
        reject(new Error('사진 파일을 읽는 중 오류가 발생했습니다.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function DeviceInstallation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canPerformAction } = useAuthorization();
  const canWriteDeviceInstallation = canPerformAction(ACTION_PERMISSIONS.deviceInstallationWrite);

  const [installations, setInstallations] = useState<DeviceInstallationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<DeviceInstallationSummary>(EMPTY_SUMMARY);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DeviceInstallationStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const [vin, setVin] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [deviceSerial, setDeviceSerial] = useState('');
  const [installationPhotoFile, setInstallationPhotoFile] = useState<File | null>(null);
  const [installationPhotoPreview, setInstallationPhotoPreview] = useState<string>('');
  const [serialPhotoFile, setSerialPhotoFile] = useState<File | null>(null);
  const [serialPhotoPreview, setSerialPhotoPreview] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingInstallationId, setCancellingInstallationId] = useState<string | null>(null);

  useEffect(() => () => {
    if (installationPhotoPreview) {
      URL.revokeObjectURL(installationPhotoPreview);
    }
    if (serialPhotoPreview) {
      URL.revokeObjectURL(serialPhotoPreview);
    }
  }, [installationPhotoPreview, serialPhotoPreview]);

  const listStatus = statusFilter === 'all' ? undefined : statusFilter;

  const fetchList = useCallback((signal: AbortSignal) => getDeviceInstallationList({
    page,
    pageSize: PAGE_SIZE,
    status: listStatus,
    signal,
  }), [listStatus, page]);

  const handleListSuccess = useCallback((payload: { items: DeviceInstallationItem[]; total: number }) => {
    setInstallations(payload.items);
    setTotalCount(payload.total);
    setPageNotice(null);

    if (payload.items.length === 0 && payload.total > 0 && page > 1) {
      setPage((prevPage) => Math.max(1, prevPage - 1));
      setPageNotice('현재 페이지에 항목이 없어 이전 페이지로 이동합니다.');
    }
  }, [page]);

  const {
    isLoading: isInstallationsLoading,
    error: installationsError,
    errorKind: installationsErrorKind,
    isEmpty: isInstallationsEmpty,
    run: hydrateInstallations,
  } = usePageEndpointState<{ items: DeviceInstallationItem[]; total: number }>({
    request: fetchList,
    onSuccess: handleListSuccess,
    isEmpty: (payload) => payload.total === 0,
  });

  const hydrateSummary = useCallback(async () => {
    setSummaryError(null);

    try {
      const [scheduled, inProgress, completed, cancelled] = await Promise.all([
        getDeviceInstallationList({ page: 1, pageSize: 1, status: 'scheduled' }),
        getDeviceInstallationList({ page: 1, pageSize: 1, status: 'in_progress' }),
        getDeviceInstallationList({ page: 1, pageSize: 1, status: 'completed' }),
        getDeviceInstallationList({ page: 1, pageSize: 1, status: 'cancelled' }),
      ]);

      setSummary({
        scheduled: scheduled.total,
        inProgress: inProgress.total,
        completed: completed.total,
        cancelled: cancelled.total,
      });
    } catch (error) {
      console.error(error);
      setSummaryError('집계 데이터를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void hydrateInstallations();
  }, [hydrateInstallations]);

  useEffect(() => {
    void hydrateSummary();
  }, [hydrateSummary]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      hydrateInstallations(),
      hydrateSummary(),
    ]);
  }, [hydrateInstallations, hydrateSummary]);

  const handleRetry = useCallback(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleInstallationsErrorAction = useCallback(() => {
    handlePageErrorAction(installationsErrorKind, navigate);
  }, [installationsErrorKind, navigate]);

  const handleFilePreviewChange = useCallback((
    file: File | null,
    currentPreview: string,
    setFile: (next: File | null) => void,
    setPreview: (next: string) => void,
  ) => {
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }
    if (!file) {
      setFile(null);
      setPreview('');
      return;
    }

    setFile(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  const resetForm = useCallback(() => {
    if (installationPhotoPreview) {
      URL.revokeObjectURL(installationPhotoPreview);
    }
    if (serialPhotoPreview) {
      URL.revokeObjectURL(serialPhotoPreview);
    }

    setVin('');
    setScheduledAt(toDateTimeLocalValue(new Date()));
    setDeviceSerial('');
    setInstallationPhotoFile(null);
    setInstallationPhotoPreview('');
    setSerialPhotoFile(null);
    setSerialPhotoPreview('');
  }, [installationPhotoPreview, serialPhotoPreview]);

  const handleCreateInstallation = useCallback(async () => {
    if (!canWriteDeviceInstallation) {
      setActionError('단말 장착 신청 권한이 없습니다.');
      setActionMessage(null);
      return;
    }

    setActionError(null);
    setActionMessage(null);

    const normalizedVin = vin.trim().toUpperCase();
    const normalizedDeviceSerial = deviceSerial.trim().toUpperCase();

    if (!normalizedVin || !scheduledAt || !normalizedDeviceSerial || !installationPhotoFile || !serialPhotoFile) {
      setActionError('VIN, 예약 시간, 단말 시리얼, 장착/시리얼 사진을 모두 입력해 주세요.');
      return;
    }

    const scheduledAtIso = toIsoDateTime(scheduledAt);
    if (!scheduledAtIso) {
      setActionError('예약 시간 형식이 올바르지 않습니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      const [scheduledTasks, inProgressTasks] = await Promise.all([
        getDeviceInstallationList({
          page: 1,
          pageSize: 1,
          status: 'scheduled',
          vin: normalizedVin,
        }),
        getDeviceInstallationList({
          page: 1,
          pageSize: 1,
          status: 'in_progress',
          vin: normalizedVin,
        }),
      ]);

      if (scheduledTasks.total > 0 || inProgressTasks.total > 0) {
        setActionError('이미 진행 중인 장착 작업이 있습니다. 기존 작업을 완료/취소한 뒤 다시 시도해 주세요.');
        return;
      }

      const [installationPhotoDataUrl, serialPhotoDataUrl] = await Promise.all([
        readFileAsDataUrl(installationPhotoFile),
        readFileAsDataUrl(serialPhotoFile),
      ]);

      await createDeviceInstallation({
        vin: normalizedVin,
        scheduledAt: scheduledAtIso,
        installer: user?.name ?? undefined,
        deviceSerial: normalizedDeviceSerial,
        photos: [installationPhotoDataUrl, serialPhotoDataUrl],
      });

      setActionMessage('장착 신청이 등록되었습니다. 상태가 대기로 반영됩니다.');
      resetForm();
      setPage(1);
      await refreshAll();
    } catch (error) {
      setActionError(toActionErrorMessage('create', error));
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        await refreshAll();
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canWriteDeviceInstallation,
    deviceSerial,
    installationPhotoFile,
    refreshAll,
    resetForm,
    scheduledAt,
    serialPhotoFile,
    user?.name,
    vin,
  ]);

  const handleCancelInstallation = useCallback(async (installationId: string) => {
    if (!canWriteDeviceInstallation) {
      setActionError('단말 장착 취소 권한이 없습니다.');
      setActionMessage(null);
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setCancellingInstallationId(installationId);

    try {
      await cancelDeviceInstallation(installationId);
      setActionMessage('장착 작업이 취소되었습니다.');
      await refreshAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setActionError('이미 삭제되었거나 존재하지 않는 작업입니다. 최신 목록으로 갱신합니다.');
        await refreshAll();
        return;
      }

      setActionError(toActionErrorMessage('cancel', error));
      if (error instanceof ApiError && error.status === 409) {
        await refreshAll();
      }
    } finally {
      setCancellingInstallationId(null);
    }
  }, [canWriteDeviceInstallation, refreshAll]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  return (
    <Layout title="단말 장착/관리">
      <div className="p-6">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 mb-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6" />
              <h2 className="text-lg font-bold">단말 장착 작업</h2>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>대기: <strong>{summary.scheduled}</strong>건</span>
              <span>진행중: <strong>{summary.inProgress}</strong>건</span>
              <span>완료: <strong>{summary.completed}</strong>건</span>
              <span>취소: <strong>{summary.cancelled}</strong>건</span>
            </div>
          </div>
          {summaryError && (
            <p className="mt-2 text-xs text-blue-100">{summaryError}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          {(actionError || actionMessage) && (
            <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              actionError
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
            >
              {actionError ?? actionMessage}
            </div>
          )}

          {!canWriteDeviceInstallation && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              현재 계정은 단말 장착 신청/취소 작업을 수행할 수 없습니다.
            </div>
          )}

          {pageNotice && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {pageNotice}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-shrink-0" style={{ width: '180px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                VIN
              </label>
              <input
                type="text"
                placeholder="KMH..."
                value={vin}
                onChange={(event) => setVin(event.target.value.toUpperCase())}
                disabled={!canWriteDeviceInstallation || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex-shrink-0" style={{ width: '180px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                단말 시리얼 번호
              </label>
              <input
                type="text"
                placeholder="DEV-2024-XXX"
                value={deviceSerial}
                onChange={(e) => setDeviceSerial(e.target.value.toUpperCase())}
                disabled={!canWriteDeviceInstallation || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div className="flex-shrink-0" style={{ width: '220px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                예약 일시 <span className="text-red-600">*</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                disabled={!canWriteDeviceInstallation || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                장착 사진 <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleFilePreviewChange(
                      file ?? null,
                      installationPhotoPreview,
                      setInstallationPhotoFile,
                      setInstallationPhotoPreview,
                    );
                  }}
                  id="photo-upload"
                  className="hidden"
                  disabled={!canWriteDeviceInstallation || isSubmitting}
                />
                <label
                  htmlFor="photo-upload"
                  className={`flex items-center justify-center gap-2 w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                    installationPhotoFile
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {installationPhotoFile ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>첨부됨</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>촬영</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {installationPhotoPreview && (
              <div className="flex-shrink-0" style={{ width: '50px' }}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  &nbsp;
                </label>
                <div
                  className="relative h-[38px] w-full border border-gray-300 rounded-lg overflow-hidden cursor-pointer"
                  onClick={() => window.open(installationPhotoPreview, '_blank', 'noopener,noreferrer')}
                >
                  <img
                    src={installationPhotoPreview}
                    alt="장착사진"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                시리얼 사진 <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleFilePreviewChange(
                      file ?? null,
                      serialPhotoPreview,
                      setSerialPhotoFile,
                      setSerialPhotoPreview,
                    );
                  }}
                  id="serial-photo-upload"
                  className="hidden"
                  disabled={!canWriteDeviceInstallation || isSubmitting}
                />
                <label
                  htmlFor="serial-photo-upload"
                  className={`flex items-center justify-center gap-2 w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                    serialPhotoFile
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {serialPhotoFile ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>첨부됨</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>촬영</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {serialPhotoPreview && (
              <div className="flex-shrink-0" style={{ width: '50px' }}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  &nbsp;
                </label>
                <div
                  className="relative h-[38px] w-full border border-gray-300 rounded-lg overflow-hidden cursor-pointer"
                  onClick={() => window.open(serialPhotoPreview, '_blank', 'noopener,noreferrer')}
                >
                  <img
                    src={serialPhotoPreview}
                    alt="시리얼사진"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="flex-shrink-0 ml-auto" style={{ width: '120px' }}>
              <button
                onClick={() => {
                  void handleCreateInstallation();
                }}
                disabled={!canWriteDeviceInstallation || isSubmitting || !vin || !scheduledAt || !deviceSerial || !installationPhotoFile || !serialPhotoFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                장착 신청
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="installation-status-filter" className="text-xs font-semibold text-gray-700">
              상태 필터
            </label>
            <select
              id="installation-status-filter"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as DeviceInstallationStatusFilter);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-600">
            총 {totalCount}건 · 페이지 {page}/{totalPages}
          </div>
        </div>

        <PageStateBoundary
          isLoading={isInstallationsLoading}
          error={installationsError}
          isEmpty={isInstallationsEmpty}
          errorDescription="장착 작업 목록을 불러오는 중 문제가 발생했습니다."
          emptyTitle="장착 작업이 없습니다"
          emptyDescription="장착 신청을 등록하면 목록에 표시됩니다."
          onRetry={handleRetry}
          errorActionLabel={getPageErrorActionLabel(installationsErrorKind)}
          onErrorAction={handleInstallationsErrorAction}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">장착 작업 리스트</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">VIN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">단말 시리얼</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">예약 일시</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">완료 일시</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">사진</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {installations.map((installation) => (
                    <tr
                      key={installation.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {getStatusBadge(installation.status)}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-900">{installation.id}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-700">{installation.vin}</span>
                      </td>

                      <td className="px-4 py-3">
                        {installation.deviceSerial ? (
                          <span className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
                            {installation.deviceSerial}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {installation.installer ? (
                          <span className="text-sm text-gray-700">{installation.installer}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{formatDateTime(installation.scheduledAt)}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{formatDateTime(installation.installedAt)}</span>
                      </td>

                      <td className="px-4 py-3">
                        {installation.photos.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {installation.photos.map((photo, index) => (
                              <button
                                key={`${installation.id}-photo-${index + 1}`}
                                onClick={() => window.open(photo, '_blank', 'noopener,noreferrer')}
                                className="text-blue-600 hover:text-blue-700 text-xs underline text-left"
                              >
                                사진 {index + 1}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isCancellable(installation.status) ? (
                          <button
                            onClick={() => {
                              void handleCancelInstallation(installation.id);
                            }}
                            disabled={!canWriteDeviceInstallation || cancellingInstallationId === installation.id}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {cancellingInstallationId === installation.id ? '취소 중...' : '취소'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
              <button
                onClick={() => setPage((prevPage) => Math.max(1, prevPage - 1))}
                disabled={page <= 1 || isInstallationsLoading}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                이전
              </button>
              <span className="text-xs text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((prevPage) => Math.min(totalPages, prevPage + 1))}
                disabled={page >= totalPages || isInstallationsLoading}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        </PageStateBoundary>
      </div>
    </Layout>
  );
}
