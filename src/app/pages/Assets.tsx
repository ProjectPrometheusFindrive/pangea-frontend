import { Layout } from '../components/Layout';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Upload,
  X,
  Loader2,
  FileText,
  Calendar as CalendarIcon,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router';
import { PremiumBanner } from '../components/PremiumBanner';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { VehicleDetailModal } from '../components/VehicleDetailModal';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import type { VehicleAsset } from '../data/mockData';
import { ApiError } from '../../services/api';
import {
  createAsset,
  getAssetDetail,
  getAssetHistory,
  getAssetsList,
  patchAsset,
} from '../../services/assets';

interface Asset extends VehicleAsset {
  id: string;
  hasDevice: boolean;
  version?: number;
  updatedAt?: string;
  createdAt?: string;
  plate?: string;
  memo?: string;
  category?: string;
  color?: string;
  contractStatus?: string;
}

interface AssetHistoryChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

interface AssetHistoryEntry {
  event: string;
  at: string;
  actor: string | null;
  versionFrom: number;
  versionTo: number;
  changes: AssetHistoryChange[];
}

interface AssetEditForm {
  plate: string;
  model: string;
  year: string;
  status: VehicleAsset['status'];
  memo: string;
}

interface CreateFormState {
  vehicleNumber: string;
  vin: string;
  model: string;
  year: string;
  owner: string;
  insuranceExpiry: string;
}

interface UploadedFiles {
  vehicleRegistration: File | null;
  insurance: File | null;
  loanSchedule: File | null;
}

type StatusFilterCode = 'all' | 'rental' | 'reserved' | 'available' | 'maintenance';
type AssetEditField = keyof AssetEditForm;
type CreateField = keyof Pick<CreateFormState, 'vehicleNumber' | 'vin' | 'model' | 'year'>;
type FieldErrorMap<TField extends string> = Partial<Record<TField, string>>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const ASSET_HISTORY_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const TOTAL_COUNT_KEYS = ['total', 'totalCount', 'count', 'itemsCount', 'totalElements'];
const DEFAULT_CREATE_FORM_STATE: CreateFormState = {
  vehicleNumber: '',
  vin: '',
  model: '',
  year: '',
  owner: '',
  insuranceExpiry: '',
};
const DEFAULT_ASSET_EDIT_FORM: AssetEditForm = {
  plate: '',
  model: '',
  year: '',
  status: '가용',
  memo: '',
};
const STATUS_TO_QUERY_MAP: Record<string, Exclude<StatusFilterCode, 'all'>> = {
  rental: 'rental',
  in_use: 'rental',
  대여중: 'rental',
  reserved: 'reserved',
  예약: 'reserved',
  예약됨: 'reserved',
  available: 'available',
  idle: 'available',
  가용: 'available',
  maintenance: 'maintenance',
  repair: 'maintenance',
  정비중: 'maintenance',
};

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
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function toPositiveInteger(value: string | null, fallbackValue: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function toStatusFilterCode(statusValue: string | null): StatusFilterCode {
  if (!statusValue) {
    return 'all';
  }

  const normalized = statusValue.trim();
  if (!normalized || normalized === 'all') {
    return 'all';
  }

  return STATUS_TO_QUERY_MAP[normalized] ?? 'all';
}

function toStatusQueryValue(statusValue: string | null): string | undefined {
  if (!statusValue) {
    return undefined;
  }

  const normalized = statusValue.trim();
  if (!normalized || normalized === 'all') {
    return undefined;
  }

  return STATUS_TO_QUERY_MAP[normalized] ?? normalized;
}

function toCanonicalKnownStatus(statusValue: string | null): Exclude<StatusFilterCode, 'all'> | null {
  if (!statusValue) {
    return null;
  }

  const normalized = statusValue.trim();
  if (!normalized || normalized === 'all') {
    return null;
  }

  return STATUS_TO_QUERY_MAP[normalized] ?? null;
}

function normalizeAssetStatus(statusValue: string | null): VehicleAsset['status'] {
  if (statusValue === '대여중' || statusValue === '예약' || statusValue === '가용' || statusValue === '정비중') {
    return statusValue;
  }

  if (statusValue === 'reserved' || statusValue === '예약됨' || statusValue === '예약중') {
    return '예약';
  }
  if (statusValue === 'rental' || statusValue === 'in_use') {
    return '대여중';
  }
  if (statusValue === 'available' || statusValue === 'idle') {
    return '가용';
  }
  if (statusValue === 'maintenance' || statusValue === 'repair') {
    return '정비중';
  }

  return '가용';
}

function normalizeAssetIssues(issueValue: unknown): string[] {
  if (!Array.isArray(issueValue)) {
    return [];
  }

  return issueValue
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (isRecord(entry)) {
        return toStringValue(entry.label) ?? toStringValue(entry.name) ?? toStringValue(entry.type) ?? '';
      }
      return '';
    })
    .filter((entry) => entry.length > 0);
}

