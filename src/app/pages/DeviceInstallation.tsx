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
  patchDeviceInstallationStatus,
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
  { value: 'all', label: '?꾩껜' },
  { value: 'scheduled', label: '?湲? },
  { value: 'in_progress', label: '吏꾪뻾以? },
  { value: 'completed', label: '?꾨즺' },
  { value: 'cancelled', label: '痍⑥냼' },
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
          ?꾨즺
        </span>
      );
    case 'in_progress':
      return (
        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          吏꾪뻾以?
        </span>
      );
    case 'cancelled':
      return (
        <span className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
          <XCircle className="h-3 w-3" />
          痍⑥냼
        </span>
      );
    case 'scheduled':
    default:
      return (
        <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
          <AlertCircle className="h-3 w-3" />
          ?湲?
        </span>
      );
  }
}

function toActionErrorMessage(action: 'create' | 'cancel' | 'start' | 'complete', error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return action === 'create'
        ? '?낅젰 媛믪쓣 ?뺤씤??二쇱꽭?? VIN/?덉빟 ?쒓컙/?ъ쭊 ?뺤떇???щ컮瑜몄? ?뺤씤???꾩슂?⑸땲??'
        : action === 'start'
          ? '?묒뾽 ?쒖옉 ?붿껌 媛믪쓣 ?ㅼ떆 ?뺤씤??二쇱꽭??'
          : action === 'complete'
            ? '?묒뾽 ?꾨즺 ?붿껌 媛믪쓣 ?ㅼ떆 ?뺤씤??二쇱꽭??'
        : '痍⑥냼 ?붿껌 媛믪씠 ?좏슚?섏? ?딆뒿?덈떎.';
    }
    if (error.status === 401) {
      return '?몄뀡??留뚮즺?섏뿀?듬땲?? ?ㅼ떆 濡쒓렇?명빐 二쇱꽭??';
    }
    if (error.status === 403) {
      return '沅뚰븳???놁뼱 ?붿껌??泥섎━?????놁뒿?덈떎.';
    }
    if (error.status === 404) {
      return '?붿껌???μ갑 ?묒뾽??李얠쓣 ???놁뒿?덈떎.';
    }
    if (error.status === 409) {
      return action === 'create'
        ? '?대? 泥섎━ 以묒씤 ?μ갑 ?묒뾽?낅땲?? 理쒖떊 紐⑸줉?쇰줈 ?ㅼ떆 ?뺤씤??二쇱꽭??'
        : action === 'start'
          ? '?대? ?쒖옉?섏뿀嫄곕굹 ???댁긽 ?쒖옉?????녿뒗 ?묒뾽?낅땲?? 理쒖떊 紐⑸줉?쇰줈 媛깆떊?⑸땲??'
          : action === 'complete'
            ? '?대? ?꾨즺?섏뿀嫄곕굹 ???댁긽 ?꾨즺?????녿뒗 ?묒뾽?낅땲?? 理쒖떊 紐⑸줉?쇰줈 媛깆떊?⑸땲??'
        : '?대? 痍⑥냼?섏뿀嫄곕굹 ?꾨즺???묒뾽?낅땲?? 理쒖떊 ?곹깭濡??덈줈怨좎묠?⑸땲??';
    }
    if (error.status !== undefined && error.status >= 500) {
      return '?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??';
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'ABORTED') {
      return '?ㅽ듃?뚰겕 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?곌껐 ?곹깭瑜??뺤씤?????ㅼ떆 ?쒕룄??二쇱꽭??';
    }

    return error.message || '?붿껌 泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '?붿껌 泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.';
}

function isCancellable(status: DeviceInstallationStatus): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

function isStartable(status: DeviceInstallationStatus): boolean {
  return status === 'scheduled';
}

