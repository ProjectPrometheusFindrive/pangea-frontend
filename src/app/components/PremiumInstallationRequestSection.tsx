import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Send } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { AuthUser } from '../../services/auth';
import { getAssetDetail } from '../../services/assets';
import { ApiError } from '../../services/api';
import {
  createDeviceInstallation,
  getDeviceInstallation,
  getDeviceInstallationList,
  type DeviceInstallationItem,
  type DeviceInstallationStatus,
} from '../../services/deviceInstallations';
import { getPageErrorActionLabel, handlePageErrorAction } from '../hooks/usePageEndpointState';
import { PremiumBanner } from './PremiumBanner';

interface PremiumInstallableAsset {
  id: string;
  vehicleNumber: string;
  model: string;
  vin: string;
  owner?: string;
}

type PremiumRequestErrorKind = 'unauthorized' | 'forbidden' | 'retryable' | 'conflict' | 'unknown';
type PremiumRequestErrorSource = 'submit' | 'status' | 'asset';

interface PremiumRequestErrorState {
  kind: PremiumRequestErrorKind;
  source: PremiumRequestErrorSource;
  message: string;
}

interface PremiumInstallationReceipt {
  installationId: string;
  assetId: string;
  assetVehicleNumber: string;
  vin: string;
  status: DeviceInstallationStatus;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PremiumInstallationRequestSectionProps {
  assets: PremiumInstallableAsset[];
  user: AuthUser | null;
}

const PREMIUM_INSTALLATION_RECEIPT_STORAGE_KEY = 'premium-installation-receipt-v1';

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

function normalizeDeviceInstallationStatus(value: unknown): DeviceInstallationStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  if (normalized === 'scheduled' || normalized === 'pending') {
    return 'scheduled';
  }
  if (normalized === 'in_progress' || normalized === 'processing' || normalized === 'inprogress') {
    return 'in_progress';
  }
  if (normalized === 'completed' || normalized === 'done') {
    return 'completed';
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'cancelled';
  }

  return 'scheduled';
}

function unwrapAssetDetail(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  if (isRecord(payload.asset)) {
    return payload.asset;
  }
  if (isRecord(payload.item)) {
    return payload.item;
  }
  if (isRecord(payload.detail)) {
    return payload.detail;
  }
  if (isRecord(payload.data)) {
    return unwrapAssetDetail(payload.data);
  }

  return payload;
}

function toPremiumInstallableAsset(payload: unknown): PremiumInstallableAsset | null {
  const detail = unwrapAssetDetail(payload);
  if (!isRecord(detail)) {
    return null;
  }

  const assetId = toStringValue(detail.id)
    ?? toStringValue(detail.assetId)
    ?? toStringValue(detail.uuid);
  const vehicleNumber = toStringValue(detail.vehicleNumber)
    ?? toStringValue(detail.plate)
    ?? toStringValue(detail.plateNumber)
    ?? toStringValue(detail.number);
  const vin = toStringValue(detail.vin) ?? toStringValue(detail.chassisNumber);

  if (!assetId || !vehicleNumber || !vin) {
    return null;
  }

  return {
    id: assetId,
    vehicleNumber,
    vin,
    model: toStringValue(detail.model) ?? toStringValue(detail.vehicleModel) ?? '차종 미확인',
    owner: toStringValue(detail.owner) ?? toStringValue(detail.ownerName) ?? undefined,
  };
}

function savePremiumInstallationReceipt(receipt: PremiumInstallationReceipt): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(PREMIUM_INSTALLATION_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
  } catch {
    // no-op
  }
}

function clearPremiumInstallationReceipt(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(PREMIUM_INSTALLATION_RECEIPT_STORAGE_KEY);
  } catch {
    // no-op
  }
}