function toAssetRecord(row: unknown, index: number): Asset | null {
  if (!isRecord(row)) {
    return null;
  }

  const vehicleNumber = toStringValue(row.vehicleNumber)
    ?? toStringValue(row.plateNumber)
    ?? toStringValue(row.plate)
    ?? toStringValue(row.number);

  if (!vehicleNumber) {
    return null;
  }

  const hasDevice = toBooleanValue(row.hasDevice) ?? toBooleanValue(row.hasPremiumDevice) ?? false;
  const plateValue = toStringValue(row.plate) ?? toStringValue(row.vehicleNumber) ?? vehicleNumber;
  const statusValue = toStringValue(row.status)
    ?? toStringValue(row.assetStatus)
    ?? toStringValue(row.contractStatus);

  return {
    id: toStringValue(row.id)
      ?? toStringValue(row.assetId)
      ?? toStringValue(row.uuid)
      ?? `A${String(index + 1).padStart(3, '0')}`,
    vehicleNumber,
    plate: plateValue,
    model: toStringValue(row.model) ?? toStringValue(row.vehicleModel) ?? '차종 미확인',
    status: normalizeAssetStatus(statusValue),
    issues: normalizeAssetIssues(row.issues),
    insuranceExpiry: toStringValue(row.insuranceExpiry) ?? toStringValue(row.insuranceExpiryDate) ?? '-',
    nextInspection: toStringValue(row.nextInspection) ?? toStringValue(row.nextInspectionDate) ?? '-',
    vin: toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? '-',
    year: toStringValue(row.year) ?? toStringValue(row.modelYear) ?? '-',
    owner: toStringValue(row.owner) ?? toStringValue(row.ownerName) ?? '-',
    version: toNumberValue(row.version) ?? undefined,
    createdAt: toStringValue(row.createdAt) ?? undefined,
    updatedAt: toStringValue(row.updatedAt) ?? undefined,
    memo: toStringValue(row.memo) ?? undefined,
    category: toStringValue(row.category) ?? undefined,
    color: toStringValue(row.color) ?? undefined,
    contractStatus: toStringValue(row.contractStatus) ?? undefined,
    hasPremiumDevice: hasDevice,
    hasDevice,
  };
}

function toAssetRows(payload: unknown): Asset[] {
  const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
  if (!rows) {
    return [];
  }

  if (rows.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => toAssetRecord(row, index))
    .filter((row): row is Asset => row !== null);
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

function toAssetDetail(payload: unknown): Asset | null {
  const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
  if (rows && rows.length > 0) {
    return toAssetRecord(rows[0], 0);
  }

  return toAssetRecord(unwrapAssetDetail(payload), 0);
}

function toAssetEditForm(asset: Asset): AssetEditForm {
  return {
    plate: (asset.plate ?? asset.vehicleNumber ?? '').trim(),
    model: (asset.model ?? '').trim(),
    year: (asset.year ?? '').trim(),
    status: asset.status,
    memo: (asset.memo ?? '').trim(),
  };
}

function toAssetHistoryEntries(payload: unknown): AssetHistoryEntry[] {
  const rows = getCollectionFromPayload(payload, ['items', 'rows', 'list', 'history']);
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }

      const rawChanges = Array.isArray(row.changes) ? row.changes : [];
      const changes = rawChanges
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }
          const field = toStringValue(entry.field);
          if (!field) {
            return null;
          }
          return {
            field,
            before: entry.before,
            after: entry.after,
          };
        })
        .filter((entry): entry is AssetHistoryChange => entry !== null);

      const event = toStringValue(row.event);
      const at = toStringValue(row.at);
      const versionFrom = toNumberValue(row.versionFrom);
      const versionTo = toNumberValue(row.versionTo);

      if (!event || !at || versionFrom === null || versionTo === null) {
        return null;
      }

      return {
        event,
        at,
        actor: toStringValue(row.actor),
        versionFrom,
        versionTo,
        changes,
      } satisfies AssetHistoryEntry;
    })
    .filter((entry): entry is AssetHistoryEntry => entry !== null);
}

function normalizePatchStatusValue(status: VehicleAsset['status']): string {
  if (status === '예약') {
    return '예약중';
  }
  return status;
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

      const name = toStringValue(detailEntry.name)
        ?? toStringValue(detailEntry.field)
        ?? toStringValue(detailEntry.path)
        ?? toStringValue(detailEntry.loc);
      const reason = toStringValue(detailEntry.reason)
        ?? toStringValue(detailEntry.message)
        ?? toStringValue(detailEntry.detail)
        ?? toStringValue(detailEntry.error);

      if (!name || !reason) {
        continue;
      }
      entries.push({ name, reason });
    }
  }

  return entries;
}

function mapFieldErrors<TField extends string>(
  entries: Array<{ name: string; reason: string }>,
  fieldMap: Record<string, TField>,
): FieldErrorMap<TField> {
  const mapped: FieldErrorMap<TField> = {};

  for (const { name, reason } of entries) {
    const mappedName = fieldMap[name];
    if (!mappedName) {
      continue;
    }
    if (!mapped[mappedName]) {
      mapped[mappedName] = reason;
    }
  }

  return mapped;
}

function toCreateFieldErrors(error: ApiError): FieldErrorMap<CreateField> {
  return mapFieldErrors<CreateField>(toErrorFieldEntries(error), {
    vehicleNumber: 'vehicleNumber',
    plate: 'vehicleNumber',
    vin: 'vin',
    model: 'model',
    year: 'year',
  });
}

function toAssetEditFieldErrors(error: ApiError): FieldErrorMap<AssetEditField> {
  return mapFieldErrors<AssetEditField>(toErrorFieldEntries(error), {
    vehicleNumber: 'plate',
    plate: 'plate',
    model: 'model',
    year: 'year',
    status: 'status',
    memo: 'memo',
  });
}

function toCreatePayload(form: CreateFormState): {
  payload: {
    vin: string;
    plate: string;
    vehicleNumber: string;
    model?: string;
    year?: number;
  } | null;
  fieldErrors: FieldErrorMap<CreateField>;
} {
  const fieldErrors: FieldErrorMap<CreateField> = {};

  const vehicleNumber = form.vehicleNumber.trim();
  const vin = form.vin.trim();
  const model = form.model.trim();
  const yearText = form.year.trim();

  if (!vehicleNumber) {
    fieldErrors.vehicleNumber = '차량번호를 입력해 주세요.';
  }
  if (!vin) {
    fieldErrors.vin = '차대번호를 입력해 주세요.';
  }

  let year: number | undefined;
  if (yearText.length > 0) {
    const parsedYear = Number(yearText);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 3000) {
      fieldErrors.year = '연식은 4자리 숫자로 입력해 주세요.';
    } else {
      year = parsedYear;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { payload: null, fieldErrors };
  }

  return {
    payload: {
      vin,
      plate: vehicleNumber,
      vehicleNumber,
      model: model || undefined,
      year,
    },
    fieldErrors,
  };
}

