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
import { formatDateTimeKst } from '../utils/dateTimeFormat';
import { ApiError } from '../../services/api';
import { getAssetsList } from '../../services/assets';
import {
  createDeviceInstallation,
  getDeviceInstallationList,
  type DeviceInstallationItem,
  type DeviceInstallationStatus,
} from '../../services/deviceInstallations';

type DeviceInstallationStatusFilter = 'all' | DeviceInstallationStatus;
type DeviceInstallationDisplayStatus = 'pending' | 'completed' | 'cancelled';

interface DeviceInstallationVehicleOption {
  vin: string;
  vehicleNumber: string;
  model: string;
  year: string;
}

interface DeviceInstallationDisplayRow {
  installation: DeviceInstallationItem;
  displayStatus: DeviceInstallationDisplayStatus;
  vehicleNumber: string;
  model: string;
  year: string;
  healthCheck: string;
  installationPhoto: string | null;
  serialPhoto: string | null;
}

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
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toVehicleOptions(payload: unknown): DeviceInstallationVehicleOption[] {
  if (!isRecord(payload)) {
    return [];
  }

  const rawRows = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.assets)
      ? payload.assets
      : Array.isArray(payload.rows)
        ? payload.rows
        : Array.isArray(payload.list)
          ? payload.list
          : [];

  const options = rawRows
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }

      const vin = toText(row.vin) ?? toText(row.chassisNumber);
      const vehicleNumber = toText(row.vehicleNumber)
        ?? toText(row.plateNumber)
        ?? toText(row.plate)
        ?? toText(row.number);

      if (!vin || !vehicleNumber) {
        return null;
      }

      return {
        vin,
        vehicleNumber,
        model: toText(row.model) ?? toText(row.vehicleModel) ?? toText(row.vehicleType) ?? '차종 미확인',
        year: toText(row.year) ?? toText(row.modelYear) ?? '-',
      } satisfies DeviceInstallationVehicleOption;
    })
    .filter((option): option is DeviceInstallationVehicleOption => option !== null);

  const deduped = new Map<string, DeviceInstallationVehicleOption>();
  for (const option of options) {
    deduped.set(option.vin, option);
  }
  return Array.from(deduped.values());
}

function formatDateTime(value?: string): string {
  return formatDateTimeKst(value, '-');
}

function toDisplayStatus(status: DeviceInstallationStatus): DeviceInstallationDisplayStatus {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'cancelled') {
    return 'cancelled';
  }
  return 'pending';
}

function getDisplayStatusBadge(status: DeviceInstallationDisplayStatus) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          완료
        </span>
      );
    case 'cancelled':
      return (
        <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
          <XCircle className="h-3 w-3" />
          취소
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
          <AlertCircle className="h-3 w-3" />
          대기
        </span>
      );
  }
}

function getStatusBadge(status: DeviceInstallationStatus) {
  return getDisplayStatusBadge(toDisplayStatus(status));
}

function toActionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return '입력 값을 확인해 주세요. VIN/사진 형식이 올바른지 확인이 필요합니다.';
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
      return '이미 처리 중인 장착 작업입니다. 최신 목록으로 다시 확인해 주세요.';
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
  const [vehicleOptions, setVehicleOptions] = useState<DeviceInstallationVehicleOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<DeviceInstallationStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const [vin, setVin] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [installationPhotoFile, setInstallationPhotoFile] = useState<File | null>(null);
  const [installationPhotoPreview, setInstallationPhotoPreview] = useState<string>('');
  const [serialPhotoFile, setSerialPhotoFile] = useState<File | null>(null);
  const [serialPhotoPreview, setSerialPhotoPreview] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => {
    if (installationPhotoPreview) {
      URL.revokeObjectURL(installationPhotoPreview);
    }
    if (serialPhotoPreview) {
      URL.revokeObjectURL(serialPhotoPreview);
    }
  }, [installationPhotoPreview, serialPhotoPreview]);

  const listStatus = statusFilter === 'all' ? undefined : statusFilter;
  const vehicleOptionsByVin = useMemo(() => {
    const entries = new Map<string, DeviceInstallationVehicleOption>();

    for (const option of vehicleOptions) {
      entries.set(option.vin, option);
    }

    for (const installation of installations) {
      if (!entries.has(installation.vin)) {
        entries.set(installation.vin, {
          vin: installation.vin,
          vehicleNumber: installation.vin,
          model: '차종 미확인',
          year: '-',
        });
      }
    }

    return entries;
  }, [installations, vehicleOptions]);
  const vehicleSelectOptions = useMemo(
    () => Array.from(vehicleOptionsByVin.values()).sort((left, right) => left.vehicleNumber.localeCompare(right.vehicleNumber, 'ko-KR')),
    [vehicleOptionsByVin],
  );
  const selectedVehicleOption = useMemo(
    () => (vin ? vehicleOptionsByVin.get(vin) ?? null : null),
    [vehicleOptionsByVin, vin],
  );
  const displayRows = useMemo<DeviceInstallationDisplayRow[]>(() => (
    installations.map((installation) => {
      const vehicle = vehicleOptionsByVin.get(installation.vin);
      const displayStatus = toDisplayStatus(installation.status);

      return {
        installation,
        displayStatus,
        vehicleNumber: vehicle?.vehicleNumber ?? installation.vin,
        model: vehicle?.model ?? '차종 미확인',
        year: vehicle?.year ?? '-',
        healthCheck: displayStatus === 'completed'
          ? '확인 완료'
          : displayStatus === 'cancelled'
            ? '취소'
            : '대기',
        installationPhoto: installation.photos[0] ?? null,
        serialPhoto: installation.photos[1] ?? null,
      };
    })
  ), [installations, vehicleOptionsByVin]);

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

  const isInstallationListEmpty = useCallback((payload: { items: DeviceInstallationItem[]; total: number }) => (
    payload.total === 0
  ), []);

  const {
    isLoading: isInstallationsLoading,
    error: installationsError,
    errorKind: installationsErrorKind,
    isEmpty: isInstallationsEmpty,
    run: hydrateInstallations,
  } = usePageEndpointState<{ items: DeviceInstallationItem[]; total: number }>({
    request: fetchList,
    onSuccess: handleListSuccess,
    isEmpty: isInstallationListEmpty,
  });

  const hydrateVehicleOptions = useCallback(async () => {
    try {
      const payload = await getAssetsList({
        page: 1,
        size: 200,
      });
      setVehicleOptions(toVehicleOptions(payload));
    } catch {
      setVehicleOptions([]);
    }
  }, []);

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

  useEffect(() => {
    void hydrateVehicleOptions();
  }, [hydrateVehicleOptions]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      hydrateInstallations(),
      hydrateSummary(),
      hydrateVehicleOptions(),
    ]);
  }, [hydrateInstallations, hydrateSummary, hydrateVehicleOptions]);

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

    if (!normalizedVin || !normalizedDeviceSerial || !installationPhotoFile || !serialPhotoFile) {
      setActionError('VIN, 단말 시리얼, 장착/시리얼 사진을 모두 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const [installationPhotoDataUrl, serialPhotoDataUrl] = await Promise.all([
        readFileAsDataUrl(installationPhotoFile),
        readFileAsDataUrl(serialPhotoFile),
      ]);

      await createDeviceInstallation({
        vin: normalizedVin,
        scheduledAt: new Date().toISOString(),
        installer: user?.name ?? undefined,
        deviceSerial: normalizedDeviceSerial,
        photos: [installationPhotoDataUrl, serialPhotoDataUrl],
      });

      setActionMessage('장착 완료가 등록되었습니다.');
      resetForm();
      setPage(1);
      await refreshAll();
    } catch (error) {
      setActionError(toActionErrorMessage(error));
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
    serialPhotoFile,
    user?.name,
    vin,
  ]);

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
              <span>대기: <strong>{summary.scheduled + summary.inProgress}</strong>건</span>
              <span>완료: <strong>{summary.completed}</strong>건</span>
            </div>
          </div>
          {summaryError && (
            <p className="mt-2 text-xs text-blue-100">{summaryError}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          {(actionError || actionMessage) && (
            <div data-testid={actionError ? 'device-installation-action-error' : 'device-installation-action-message'} className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
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

          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-shrink-0" style={{ width: '180px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                차량번호
              </label>
              <select
                data-testid="device-installation-vin-input"
                value={vin}
                onChange={(event) => {
                  setVin(event.target.value.toUpperCase());
                }}
                disabled={!canWriteDeviceInstallation || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">선택하세요</option>
                {vehicleSelectOptions.map((option) => (
                  <option key={option.vin} value={option.vin}>
                    {option.vehicleNumber} · {option.model}
                  </option>
                ))}
              </select>
              {selectedVehicleOption && (
                <p className="mt-1 text-[11px] text-gray-500">
                  {selectedVehicleOption.model} · {selectedVehicleOption.year}
                </p>
              )}
            </div>

            <div className="flex-shrink-0" style={{ width: '180px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                단말 시리얼 번호
              </label>
              <input
                data-testid="device-installation-serial-input"
                type="text"
                placeholder="DEV-2024-XXX"
                value={deviceSerial}
                onChange={(e) => setDeviceSerial(e.target.value.toUpperCase())}
                disabled={!canWriteDeviceInstallation || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                장착 사진 <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  data-testid="device-installation-photo-file-input"
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
                  data-testid="device-installation-serial-photo-file-input"
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
                data-testid="device-installation-submit"
                disabled={!canWriteDeviceInstallation || isSubmitting || !vin || !deviceSerial || !installationPhotoFile || !serialPhotoFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                장착 완료
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
              <h3 className="text-sm font-bold text-gray-900">장착 대상 차량 리스트</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">차량번호</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">차종</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">연식</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">단말 시리얼</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">장착 일시</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Health Check</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">장착사진</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">시리얼사진</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayRows.map((row) => {
                    const installation = row.installation;

                    return (
                    <tr
                      key={installation.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {getDisplayStatusBadge(row.displayStatus)}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900">{row.vehicleNumber}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700">{row.model}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700">{row.year}</span>
                      </td>

                      <td className="px-4 py-3">
                        {row.installation.deviceSerial ? (
                          <span className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
                            {row.installation.deviceSerial}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {row.installation.installer ? (
                          <span className="text-sm text-gray-700">{row.installation.installer}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{formatDateTime(row.installation.installedAt)}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{row.healthCheck}</span>
                      </td>

                      <td className="px-4 py-3">
                        {row.installationPhoto ? (
                          <button
                            onClick={() => window.open(row.installationPhoto, '_blank', 'noopener,noreferrer')}
                            className="text-blue-600 hover:text-blue-700 text-xs underline text-left"
                          >
                            보기
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {row.serialPhoto ? (
                          <button
                            onClick={() => window.open(row.serialPhoto, '_blank', 'noopener,noreferrer')}
                            className="text-blue-600 hover:text-blue-700 text-xs underline text-left"
                          >
                            보기
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
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