function readPremiumInstallationReceipt(): PremiumInstallationReceipt | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(PREMIUM_INSTALLATION_RECEIPT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isRecord(parsedValue)) {
      return null;
    }

    const installationId = toStringValue(parsedValue.installationId);
    const assetId = toStringValue(parsedValue.assetId);
    const assetVehicleNumber = toStringValue(parsedValue.assetVehicleNumber);
    const vin = toStringValue(parsedValue.vin);

    if (!installationId || !assetId || !assetVehicleNumber || !vin) {
      return null;
    }

    return {
      installationId,
      assetId,
      assetVehicleNumber,
      vin,
      status: normalizeDeviceInstallationStatus(parsedValue.status),
      scheduledAt: toStringValue(parsedValue.scheduledAt) ?? undefined,
      createdAt: toStringValue(parsedValue.createdAt) ?? undefined,
      updatedAt: toStringValue(parsedValue.updatedAt) ?? undefined,
    };
  } catch {
    return null;
  }
}

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

function isInProgressRequestStatus(status: DeviceInstallationStatus): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

function toStatusLabel(status: DeviceInstallationStatus): string {
  if (status === 'scheduled') {
    return '접수됨';
  }
  if (status === 'in_progress') {
    return '진행중';
  }
  if (status === 'completed') {
    return '완료';
  }
  return '취소';
}

function toStatusBadgeClass(status: DeviceInstallationStatus): string {
  if (status === 'scheduled') {
    return 'bg-yellow-100 text-yellow-700';
  }
  if (status === 'in_progress') {
    return 'bg-blue-100 text-blue-700';
  }
  if (status === 'completed') {
    return 'bg-green-100 text-green-700';
  }
  return 'bg-gray-200 text-gray-700';
}

function buildSubmitFingerprint(payload: {
  assetId: string;
  vin: string;
  scheduledAt: string;
  contactPhone: string;
  memo: string;
}): string {
  return JSON.stringify(payload);
}

function buildRequestMemo(payload: {
  memo: string;
  contactPhone: string;
  requesterName?: string;
  requesterEmail?: string;
  assetId: string;
}): string {
  const segments: string[] = [];
  const trimmedMemo = payload.memo.trim();
  if (trimmedMemo) {
    segments.push(trimmedMemo);
  }
  segments.push(`[premium-cta] assetId=${payload.assetId}`);
  if (payload.contactPhone.trim()) {
    segments.push(`contact=${payload.contactPhone.trim()}`);
  }
  if (payload.requesterName?.trim()) {
    segments.push(`requester=${payload.requesterName.trim()}`);
  }
  if (payload.requesterEmail?.trim()) {
    segments.push(`requesterEmail=${payload.requesterEmail.trim()}`);
  }
  return segments.join(' | ');
}

function toPremiumRequestErrorState(
  error: unknown,
  fallbackMessage: string,
  source: PremiumRequestErrorSource,
): PremiumRequestErrorState {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        kind: 'unauthorized',
        source,
        message: '세션이 만료되었습니다. 다시 로그인해 주세요.',
      };
    }
    if (error.status === 403) {
      return {
        kind: 'forbidden',
        source,
        message: '장착 신청 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
      };
    }
    if (error.status === 409) {
      return {
        kind: 'conflict',
        source,
        message: '이미 진행 중인 장착 신청이 있습니다. 접수번호로 상태를 확인해 주세요.',
      };
    }
    if ((error.status !== undefined && error.status >= 500)
      || error.code === 'SERVER_ERROR'
      || error.code === 'NETWORK_ERROR'
      || error.code === 'TIMEOUT') {
      return {
        kind: 'retryable',
        source,
        message: '일시적인 서버/네트워크 오류가 발생했습니다. 재시도해 주세요.',
      };
    }
    return {
      kind: 'unknown',
      source,
      message: error.message || fallbackMessage,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      kind: 'unknown',
      source,
      message: error.message,
    };
  }

  return {
    kind: 'unknown',
    source,
    message: fallbackMessage,
  };
}

function trackPremiumInstallationEvent(eventName: string, payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const detailPayload = {
    event: eventName,
    ...payload,
  };

  window.dispatchEvent(new CustomEvent('analytics:track', { detail: detailPayload }));

  const typedWindow = window as Window & { dataLayer?: unknown[] };
  if (Array.isArray(typedWindow.dataLayer)) {
    typedWindow.dataLayer.push(detailPayload);
  }
}