function getTotalCountFromObject(source: unknown): number | null {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of TOTAL_COUNT_KEYS) {
    const count = toNumberValue(source[key]);
    if (count !== null) {
      return count;
    }
  }

  if (isRecord(source.meta)) {
    const nestedCount = getTotalCountFromObject(source.meta);
    if (nestedCount !== null) {
      return nestedCount;
    }
  }

  if (isRecord(source.page)) {
    const nestedCount = getTotalCountFromObject(source.page);
    if (nestedCount !== null) {
      return nestedCount;
    }
  }

  if (isRecord(source.pagination)) {
    const nestedCount = getTotalCountFromObject(source.pagination);
    if (nestedCount !== null) {
      return nestedCount;
    }
  }

  return null;
}

function cleanupAssetsQueryParams(params: URLSearchParams): void {
  if (params.get('page') === String(DEFAULT_PAGE)) {
    params.delete('page');
  }

  if (params.get('size') === String(DEFAULT_PAGE_SIZE)) {
    params.delete('size');
  }

  if (params.get('status') === 'all') {
    params.delete('status');
  }

  const query = params.get('q');
  if (!query || query.trim().length === 0) {
    params.delete('q');
  }
}

export default function Assets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const page = toPositiveInteger(searchParams.get('page'), DEFAULT_PAGE);
  const pageSize = toPositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE);
  const statusParam = searchParams.get('status');
  const statusFilterCode = toStatusFilterCode(statusParam);
  const statusQueryValue = toStatusQueryValue(statusParam);
  const vehicleQuery = (searchParams.get('vehicle') ?? '').trim();
  const queryKeyword = searchParams.get('q') ?? searchParams.get('search') ?? '';
  const keyword = (queryKeyword || vehicleQuery).trim();
  const selectedAssetId = (searchParams.get('assetId') ?? '').trim();

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [uploadStep, setUploadStep] = useState<'upload' | 'processing' | 'preview'>('upload');
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM_STATE);
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrorMap<CreateField>>({});
  const [createSaveError, setCreateSaveError] = useState<string | null>(null);
  const [isCreateSaving, setIsCreateSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({
    vehicleRegistration: null,
    insurance: null,
    loanSchedule: null,
  });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [assetsErrorStatus, setAssetsErrorStatus] = useState<number | null>(null);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailForm, setDetailForm] = useState<AssetEditForm>(DEFAULT_ASSET_EDIT_FORM);
  const [detailFieldErrors, setDetailFieldErrors] = useState<FieldErrorMap<AssetEditField>>({});
  const [detailSaveError, setDetailSaveError] = useState<string | null>(null);
  const [detailConflictNotice, setDetailConflictNotice] = useState<string | null>(null);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>([]);
  const [isAssetHistoryLoading, setIsAssetHistoryLoading] = useState(false);
  const [assetHistoryError, setAssetHistoryError] = useState<string | null>(null);
  const detailRequestSequenceRef = useRef(0);
  const detailAbortControllerRef = useRef<AbortController | null>(null);
  const historyRequestSequenceRef = useRef(0);
  const historyAbortControllerRef = useRef<AbortController | null>(null);
  const ocrProcessingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAssetsSearchParams = useCallback((
    mutator: (params: URLSearchParams) => void,
    replace = false,
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    mutator(nextParams);
    cleanupAssetsQueryParams(nextParams);
    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const legacySearch = searchParams.get('search');
    const canonicalQuery = searchParams.get('q');
    if (!legacySearch || canonicalQuery) {
      return;
    }

    updateAssetsSearchParams((params) => {
      params.set('q', legacySearch);
      params.delete('search');
    }, true);
  }, [searchParams, updateAssetsSearchParams]);

  useEffect(() => {
    const canonicalStatus = toCanonicalKnownStatus(statusParam);
    if (!statusParam || !canonicalStatus || statusParam === canonicalStatus) {
      return;
    }

    updateAssetsSearchParams((params) => {
      params.set('status', canonicalStatus);
    }, true);
  }, [statusParam, updateAssetsSearchParams]);

  const requestAssets = useCallback(async (signal: AbortSignal) => {
    try {
      return await getAssetsList({
        page,
        size: pageSize,
        status: statusQueryValue,
        q: keyword || undefined,
        signal,
      });
    } catch (error) {
      setAssetsErrorStatus(error instanceof ApiError ? error.status ?? null : null);
      throw error;
    }
  }, [keyword, page, pageSize, statusQueryValue]);

  const handleAssetsSuccess = useCallback((payload: unknown) => {
    setAssets(toAssetRows(payload));
    setTotalCount(getTotalCountFromObject(payload));
    setAssetsErrorStatus(null);
  }, []);

  const isAssetsPayloadEmpty = useCallback((payload: unknown) => {
    const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
    if (rows) {
      return rows.length === 0;
    }
    return isPayloadEmpty(payload, ['assets', 'items', 'rows', 'list']);
  }, []);

  const {
    isLoading: isAssetsLoading,
    error: assetsError,
    errorKind: assetsErrorKind,
    isEmpty: isAssetsApiEmpty,
    run: hydrateAssets,
  } = usePageEndpointState<unknown>({
    request: requestAssets,
    onSuccess: handleAssetsSuccess,
    isEmpty: isAssetsPayloadEmpty,
  });

  useEffect(() => {
    void hydrateAssets();
  }, [hydrateAssets]);

  const handleAssetsRetry = useCallback(() => {
    void hydrateAssets();
  }, [hydrateAssets]);

  const clearOcrProcessingTimer = useCallback(() => {
    if (ocrProcessingTimeoutRef.current) {
      clearTimeout(ocrProcessingTimeoutRef.current);
      ocrProcessingTimeoutRef.current = null;
    }
  }, []);

  const resetCreateModalState = useCallback(() => {
    clearOcrProcessingTimer();
    setUploadStep('upload');
    setCreateForm(DEFAULT_CREATE_FORM_STATE);
    setCreateFieldErrors({});
    setCreateSaveError(null);
    setIsCreateSaving(false);
    setUploadedFiles({
      vehicleRegistration: null,
      insurance: null,
      loanSchedule: null,
    });
  }, [clearOcrProcessingTimer]);

  useEffect(() => () => {
    detailAbortControllerRef.current?.abort();
    historyAbortControllerRef.current?.abort();
    clearOcrProcessingTimer();
  }, [clearOcrProcessingTimer]);

  const isCreateDirty = useMemo(() => (
    uploadStep !== 'upload'
    || Boolean(createForm.vehicleNumber.trim())
    || Boolean(createForm.vin.trim())
    || Boolean(createForm.model.trim())
    || Boolean(createForm.year.trim())
    || Boolean(createForm.owner.trim())
    || Boolean(createForm.insuranceExpiry.trim())
    || uploadedFiles.vehicleRegistration !== null
    || uploadedFiles.insurance !== null
    || uploadedFiles.loanSchedule !== null
  ), [createForm, uploadStep, uploadedFiles]);

  const isDetailDirty = useMemo(() => {
    if (!selectedAsset) {
      return false;
    }
    const baseline = toAssetEditForm(selectedAsset);
    return (
      baseline.plate !== detailForm.plate.trim()
      || baseline.model !== detailForm.model.trim()
      || baseline.year !== detailForm.year.trim()
      || baseline.status !== detailForm.status
      || baseline.memo !== detailForm.memo.trim()
    );
  }, [detailForm, selectedAsset]);

  useEffect(() => {
    const hasUnsavedChanges = (
      (showModal && isCreateDirty && !isCreateSaving)
      || (showDetailModal && isDetailDirty && !isDetailSaving)
    );
    if (!hasUnsavedChanges || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreateDirty, isCreateSaving, isDetailDirty, isDetailSaving, showDetailModal, showModal]);

  const openCreateModal = useCallback(() => {
    resetCreateModalState();
    setShowModal(true);
  }, [resetCreateModalState]);

  const closeCreateModal = useCallback((): boolean => {
    if (isCreateSaving) {
      return false;
    }
    if (showModal && isCreateDirty && typeof window !== 'undefined') {
      const shouldDiscard = window.confirm('저장하지 않은 등록 정보가 있습니다. 닫으시겠습니까?');
      if (!shouldDiscard) {
        return false;
      }
    }

    setShowModal(false);
    resetCreateModalState();
    return true;
  }, [isCreateDirty, isCreateSaving, resetCreateModalState, showModal]);

  const closeDetailModalState = useCallback(() => {
    detailAbortControllerRef.current?.abort();
    historyAbortControllerRef.current?.abort();
    setShowDetailModal(false);
    setSelectedAsset(null);
    setIsDetailLoading(false);
    setDetailNotice(null);
    setIsDetailSaving(false);
    setDetailForm(DEFAULT_ASSET_EDIT_FORM);
    setDetailFieldErrors({});
    setDetailSaveError(null);
    setDetailConflictNotice(null);
    setAssetHistory([]);
    setAssetHistoryError(null);
    setIsAssetHistoryLoading(false);
    updateAssetsSearchParams((params) => {
      params.delete('assetId');
      params.delete('vehicle');
    }, true);
  }, [updateAssetsSearchParams]);

  const resetAssetFilters = useCallback(() => {
    updateAssetsSearchParams((params) => {
      params.delete('q');
      params.delete('search');
      params.delete('status');
      params.delete('assetId');
      params.delete('vehicle');
      params.set('page', String(DEFAULT_PAGE));
      params.set('size', String(DEFAULT_PAGE_SIZE));
    });
  }, [updateAssetsSearchParams]);

  const handleAssetsErrorAction = useCallback(() => {
    if (assetsErrorStatus === 400) {
      if (typeof window !== 'undefined') {
        window.alert('잘못된 필터 값이 감지되어 필터를 초기화합니다.');
      }
      resetAssetFilters();
      return;
    }
    handlePageErrorAction(assetsErrorKind, navigate);
  }, [assetsErrorKind, assetsErrorStatus, navigate, resetAssetFilters]);

  useEffect(() => {
    if (!vehicleQuery || isAssetsLoading || assets.length === 0) {
      return;
    }

    const targetAsset = assets.find((asset) => asset.vehicleNumber === vehicleQuery);
    if (!targetAsset) {
      return;
    }

    if (selectedAssetId === targetAsset.id && !searchParams.get('vehicle')) {
      return;
    }

    updateAssetsSearchParams((params) => {
      params.set('assetId', targetAsset.id);
      params.set('q', vehicleQuery);
      params.delete('search');
      params.delete('vehicle');
      params.set('page', '1');
    }, true);
  }, [
    assets,
    isAssetsLoading,
    searchParams,
    selectedAssetId,
    updateAssetsSearchParams,
    vehicleQuery,
  ]);

  const hydrateAssetHistory = useCallback(async (assetId: string) => {
    const requestSequence = historyRequestSequenceRef.current + 1;
    historyRequestSequenceRef.current = requestSequence;
    historyAbortControllerRef.current?.abort();
    const controller = new AbortController();
    historyAbortControllerRef.current = controller;

    setIsAssetHistoryLoading(true);
    setAssetHistoryError(null);

    try {
      const payload = await getAssetHistory(assetId, {
        page: 1,
        pageSize: ASSET_HISTORY_PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || historyRequestSequenceRef.current !== requestSequence) {
        return;
      }
      setAssetHistory(toAssetHistoryEntries(payload));
    } catch (error) {
      if (controller.signal.aborted || historyRequestSequenceRef.current !== requestSequence) {
        return;
      }
      const historyErrorMessage = error instanceof ApiError
        ? error.message
        : '변경 이력을 불러오지 못했습니다.';
      setAssetHistoryError(`이력 조회 실패: ${historyErrorMessage}`);
      setAssetHistory([]);
    } finally {
      if (!controller.signal.aborted && historyRequestSequenceRef.current === requestSequence) {
        setIsAssetHistoryLoading(false);
      }
    }
  }, []);

  const hydrateAssetDetail = useCallback(async (
    assetId: string,
    options: { preserveForm?: boolean; preserveConflictNotice?: boolean } = {},
  ) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;
    detailAbortControllerRef.current?.abort();
    const controller = new AbortController();
    detailAbortControllerRef.current = controller;

    setIsDetailLoading(true);
    setDetailNotice(null);

    try {
      const payload = await getAssetDetail(assetId, { signal: controller.signal });
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      const nextAsset = toAssetDetail(payload);
      if (!nextAsset) {
        setSelectedAsset(null);
        setShowDetailModal(false);
        setDetailNotice('자산 상세 정보를 확인할 수 없습니다. 목록에서 다시 선택해 주세요.');
        return;
      }

      setSelectedAsset(nextAsset);
      if (!options.preserveForm) {
        setDetailForm(toAssetEditForm(nextAsset));
        setDetailFieldErrors({});
        setDetailSaveError(null);
      }
      if (!options.preserveConflictNotice) {
        setDetailConflictNotice(null);
      }

      setShowDetailModal(true);
      void hydrateAssetHistory(nextAsset.id);
    } catch (error) {
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setSelectedAsset(null);
        setShowDetailModal(false);
        setDetailNotice('요청한 자산이 존재하지 않습니다. 목록에서 다시 선택해 주세요.');
        updateAssetsSearchParams((params) => {
          params.delete('assetId');
          params.delete('vehicle');
        }, true);
        return;
      }

      const detailErrorMessage = error instanceof ApiError
        ? error.message
        : '상세 정보를 불러오지 못했습니다.';
      setDetailNotice(`상세 조회 실패: ${detailErrorMessage}`);
      setShowDetailModal(false);
    } finally {
      if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  }, [hydrateAssetHistory, updateAssetsSearchParams]);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }

    void hydrateAssetDetail(selectedAssetId);
  }, [hydrateAssetDetail, selectedAssetId]);

  const handleHistoryRetry = useCallback(() => {
    if (!selectedAsset) {
      return;
    }
    void hydrateAssetHistory(selectedAsset.id);
  }, [hydrateAssetHistory, selectedAsset]);

  const handleConflictRefresh = useCallback(() => {
    if (!selectedAsset) {
      return;
    }
    void hydrateAssetDetail(selectedAsset.id, { preserveForm: true });
    void hydrateAssets();
  }, [hydrateAssetDetail, hydrateAssets, selectedAsset]);

  const handleKeywordChange = useCallback((nextKeyword: string) => {
    updateAssetsSearchParams((params) => {
      if (nextKeyword.trim().length > 0) {
        params.set('q', nextKeyword);
      } else {
        params.delete('q');
      }
      params.delete('search');
      params.delete('assetId');
      params.delete('vehicle');
      params.set('page', '1');
    });
  }, [updateAssetsSearchParams]);

  const handleStatusChange = useCallback((nextStatus: StatusFilterCode) => {
    updateAssetsSearchParams((params) => {
      if (nextStatus === 'all') {
        params.delete('status');
      } else {
        params.set('status', nextStatus);
      }
      params.delete('assetId');
      params.delete('vehicle');
      params.set('page', '1');
    });
  }, [updateAssetsSearchParams]);

  const handlePageChange = useCallback((nextPage: number) => {
    const safeNextPage = Math.max(1, nextPage);
    updateAssetsSearchParams((params) => {
      params.set('page', String(safeNextPage));
      params.delete('assetId');
      params.delete('vehicle');
    });
  }, [updateAssetsSearchParams]);

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    updateAssetsSearchParams((params) => {
      params.set('size', String(nextPageSize));
      params.set('page', '1');
      params.delete('assetId');
      params.delete('vehicle');
    });
  }, [updateAssetsSearchParams]);

  const handleDetailModalOpen = useCallback((asset: Asset) => {
    if (showDetailModal && isDetailDirty && typeof window !== 'undefined') {
      const shouldDiscard = window.confirm('저장하지 않은 수정 내용이 있습니다. 다른 자산을 여시겠습니까?');
      if (!shouldDiscard) {
        return;
      }
    }

    updateAssetsSearchParams((params) => {
      params.set('assetId', asset.id);
      params.delete('vehicle');
    });
  }, [isDetailDirty, showDetailModal, updateAssetsSearchParams]);

  const handleDetailModalClose = useCallback((): boolean => {
    if (isDetailSaving) {
      return false;
    }
    if (showDetailModal && isDetailDirty && typeof window !== 'undefined') {
      const shouldDiscard = window.confirm('저장하지 않은 수정 내용이 있습니다. 닫으시겠습니까?');
      if (!shouldDiscard) {
        return false;
      }
    }

    closeDetailModalState();
    return true;
  }, [closeDetailModalState, isDetailDirty, isDetailSaving, showDetailModal]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '가용':
        return 'bg-green-100 text-green-700';
      case '대여중':
        return 'bg-blue-100 text-blue-700';
      case '예약':
      case '예약됨':
      case '예약중':
        return 'bg-purple-100 text-purple-700';
      case '정비중':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const statusCountMap = useMemo(() => ({
    rental: assets.filter((asset) => asset.status === '대여중').length,
    reserved: assets.filter((asset) => asset.status === '예약').length,
    available: assets.filter((asset) => asset.status === '가용').length,
    maintenance: assets.filter((asset) => asset.status === '정비중').length,
  }), [assets]);

  const totalPages = useMemo(() => {
    if (totalCount === null) {
      return null;
    }
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [pageSize, totalCount]);
  const hasPrevPage = page > 1;
  const hasNextPage = totalPages !== null
    ? page < totalPages
    : assets.length >= pageSize && !isAssetsApiEmpty;
  const isOutOfRangePage = totalPages !== null && page > totalPages;
  const isOutOfRangeError = assetsErrorStatus === 400 && page > 1 && assets.length === 0;
  const shouldShowOutOfRangeEmpty = isOutOfRangePage || isOutOfRangeError;

  const isAssetsEmpty = (
    !isAssetsLoading
    && !assetsError
    && (isAssetsApiEmpty || assets.length === 0)
  ) || isOutOfRangeError;
  const vehiclesWithoutDevice = assets.filter((asset) => !asset.hasDevice).length;

  const handleCreateFieldChange = useCallback((field: keyof CreateFormState, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateSaveError(null);
    if (field in createFieldErrors) {
      setCreateFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field as CreateField];
        return next;
      });
    }
  }, [createFieldErrors]);

  const handleDetailFieldChange = useCallback((field: AssetEditField, value: string) => {
    if (field === 'status') {
      setDetailForm((prev) => ({ ...prev, status: value as VehicleAsset['status'] }));
    } else {
      setDetailForm((prev) => ({ ...prev, [field]: value }));
    }
    setDetailSaveError(null);
    setDetailConflictNotice(null);
    if (field in detailFieldErrors) {
      setDetailFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [detailFieldErrors]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles((prev) => ({ ...prev, vehicleRegistration: file }));
      setUploadStep('processing');

      setCreateSaveError(null);
      setCreateFieldErrors({});
      clearOcrProcessingTimer();

      // OCR 자동 추출(BK-085에서 서버 연동 예정) 전 임시 프리뷰 채움.
      ocrProcessingTimeoutRef.current = setTimeout(() => {
        setCreateForm({
          vehicleNumber: '99허9999',
          vin: 'KMHXX00XXXX000000',
          model: '아이오닉5',
          year: '2024',
          owner: '렌터카(주)',
          insuranceExpiry: '2025-12-15',
        });
        setUploadStep('preview');
        ocrProcessingTimeoutRef.current = null;
      }, 2000);
    }
  }, [clearOcrProcessingTimer]);

  const handleLoanScheduleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles((prev) => ({ ...prev, loanSchedule: file }));
    }
  }, []);

  const handleCreateSave = useCallback(async () => {
    if (isCreateSaving) {
      return;
    }

    const { payload, fieldErrors } = toCreatePayload(createForm);
    if (!payload) {
      setCreateFieldErrors(fieldErrors);
      setCreateSaveError('필수 입력값을 확인해 주세요.');
      return;
    }

    setIsCreateSaving(true);
    setCreateSaveError(null);
    setCreateFieldErrors({});

    try {
      const responsePayload = await createAsset(payload);
      const createdAsset = toAssetDetail(responsePayload);
      if (!createdAsset) {
        throw new Error('생성 응답에서 자산 정보를 확인할 수 없습니다.');
      }

      setShowModal(false);
      resetCreateModalState();

      updateAssetsSearchParams((params) => {
        params.set('assetId', createdAsset.id);
        params.delete('vehicle');
      }, true);

      void hydrateAssets();
      toast.success('차량 자산이 등록되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const nextFieldErrors = toCreateFieldErrors(error);
          if (Object.keys(nextFieldErrors).length > 0) {
            setCreateFieldErrors(nextFieldErrors);
          }
          setCreateSaveError(error.message || '입력값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setCreateSaveError('차량 자산 등록 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setCreateSaveError(error.message || '이미 등록된 차량 정보입니다. 입력값을 확인해 주세요.');
          return;
        }
      }

      setCreateSaveError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsCreateSaving(false);
    }
  }, [createForm, hydrateAssets, isCreateSaving, resetCreateModalState, updateAssetsSearchParams]);

  const handleDetailSave = useCallback(async () => {
    if (!selectedAsset || isDetailSaving) {
      return;
    }
    if (!isDetailDirty) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }
    if (typeof selectedAsset.version !== 'number') {
      setDetailSaveError('자산 버전 정보를 확인할 수 없습니다. 상세 정보를 새로고침해 주세요.');
      return;
    }

    const clientFieldErrors: FieldErrorMap<AssetEditField> = {};
    const baseline = toAssetEditForm(selectedAsset);
    const nextPlate = detailForm.plate.trim();
    const nextModel = detailForm.model.trim();
    const nextYearText = detailForm.year.trim();
    const nextMemo = detailForm.memo.trim();

    if (!nextPlate) {
      clientFieldErrors.plate = '차량번호를 입력해 주세요.';
    }

    let parsedYear: number | undefined;
    if (nextYearText.length > 0) {
      const numericYear = Number(nextYearText);
      if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 3000) {
        clientFieldErrors.year = '연식은 4자리 숫자로 입력해 주세요.';
      } else {
        parsedYear = numericYear;
      }
    } else if (baseline.year.length > 0 && baseline.year !== nextYearText) {
      clientFieldErrors.year = '연식을 수정하려면 유효한 숫자를 입력해 주세요.';
    }

    if (Object.keys(clientFieldErrors).length > 0) {
      setDetailFieldErrors(clientFieldErrors);
      setDetailSaveError('입력값을 확인해 주세요.');
      return;
    }

    const payload: {
      version: number;
      plate?: string;
      vehicleNumber?: string;
      model?: string;
      year?: number;
      status?: string;
      memo?: string;
    } = {
      version: selectedAsset.version,
    };

    if (baseline.plate !== nextPlate) {
      payload.plate = nextPlate;
      payload.vehicleNumber = nextPlate;
    }
    if (baseline.model !== nextModel) {
      payload.model = nextModel || undefined;
    }
    if (baseline.year !== nextYearText && parsedYear !== undefined) {
      payload.year = parsedYear;
    }
    if (baseline.status !== detailForm.status) {
      payload.status = normalizePatchStatusValue(detailForm.status);
    }
    if (baseline.memo !== nextMemo) {
      payload.memo = nextMemo;
    }

    if (Object.keys(payload).length === 1) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }

    setIsDetailSaving(true);
    setDetailSaveError(null);
    setDetailFieldErrors({});
    setDetailConflictNotice(null);

    try {
      const responsePayload = await patchAsset(selectedAsset.id, payload);
      const updatedAsset = toAssetDetail(responsePayload);
      if (!updatedAsset) {
        throw new Error('수정 응답에서 자산 정보를 확인할 수 없습니다.');
      }

      setSelectedAsset(updatedAsset);
      setDetailForm(toAssetEditForm(updatedAsset));
      setDetailFieldErrors({});
      setDetailSaveError(null);
      setDetailConflictNotice(null);
      setAssets((prevAssets) => prevAssets.map((asset) => (asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset)));
      void hydrateAssetHistory(updatedAsset.id);
      void hydrateAssets();
      toast.success('차량 정보가 업데이트되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const nextFieldErrors = toAssetEditFieldErrors(error);
          if (Object.keys(nextFieldErrors).length > 0) {
            setDetailFieldErrors(nextFieldErrors);
          }
          setDetailSaveError(error.message || '입력값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setDetailSaveError('차량 자산 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setDetailConflictNotice('다른 변경 사항이 먼저 저장되었습니다. 최신 데이터로 새로고침 후 다시 저장해 주세요.');
          setDetailSaveError(error.message || '버전 충돌이 발생했습니다.');
          void hydrateAssetDetail(selectedAsset.id, { preserveForm: true, preserveConflictNotice: true });
          return;
        }
      }

      setDetailSaveError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDetailSaving(false);
    }
  }, [
    detailForm,
    hydrateAssetDetail,
    hydrateAssetHistory,
    hydrateAssets,
    isDetailDirty,
    isDetailSaving,
    selectedAsset,
  ]);

  return (
    <Layout title="차량 자산">
      <div className="p-6">
        {/* 프리미엄 배너 - 단말 미설치 차량 유도 */}
        <PremiumBanner 
          vehiclesWithoutDevice={vehiclesWithoutDevice}
          onCTAClick={() => {
            alert('프리미엄 문의: 1588-XXXX\n\n단말 일괄 설치 신청이 접수되었습니다.\n담당자가 곧 연락드리겠습니다.');
          }}
        />

        {detailNotice && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            {detailNotice}
          </div>
        )}

        {isDetailLoading && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            자산 상세 정보를 불러오는 중입니다.
          </div>
        )}

        {/* 상단 헤더 & 필터 */}
        <div className="mb-6 mt-4 space-y-4">
          {/* 검색창 */}
          <div className="relative">
            <input
              type="text"
              placeholder="차량번호 또는 차종으로 검색..."
              value={queryKeyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
            {queryKeyword && (
              <button
                onClick={() => handleKeywordChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 상태 필터 버튼 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">차량 상태:</span>
            <button
              onClick={() => handleStatusChange('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({assets.length})
            </button>
            <button
              onClick={() => handleStatusChange('rental')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'rental'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대여중 ({statusCountMap.rental})
            </button>
            <button
              onClick={() => handleStatusChange('reserved')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'reserved'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              예약 ({statusCountMap.reserved})
            </button>
            <button
              onClick={() => handleStatusChange('available')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'available'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              가용 ({statusCountMap.available})
            </button>
            <button
              onClick={() => handleStatusChange('maintenance')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'maintenance'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              정비중 ({statusCountMap.maintenance})
            </button>
          </div>

          {/* 페이지 크기 & 등록 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">페이지 크기:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                {!PAGE_SIZE_OPTIONS.includes(pageSize) && (
                  <option value={pageSize}>{pageSize}개</option>
                )}
                {PAGE_SIZE_OPTIONS.map((sizeOption) => (
                  <option key={sizeOption} value={sizeOption}>
                    {sizeOption}개
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                {totalCount !== null
                  ? `총 ${totalCount}대`
                  : `${assets.length}대 표시 중`}
              </span>
            </div>
            
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              차량 자산 등록
            </button>
          </div>
        </div>

        {/* 자산 테이블 */}
        <PageStateBoundary
          isLoading={isAssetsLoading}
          error={isOutOfRangeError ? null : assetsError}
          isEmpty={isAssetsEmpty}
          errorDescription={
            assetsErrorStatus === 400
              ? '필터 값이 올바르지 않습니다. 필터를 초기화하고 다시 시도해 주세요.'
              : '차량 자산 목록을 불러오는 중 문제가 발생했습니다.'
          }
          emptyTitle="조건에 맞는 차량이 없습니다"
          emptyDescription={
            shouldShowOutOfRangeEmpty
              ? '요청한 페이지 범위를 벗어났습니다. 첫 페이지에서 다시 확인해 주세요.'
              : '검색어 또는 필터를 조정해 다시 확인해 주세요.'
          }
          onRetry={handleAssetsRetry}
          errorActionLabel={assetsErrorStatus === 400 ? '필터 초기화' : getPageErrorActionLabel(assetsErrorKind)}
          onErrorAction={handleAssetsErrorAction}
          emptyActionLabel={shouldShowOutOfRangeEmpty ? '첫 페이지로 이동' : '필터 초기화'}
          onEmptyAction={shouldShowOutOfRangeEmpty ? () => handlePageChange(1) : resetAssetFilters}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">차량번호</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">차종</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태이상 요약</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">보험만료일</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">다음 정기점검일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDetailModalOpen(asset)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {asset.vehicleNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.model}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {asset.issues.slice(0, 2).map((issue, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700"
                            >
                              {issue}
                            </span>
                          ))}
                          {asset.issues.length === 0 && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {asset.insuranceExpiry}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {asset.nextInspection}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <p className="text-sm text-gray-600">
                {totalCount !== null
                  ? `총 ${totalCount}대 · ${page} / ${totalPages ?? page} 페이지`
                  : `현재 페이지 ${page} · ${assets.length}대`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!hasPrevPage || isAssetsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNextPage || isAssetsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </PageStateBoundary>

        {/* OCR 업로드 모달 */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[600px] max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#1e2939]">차량등록증 업로드 (OCR)</h2>
                  <button
                    onClick={closeCreateModal}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isCreateDirty && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    저장 전 변경사항이 있습니다.
                  </div>
                )}

                {createSaveError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {createSaveError}
                  </div>
                )}

                {/* 단계 표시 */}
                <div className="flex items-center justify-center mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${uploadStep === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${uploadStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                        1
                      </div>
                      <span className="text-sm font-medium">업로드</span>
                    </div>
                    <div className="w-12 h-0.5 bg-gray-300" />
                    <div className={`flex items-center gap-2 ${uploadStep === 'processing' ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${uploadStep === 'processing' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                        2
                      </div>
                      <span className="text-sm font-medium">처리중</span>
                    </div>
                    <div className="w-12 h-0.5 bg-gray-300" />
                    <div className={`flex items-center gap-2 ${uploadStep === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${uploadStep === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                        3
                      </div>
                      <span className="text-sm font-medium">미리보기</span>
                    </div>
                  </div>
                </div>

                {/* 업로드 단계 */}
                {uploadStep === 'upload' && (
                  <div className="space-y-4">
                    {/* 차량등록증 업로드 (필수) */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                        <FileText className="w-4 h-4" />
                        차량등록증 (필수)
                      </label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-700">차량등록증을 업로드하세요</p>
                        <p className="text-xs text-gray-500 mt-1">또는 파일을 드래그하세요</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadedFiles.vehicleRegistration && (
                        <p className="text-xs text-green-600 mt-2">✓ {uploadedFiles.vehicleRegistration.name}</p>
                      )}
                    </div>

                    {/* 보험증서 업로드 (선택) */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                        <CalendarIcon className="w-4 h-4" />
                        보험가입증서 (선택)
                      </label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <p className="text-sm text-gray-700">보험가입증서 업로드</p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadedFiles((prev) => ({ ...prev, insurance: file }));
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {uploadedFiles.insurance && (
                        <p className="text-xs text-green-600 mt-2">✓ {uploadedFiles.insurance.name}</p>
                      )}
                    </div>

                    {/* 차량대출 상환계획표 업로드 (선택) */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        차량구매 대출 상환계획서 (선택)
                      </label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <p className="text-sm text-gray-700">상환계획서 업로드</p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleLoanScheduleUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadedFiles.loanSchedule && (
                        <p className="text-xs text-green-600 mt-2">✓ {uploadedFiles.loanSchedule.name}</p>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-4">
                      * 차량등록증은 필수 항목입니다. OCR을 통해 자동으로 정보를 추출합니다.
                    </p>
                  </div>
                )}

                {/* 처리중 단계 */}
                {uploadStep === 'processing' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-base text-gray-700">OCR 처리중...</p>
                    <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
                  </div>
                )}

                {/* 미리보기 단계 */}
                {uploadStep === 'preview' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차량번호</label>
                      <input
                        type="text"
                        value={createForm.vehicleNumber}
                        onChange={(e) => handleCreateFieldChange('vehicleNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.vehicleNumber && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.vehicleNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차대번호</label>
                      <input
                        type="text"
                        value={createForm.vin}
                        onChange={(e) => handleCreateFieldChange('vin', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.vin && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.vin}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차종</label>
                      <input
                        type="text"
                        value={createForm.model}
                        onChange={(e) => handleCreateFieldChange('model', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.model && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.model}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">연식</label>
                      <input
                        type="text"
                        value={createForm.year}
                        onChange={(e) => handleCreateFieldChange('year', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.year && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.year}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">소유자</label>
                      <input
                        type="text"
                        value={createForm.owner}
                        onChange={(e) => handleCreateFieldChange('owner', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">보험만료일</label>
                      <input
                        type="text"
                        value={createForm.insuranceExpiry}
                        onChange={(e) => handleCreateFieldChange('insuranceExpiry', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleCreateSave}
                        disabled={isCreateSaving}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="inline-flex items-center gap-2">
                          {isCreateSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isCreateSaving ? '저장 중...' : '확인 및 저장'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 자산 상세 모달 - VehicleDetailModal 컴포넌트 사용 */}
        {selectedAsset && (
          <VehicleDetailModal
            asset={selectedAsset}
            historyEntries={assetHistory}
            isHistoryLoading={isAssetHistoryLoading}
            historyError={assetHistoryError}
            onHistoryRetry={handleHistoryRetry}
            onConflictRefresh={handleConflictRefresh}
            isOpen={showDetailModal}
            onClose={handleDetailModalClose}
            editForm={detailForm}
            fieldErrors={detailFieldErrors}
            saveError={detailSaveError}
            conflictNotice={detailConflictNotice}
            isSaving={isDetailSaving}
            isDirty={isDetailDirty}
            onEditFieldChange={handleDetailFieldChange}
            handleSave={handleDetailSave}
            getStatusColor={getStatusColor}
          />
        )}
      </div>
    </Layout>
  );
}