function isCompletable(status: DeviceInstallationStatus): boolean {
  return status === 'in_progress';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('?ъ쭊 ?뚯씪???쎈뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result) {
        reject(new Error('?ъ쭊 ?뚯씪???쎈뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'));
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
  const [startingInstallationId, setStartingInstallationId] = useState<string | null>(null);
  const [completingInstallationId, setCompletingInstallationId] = useState<string | null>(null);

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
      setPageNotice('?꾩옱 ?섏씠吏????ぉ???놁뼱 ?댁쟾 ?섏씠吏濡??대룞?⑸땲??');
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
      setSummaryError('吏묎퀎 ?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??');
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
      setActionError('?⑤쭚 ?μ갑 ?좎껌 沅뚰븳???놁뒿?덈떎.');
      setActionMessage(null);
      return;
    }

    setActionError(null);
    setActionMessage(null);

    const normalizedVin = vin.trim().toUpperCase();
    const normalizedDeviceSerial = deviceSerial.trim().toUpperCase();

    if (!normalizedVin || !scheduledAt || !normalizedDeviceSerial || !installationPhotoFile || !serialPhotoFile) {
      setActionError('VIN, ?덉빟 ?쒓컙, ?⑤쭚 ?쒕━?? ?μ갑/?쒕━???ъ쭊??紐⑤몢 ?낅젰??二쇱꽭??');
      return;
    }

    const scheduledAtIso = toIsoDateTime(scheduledAt);
    if (!scheduledAtIso) {
      setActionError('?덉빟 ?쒓컙 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎.');
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
        setActionError('?대? 吏꾪뻾 以묒씤 ?μ갑 ?묒뾽???덉뒿?덈떎. 湲곗〈 ?묒뾽???꾨즺/痍⑥냼?????ㅼ떆 ?쒕룄??二쇱꽭??');
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

      setActionMessage('?μ갑 ?좎껌???깅줉?섏뿀?듬땲?? ?곹깭媛 ?湲곕줈 諛섏쁺?⑸땲??');
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
      setActionError('?⑤쭚 ?μ갑 痍⑥냼 沅뚰븳???놁뒿?덈떎.');
      setActionMessage(null);
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setCancellingInstallationId(installationId);

    try {
      await cancelDeviceInstallation(installationId);
      setActionMessage('?μ갑 ?묒뾽??痍⑥냼?섏뿀?듬땲??');
      await refreshAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setActionError('?대? ??젣?섏뿀嫄곕굹 議댁옱?섏? ?딅뒗 ?묒뾽?낅땲?? 理쒖떊 紐⑸줉?쇰줈 媛깆떊?⑸땲??');
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

  const handleStartInstallation = useCallback(async (installationId: string) => {
    if (!canWriteDeviceInstallation) {
      setActionError('작업 시작 권한이 없습니다.');
      setActionMessage(null);
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setStartingInstallationId(installationId);

    try {
      await patchDeviceInstallationStatus(installationId, {
        status: 'in_progress',
      });
      setActionMessage('작업을 시작했습니다.');
      await refreshAll();
    } catch (error) {
      setActionError(toActionErrorMessage('start', error));
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        await refreshAll();
      }
    } finally {
      setStartingInstallationId(null);
    }
  }, [canWriteDeviceInstallation, refreshAll]);

  const handleCompleteInstallation = useCallback(async (installationId: string) => {
    if (!canWriteDeviceInstallation) {
      setActionError('작업 완료 권한이 없습니다.');
      setActionMessage(null);
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setCompletingInstallationId(installationId);

    try {
      await patchDeviceInstallationStatus(installationId, {
        status: 'completed',
        installedAt: new Date().toISOString(),
      });
      setActionMessage('작업을 완료 처리했습니다.');
      await refreshAll();
    } catch (error) {
      setActionError(toActionErrorMessage('complete', error));
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        await refreshAll();
      }
    } finally {
      setCompletingInstallationId(null);
    }
  }, [canWriteDeviceInstallation, refreshAll]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  return (
    <Layout title="?⑤쭚 ?μ갑/愿由?>
      <div className="p-6">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 mb-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6" />
              <h2 className="text-lg font-bold">?⑤쭚 ?μ갑 ?묒뾽</h2>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>?湲? <strong>{summary.scheduled}</strong>嫄?/span>
              <span>吏꾪뻾以? <strong>{summary.inProgress}</strong>嫄?/span>
              <span>?꾨즺: <strong>{summary.completed}</strong>嫄?/span>
              <span>痍⑥냼: <strong>{summary.cancelled}</strong>嫄?/span>
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
              ?꾩옱 怨꾩젙? ?⑤쭚 ?μ갑 ?좎껌/痍⑥냼 ?묒뾽???섑뻾?????놁뒿?덈떎.
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
                data-testid="device-installation-vin-input"
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
                ?⑤쭚 ?쒕━??踰덊샇
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

            <div className="flex-shrink-0" style={{ width: '220px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ?덉빟 ?쇱떆 <span className="text-red-600">*</span>
              </label>
              <input
                data-testid="device-installation-scheduled-at-input"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                disabled={!canWriteDeviceInstallation || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ?μ갑 ?ъ쭊 <span className="text-red-600">*</span>
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
                      <span>泥⑤???/span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>珥ъ쁺</span>
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
                    alt="?μ갑?ъ쭊"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ?쒕━???ъ쭊 <span className="text-red-600">*</span>
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
                      <span>泥⑤???/span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>珥ъ쁺</span>
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
                    alt="?쒕━?쇱궗吏?
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
                disabled={!canWriteDeviceInstallation || isSubmitting || !vin || !scheduledAt || !deviceSerial || !installationPhotoFile || !serialPhotoFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                ?μ갑 ?좎껌
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="installation-status-filter" className="text-xs font-semibold text-gray-700">
              ?곹깭 ?꾪꽣
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
            珥?{totalCount}嫄?쨌 ?섏씠吏 {page}/{totalPages}
          </div>
        </div>

        <PageStateBoundary
          isLoading={isInstallationsLoading}
          error={installationsError}
          isEmpty={isInstallationsEmpty}
          errorDescription="?μ갑 ?묒뾽 紐⑸줉??遺덈윭?ㅻ뒗 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎."
          emptyTitle="?μ갑 ?묒뾽???놁뒿?덈떎"
          emptyDescription="?μ갑 ?좎껌???깅줉?섎㈃ 紐⑸줉???쒖떆?⑸땲??"
          onRetry={handleRetry}
          errorActionLabel={getPageErrorActionLabel(installationsErrorKind)}
          onErrorAction={handleInstallationsErrorAction}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">?μ갑 ?묒뾽 由ъ뒪??/h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?곹깭</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?묒뾽ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">VIN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?⑤쭚 ?쒕━??/th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?묒뾽??/th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?덉빟 ?쇱떆</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?꾨즺 ?쇱떆</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?ъ쭊</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">?묒뾽</th>
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
                                ?ъ쭊 {index + 1}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isStartable(installation.status) || isCompletable(installation.status) || isCancellable(installation.status) ? (
                          <div className="flex flex-wrap gap-2">
                            {isStartable(installation.status) && (
                              <button
                                onClick={() => {
                                  void handleStartInstallation(installation.id);
                                }}
                                disabled={
                                  !canWriteDeviceInstallation
                                  || startingInstallationId === installation.id
                                  || completingInstallationId === installation.id
                                  || cancellingInstallationId === installation.id
                                }
                                className="rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {startingInstallationId === installation.id ? '?묒뾽 ?쒖옉 以?..' : '?묒뾽 ?쒖옉'}
                              </button>
                            )}
                            {isCompletable(installation.status) && (
                              <button
                                onClick={() => {
                                  void handleCompleteInstallation(installation.id);
                                }}
                                disabled={
                                  !canWriteDeviceInstallation
                                  || startingInstallationId === installation.id
                                  || completingInstallationId === installation.id
                                  || cancellingInstallationId === installation.id
                                }
                                className="rounded-md border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {completingInstallationId === installation.id ? '?묒뾽 ?꾨즺 以?..' : '?묒뾽 ?꾨즺'}
                              </button>
                            )}
                            {isCancellable(installation.status) && (
                              <button
                                onClick={() => {
                                  void handleCancelInstallation(installation.id);
                                }}
                                disabled={
                                  !canWriteDeviceInstallation
                                  || startingInstallationId === installation.id
                                  || completingInstallationId === installation.id
                                  || cancellingInstallationId === installation.id
                                }
                                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {cancellingInstallationId === installation.id ? '痍⑥냼 以?..' : '痍⑥냼'}
                              </button>
                            )}
                          </div>
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
                ?댁쟾
              </button>
              <span className="text-xs text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((prevPage) => Math.min(totalPages, prevPage + 1))}
                disabled={page >= totalPages || isInstallationsLoading}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ?ㅼ쓬
              </button>
            </div>
          </div>
        </PageStateBoundary>
      </div>
    </Layout>
  );
}