export function PremiumInstallationRequestSection({
  assets,
  user,
}: PremiumInstallationRequestSectionProps) {
  const navigate = useNavigate();
  const initialReceiptRef = useRef<PremiumInstallationReceipt | null>(readPremiumInstallationReceipt());
  const lastSubmitFingerprintRef = useRef<string | null>(null);
  const lastSubmitAtRef = useRef<number>(0);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSnapshot, setAssetSnapshot] = useState<PremiumInstallableAsset | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [contactPhone, setContactPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStatusRefreshing, setIsStatusRefreshing] = useState(false);
  const [requestError, setRequestError] = useState<PremiumRequestErrorState | null>(null);
  const [receipt, setReceipt] = useState<PremiumInstallationReceipt | null>(initialReceiptRef.current);

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );

  const selectedAsset = useMemo(() => {
    if (assetSnapshot && assetSnapshot.id === selectedAssetId) {
      return assetSnapshot;
    }
    if (!selectedAssetId) {
      return null;
    }
    return assetMap.get(selectedAssetId) ?? null;
  }, [assetMap, assetSnapshot, selectedAssetId]);

  const persistReceipt = useCallback((nextReceipt: PremiumInstallationReceipt | null) => {
    if (!nextReceipt) {
      clearPremiumInstallationReceipt();
      setReceipt(null);
      return;
    }

    savePremiumInstallationReceipt(nextReceipt);
    setReceipt(nextReceipt);
  }, []);

  const syncReceiptFromInstallation = useCallback((
    installation: DeviceInstallationItem,
    fallbackAsset: PremiumInstallableAsset | PremiumInstallationReceipt,
  ) => {
    const nextReceipt: PremiumInstallationReceipt = {
      installationId: installation.id,
      assetId: 'id' in fallbackAsset ? fallbackAsset.id : fallbackAsset.assetId,
      assetVehicleNumber: 'vehicleNumber' in fallbackAsset ? fallbackAsset.vehicleNumber : fallbackAsset.assetVehicleNumber,
      vin: installation.vin || ('vin' in fallbackAsset ? fallbackAsset.vin : ''),
      status: installation.status,
      scheduledAt: installation.scheduledAt || undefined,
      createdAt: installation.createdAt || undefined,
      updatedAt: installation.updatedAt || undefined,
    };

    persistReceipt(nextReceipt);
  }, [persistReceipt]);

  const findInProgressInstallationByVin = useCallback(async (vin: string) => {
    const [scheduledInstallations, inProgressInstallations] = await Promise.all([
      getDeviceInstallationList({
        page: 1,
        pageSize: 1,
        status: 'scheduled',
        vin,
      }),
      getDeviceInstallationList({
        page: 1,
        pageSize: 1,
        status: 'in_progress',
        vin,
      }),
    ]);

    return scheduledInstallations.items[0] ?? inProgressInstallations.items[0] ?? null;
  }, []);

  const refreshReceiptById = useCallback(async (
    installationId: string,
    fallbackReceipt: PremiumInstallationReceipt,
  ) => {
    setIsStatusRefreshing(true);
    setRequestError(null);

    try {
      const latestInstallation = await getDeviceInstallation(installationId);
      syncReceiptFromInstallation(latestInstallation, fallbackReceipt);
    } catch (error) {
      setRequestError(
        toPremiumRequestErrorState(
          error,
          '장착 신청 상태를 불러오지 못했습니다.',
          'status',
        ),
      );
    } finally {
      setIsStatusRefreshing(false);
    }
  }, [syncReceiptFromInstallation]);

  useEffect(() => {
    const restoredReceipt = initialReceiptRef.current;
    if (!restoredReceipt) {
      return;
    }

    initialReceiptRef.current = null;
    void refreshReceiptById(restoredReceipt.installationId, restoredReceipt);
  }, [refreshReceiptById]);

  useEffect(() => {
    if (assets.length === 0) {
      setSelectedAssetId('');
      setAssetSnapshot(null);
      setIsFormVisible(false);
      return;
    }

    setSelectedAssetId((previousAssetId) => {
      if (previousAssetId && assetMap.has(previousAssetId)) {
        return previousAssetId;
      }
      return assets[0].id;
    });
  }, [assetMap, assets]);

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetSnapshot(null);
      return;
    }

    setAssetSnapshot((previousAsset) => {
      if (previousAsset && previousAsset.id === selectedAssetId) {
        return previousAsset;
      }
      return assetMap.get(selectedAssetId) ?? null;
    });
  }, [assetMap, selectedAssetId]);

  useEffect(() => {
    if (!isFormVisible || !selectedAssetId) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    setIsAssetLoading(true);

    void getAssetDetail(selectedAssetId, { signal: controller.signal })
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        const detailedAsset = toPremiumInstallableAsset(payload);
        if (detailedAsset) {
          setAssetSnapshot(detailedAsset);
          return;
        }

        const fallbackAsset = assetMap.get(selectedAssetId) ?? null;
        setAssetSnapshot(fallbackAsset);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        if (error instanceof ApiError && error.code === 'ABORTED') {
          return;
        }

        const fallbackAsset = assetMap.get(selectedAssetId) ?? null;
        setAssetSnapshot(fallbackAsset);
        setRequestError(
          toPremiumRequestErrorState(
            error,
            '차량 상세 정보를 불러오지 못했습니다.',
            'asset',
          ),
        );
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setIsAssetLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [assetMap, isFormVisible, selectedAssetId]);

  useEffect(() => {
    if (!receipt) {
      return;
    }

    const matchedAsset = assetMap.get(receipt.assetId);
    if (!matchedAsset) {
      return;
    }

    if (matchedAsset.vehicleNumber === receipt.assetVehicleNumber && matchedAsset.vin === receipt.vin) {
      return;
    }

    const nextReceipt: PremiumInstallationReceipt = {
      ...receipt,
      assetVehicleNumber: matchedAsset.vehicleNumber,
      vin: matchedAsset.vin || receipt.vin,
    };
    persistReceipt(nextReceipt);
  }, [assetMap, persistReceipt, receipt]);

  const handleCTAClick = useCallback(() => {
    trackPremiumInstallationEvent('premium_installation_cta_click', {
      assetsWithoutDevice: assets.length,
    });

    if (assets.length === 0) {
      setRequestError({
        kind: 'unknown',
        source: 'submit',
        message: '장착 신청 대상 차량이 없습니다.',
      });
      return;
    }

    setRequestError(null);
    setIsFormVisible(true);
  }, [assets.length]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setRequestError(null);

    if (!selectedAsset) {
      setRequestError({
        kind: 'unknown',
        source: 'submit',
        message: '장착 신청 대상 차량을 선택해 주세요.',
      });
      return;
    }

    const normalizedVin = selectedAsset.vin.trim().toUpperCase();
    if (!normalizedVin || normalizedVin === '-') {
      setRequestError({
        kind: 'unknown',
        source: 'submit',
        message: '선택한 차량의 VIN 정보가 없어 신청할 수 없습니다.',
      });
      return;
    }

    const scheduledAtIso = toIsoDateTime(scheduledAt);
    if (!scheduledAtIso) {
      setRequestError({
        kind: 'unknown',
        source: 'submit',
        message: '희망 장착 일시 형식을 확인해 주세요.',
      });
      return;
    }

    const fingerprint = buildSubmitFingerprint({
      assetId: selectedAsset.id,
      vin: normalizedVin,
      scheduledAt: scheduledAtIso,
      contactPhone: contactPhone.trim(),
      memo: memo.trim(),
    });
    const now = Date.now();
    if (
      fingerprint === lastSubmitFingerprintRef.current
      && now - lastSubmitAtRef.current < 1500
    ) {
      setRequestError({
        kind: 'unknown',
        source: 'submit',
        message: '중복 제출을 방지하기 위해 잠시 후 다시 시도해 주세요.',
      });
      return;
    }

    lastSubmitFingerprintRef.current = fingerprint;
    lastSubmitAtRef.current = now;

    trackPremiumInstallationEvent('premium_installation_submit', {
      assetId: selectedAsset.id,
      vin: normalizedVin,
    });

    setIsSubmitting(true);

    try {
      const existingInstallation = await findInProgressInstallationByVin(normalizedVin);
      if (existingInstallation) {
        syncReceiptFromInstallation(existingInstallation, selectedAsset);
        setIsFormVisible(false);
        setRequestError({
          kind: 'conflict',
          source: 'submit',
          message: `이미 진행 중인 장착 신청이 있습니다. 접수번호 ${existingInstallation.id} 상태를 확인해 주세요.`,
        });
        trackPremiumInstallationEvent('premium_installation_fail', {
          reason: 'duplicate_in_progress',
          installationId: existingInstallation.id,
        });
        return;
      }

      const createdInstallation = await createDeviceInstallation({
        vin: normalizedVin,
        scheduledAt: scheduledAtIso,
        installer: user?.name ?? user?.userId ?? undefined,
        memo: buildRequestMemo({
          memo,
          contactPhone,
          requesterName: user?.name,
          requesterEmail: user?.email,
          assetId: selectedAsset.id,
        }) || undefined,
      });

      let resolvedInstallation = createdInstallation;
      try {
        resolvedInstallation = await getDeviceInstallation(createdInstallation.id);
      } catch {
        // If detail lookup fails here, keep created payload and allow manual refresh.
      }

      syncReceiptFromInstallation(resolvedInstallation, selectedAsset);
      setMemo('');
      setContactPhone('');
      setIsFormVisible(false);
      setRequestError(null);

      trackPremiumInstallationEvent('premium_installation_success', {
        installationId: resolvedInstallation.id,
        status: resolvedInstallation.status,
      });
    } catch (error) {
      const nextError = toPremiumRequestErrorState(
        error,
        '장착 신청 중 오류가 발생했습니다.',
        'submit',
      );
      setRequestError(nextError);

      if (error instanceof ApiError && error.status === 409) {
        try {
          const existingInstallation = await findInProgressInstallationByVin(normalizedVin);
          if (existingInstallation) {
            syncReceiptFromInstallation(existingInstallation, selectedAsset);
            setIsFormVisible(false);
          }
        } catch {
          // no-op
        }
      }

      trackPremiumInstallationEvent('premium_installation_fail', {
        reason: nextError.kind,
        status: error instanceof ApiError ? error.status : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    contactPhone,
    findInProgressInstallationByVin,
    isSubmitting,
    memo,
    scheduledAt,
    selectedAsset,
    syncReceiptFromInstallation,
    user?.email,
    user?.name,
    user?.userId,
  ]);

  const handleRefreshReceipt = useCallback(() => {
    if (!receipt) {
      return;
    }
    void refreshReceiptById(receipt.installationId, receipt);
  }, [receipt, refreshReceiptById]);

  const handleRetry = useCallback(() => {
    if (!requestError) {
      return;
    }

    if (requestError.source === 'status' && receipt) {
      void refreshReceiptById(receipt.installationId, receipt);
      return;
    }

    void handleSubmit();
  }, [handleSubmit, receipt, refreshReceiptById, requestError]);

  const handleErrorAction = useCallback(() => {
    if (!requestError) {
      return;
    }
    if (requestError.kind === 'unauthorized' || requestError.kind === 'forbidden') {
      handlePageErrorAction(requestError.kind, navigate);
    }
  }, [navigate, requestError]);

  const isActiveReceipt = receipt ? isInProgressRequestStatus(receipt.status) : false;
  const hasSameVinInProgress = Boolean(
    selectedAsset
    && receipt
    && isActiveReceipt
    && receipt.vin.trim().toUpperCase() === selectedAsset.vin.trim().toUpperCase(),
  );

  const pageActionKind = requestError?.kind === 'unauthorized' || requestError?.kind === 'forbidden'
    ? requestError.kind
    : null;
  const errorActionLabel = getPageErrorActionLabel(pageActionKind);

  return (
    <section className="mb-4">
      <PremiumBanner
        vehiclesWithoutDevice={assets.length}
        onCTAClick={handleCTAClick}
        disabled={assets.length === 0}
      />

      {requestError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{requestError.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {requestError.kind === 'retryable' && (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                재시도
              </button>
            )}
            {requestError.kind === 'conflict' && receipt && (
              <button
                type="button"
                onClick={handleRefreshReceipt}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                상태 조회
              </button>
            )}
            {errorActionLabel && (
              <button
                type="button"
                onClick={handleErrorAction}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                {errorActionLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {receipt && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-semibold">장착 신청 접수 완료</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toStatusBadgeClass(receipt.status)}`}>
              {toStatusLabel(receipt.status)}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm text-green-900 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-green-700">접수번호</dt>
              <dd className="font-semibold">{receipt.installationId}</dd>
            </div>
            <div>
              <dt className="text-xs text-green-700">차량번호</dt>
              <dd className="font-semibold">{receipt.assetVehicleNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-green-700">VIN</dt>
              <dd className="font-mono">{receipt.vin}</dd>
            </div>
            <div>
              <dt className="text-xs text-green-700">희망 장착 일시</dt>
              <dd>{formatDateTime(receipt.scheduledAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-green-700">최근 갱신</dt>
              <dd>{formatDateTime(receipt.updatedAt ?? receipt.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshReceipt}
              disabled={isStatusRefreshing}
              className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isStatusRefreshing ? 'animate-spin' : ''}`} />
              상태 새로고침
            </button>
            <button
              type="button"
              onClick={() => {
                persistReceipt(null);
                setRequestError(null);
                if (assets.length > 0) {
                  setIsFormVisible(true);
                }
              }}
              disabled={isActiveReceipt}
              className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              새 신청 작성
            </button>
          </div>

          {isActiveReceipt && (
            <p className="mt-2 text-xs text-green-700">
              진행 중 신청이 있어 동일 VIN 재신청은 제한됩니다. 상태가 완료/취소로 변경된 뒤 새 신청이 가능합니다.
            </p>
          )}
        </div>
      )}

      {isFormVisible && (
        <div className="rounded-lg border border-blue-200 bg-white px-4 py-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-gray-900">단말 장착 신청</h3>
            <p className="mt-1 text-sm text-gray-600">
              차량을 선택하고 희망 일시를 입력하면 접수번호와 처리 상태를 확인할 수 있습니다.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="premium-installation-asset" className="mb-1 block text-xs font-semibold text-gray-700">
                  신청 차량
                </label>
                <select
                  id="premium-installation-asset"
                  value={selectedAssetId}
                  onChange={(event) => {
                    setSelectedAssetId(event.target.value);
                    setRequestError(null);
                  }}
                  disabled={isSubmitting || assets.length === 0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.vehicleNumber} · {asset.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="premium-installation-scheduled-at" className="mb-1 block text-xs font-semibold text-gray-700">
                  희망 장착 일시 <span className="text-red-600">*</span>
                </label>
                <input
                  id="premium-installation-scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  VIN (자동 입력)
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedAsset?.vin ?? ''}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  신청자
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.name || user?.userId || '-'}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="premium-installation-contact-phone" className="mb-1 block text-xs font-semibold text-gray-700">
                  연락처 (선택)
                </label>
                <input
                  id="premium-installation-contact-phone"
                  type="text"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="010-0000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  신청자 이메일
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.email ?? '-'}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="premium-installation-memo" className="mb-1 block text-xs font-semibold text-gray-700">
                요청 메모 (선택)
              </label>
              <textarea
                id="premium-installation-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                disabled={isSubmitting}
                rows={3}
                placeholder="운영팀에 전달할 요청사항을 입력해 주세요."
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {isAssetLoading && (
              <div className="flex items-center gap-2 text-xs text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                선택 차량 상세 정보를 불러오는 중입니다.
              </div>
            )}

            {hasSameVinInProgress && receipt && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                현재 차량은 이미 접수번호 {receipt.installationId} 로 진행 중입니다. 상태를 확인한 뒤 다시 신청해 주세요.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormVisible(false);
                  setRequestError(null);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isAssetLoading || !selectedAsset || !scheduledAt || hasSameVinInProgress}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    신청 제출
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
