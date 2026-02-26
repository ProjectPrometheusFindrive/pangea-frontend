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
import { getAssetDetail, getAssetsList } from '../../services/assets';

interface Asset extends VehicleAsset {
  id: string;
  hasDevice: boolean;
}

interface UploadedFiles {
  vehicleRegistration: File | null;
  insurance: File | null;
  loanSchedule: File | null;
}

type StatusFilterCode = 'all' | 'rental' | 'reserved' | 'available' | 'maintenance';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const TOTAL_COUNT_KEYS = ['total', 'totalCount', 'count', 'itemsCount', 'totalElements'];
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

  if (statusValue === 'reserved' || statusValue === '예약됨') {
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

  return {
    id: toStringValue(row.id)
      ?? toStringValue(row.assetId)
      ?? toStringValue(row.uuid)
      ?? `A${String(index + 1).padStart(3, '0')}`,
    vehicleNumber,
    model: toStringValue(row.model) ?? toStringValue(row.vehicleModel) ?? '차종 미확인',
    status: normalizeAssetStatus(toStringValue(row.status) ?? toStringValue(row.assetStatus)),
    issues: normalizeAssetIssues(row.issues),
    insuranceExpiry: toStringValue(row.insuranceExpiry) ?? toStringValue(row.insuranceExpiryDate) ?? '-',
    nextInspection: toStringValue(row.nextInspection) ?? toStringValue(row.nextInspectionDate) ?? '-',
    vin: toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? '-',
    year: toStringValue(row.year) ?? toStringValue(row.modelYear) ?? '-',
    owner: toStringValue(row.owner) ?? toStringValue(row.ownerName) ?? '-',
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
  const [newInsuranceExpiry, setNewInsuranceExpiry] = useState('');
  const [newNextInspection, setNewNextInspection] = useState('');
  const detailRequestSequenceRef = useRef(0);
  const detailAbortControllerRef = useRef<AbortController | null>(null);

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

  useEffect(() => () => {
    detailAbortControllerRef.current?.abort();
  }, []);

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

  const hydrateAssetDetail = useCallback(async (assetId: string) => {
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
      setNewInsuranceExpiry(nextAsset.insuranceExpiry);
      setNewNextInspection(nextAsset.nextInspection);
      setShowDetailModal(true);
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
  }, [updateAssetsSearchParams]);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }

    void hydrateAssetDetail(selectedAssetId);
  }, [hydrateAssetDetail, selectedAssetId]);

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
    updateAssetsSearchParams((params) => {
      params.set('assetId', asset.id);
      params.delete('vehicle');
    });
  }, [updateAssetsSearchParams]);

  const handleDetailModalClose = useCallback(() => {
    detailAbortControllerRef.current?.abort();
    setShowDetailModal(false);
    setSelectedAsset(null);
    setIsDetailLoading(false);
    updateAssetsSearchParams((params) => {
      params.delete('assetId');
      params.delete('vehicle');
    }, true);
  }, [updateAssetsSearchParams]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '가용':
        return 'bg-green-100 text-green-700';
      case '대여중':
        return 'bg-blue-100 text-blue-700';
      case '예약':
      case '예약됨':
        return 'bg-purple-100 text-purple-700';
      case '정비중':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // OCR 데이터 상태 추가
  const [ocrData, setOcrData] = useState({
    vehicleNumber: '',
    vin: '',
    model: '',
    year: '',
    owner: '',
    insuranceExpiry: '',
  });

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles((prev) => ({ ...prev, vehicleRegistration: file }));
      setUploadStep('processing');
      
      // 시뮬레이션: OCR 처리
      setTimeout(() => {
        setOcrData({
          vehicleNumber: '99허9999',
          vin: 'KMHXX00XXXX000000',
          model: '아이오닉5',
          year: '2024',
          owner: '렌터카(주)',
          insuranceExpiry: '2025-12-15',
        });
        setUploadStep('preview');
      }, 2000);
    }
  };

  const handleSave = () => {
    // 저장 로직
    alert('차량이 등록되었습니다.');
    setShowModal(false);
    setUploadStep('upload');
    setUploadedFiles({
      vehicleRegistration: null,
      insurance: null,
      loanSchedule: null,
    });
    setOcrData({
      vehicleNumber: '',
      vin: '',
      model: '',
      year: '',
      owner: '',
      insuranceExpiry: '',
    });
  };

  const handleInsuranceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles((prev) => ({ ...prev, insurance: file }));
    }
  };

  const handleLoanScheduleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles((prev) => ({ ...prev, loanSchedule: file }));
    }
  };

  const handleDetailSave = () => {
    if (!selectedAsset) return;

    // assetsData 업데이트
    const updatedAssets = assets.map(asset => {
      if (asset.id === selectedAsset.id) {
        return {
          ...asset,
          insuranceExpiry: newInsuranceExpiry,
          nextInspection: newNextInspection,
        };
      }
      return asset;
    });

    setAssets(updatedAssets);
    alert('차량 정보가 업데이트되었습니다.');
    handleDetailModalClose();
    setUploadedFiles({
      vehicleRegistration: null,
      insurance: null,
      loanSchedule: null,
    });
  };

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
              onClick={() => setShowModal(true)}
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
                    onClick={() => {
                      setShowModal(false);
                      setUploadStep('upload');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

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
                        value={ocrData.vehicleNumber}
                        onChange={(e) => setOcrData({ ...ocrData, vehicleNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차대번호</label>
                      <input
                        type="text"
                        value={ocrData.vin}
                        onChange={(e) => setOcrData({ ...ocrData, vin: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차종</label>
                      <input
                        type="text"
                        value={ocrData.model}
                        onChange={(e) => setOcrData({ ...ocrData, model: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">연식</label>
                      <input
                        type="text"
                        value={ocrData.year}
                        onChange={(e) => setOcrData({ ...ocrData, year: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">소유자</label>
                      <input
                        type="text"
                        value={ocrData.owner}
                        onChange={(e) => setOcrData({ ...ocrData, owner: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">보험만료일</label>
                      <input
                        type="text"
                        value={ocrData.insuranceExpiry}
                        onChange={(e) => setOcrData({ ...ocrData, insuranceExpiry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleSave}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        확인 및 저장
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
            reservationHistory={[]}
            isOpen={showDetailModal}
            onClose={handleDetailModalClose}
            newInsuranceExpiry={newInsuranceExpiry}
            setNewInsuranceExpiry={setNewInsuranceExpiry}
            newNextInspection={newNextInspection}
            setNewNextInspection={setNewNextInspection}
            uploadedFiles={{ insurance: uploadedFiles.insurance, loanSchedule: uploadedFiles.loanSchedule }}
            handleInsuranceFileSelect={handleInsuranceFileSelect}
            handleLoanScheduleUpload={handleLoanScheduleUpload}
            handleSave={handleDetailSave}
            getStatusColor={getStatusColor}
          />
        )}
      </div>
    </Layout>
  );
}
