import { Layout } from '../components/Layout';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, X, Loader2, FileText, Calendar as CalendarIcon, DollarSign, AlertTriangle, Filter } from 'lucide-react';
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
import { vehicleAssets as mockVehicleAssets, type VehicleAsset } from '../data/mockData';
import { getAssetsDashboard } from '../../services/dashboard';

interface Asset extends VehicleAsset {
  id?: string;
  hasDevice?: boolean; // 단말 설치 여부
}

interface UploadedFiles {
  vehicleRegistration: File | null;
  insurance: File | null;
  loanSchedule: File | null;
}

// mockVehicleAssets를 Asset 타입으로 변환
const initialAssets: Asset[] = mockVehicleAssets.map((asset, index) => ({
  ...asset,
  id: `A${String(index + 1).padStart(3, '0')}`,
  hasDevice: index % 10 === 0, // 10대당 1대는 단말 설치되어 있다고 가정
}));

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

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
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

function toAssetRows(payload: unknown): Asset[] {
  const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
  if (!rows) {
    return initialAssets;
  }

  if (rows.length === 0) {
    return [];
  }

  const normalizedRows: Asset[] = rows
    .map((row, index) => {
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

      const model = toStringValue(row.model) ?? toStringValue(row.vehicleModel) ?? '차종 미확인';
      const status = normalizeAssetStatus(
        toStringValue(row.status) ?? toStringValue(row.assetStatus),
      );
      const insuranceExpiry = toStringValue(row.insuranceExpiry)
        ?? toStringValue(row.insuranceExpiryDate)
        ?? '-';
      const nextInspection = toStringValue(row.nextInspection)
        ?? toStringValue(row.nextInspectionDate)
        ?? '-';
      const vin = toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? '-';
      const year = toStringValue(row.year) ?? toStringValue(row.modelYear) ?? '-';
      const owner = toStringValue(row.owner) ?? toStringValue(row.ownerName) ?? '-';
      const hasDevice = toBooleanValue(row.hasDevice) ?? toBooleanValue(row.hasPremiumDevice) ?? false;

      return {
        id: toStringValue(row.id) ?? `A${String(index + 1).padStart(3, '0')}`,
        vehicleNumber,
        model,
        status,
        issues: normalizeAssetIssues(row.issues),
        insuranceExpiry,
        nextInspection,
        vin,
        year,
        owner,
        hasPremiumDevice: hasDevice,
        hasDevice,
      };
    })
    .filter((row): row is Asset => row !== null);

  return normalizedRows.length > 0 ? normalizedRows : initialAssets;
}

export default function Assets() {
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showInsuranceUpload, setShowInsuranceUpload] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'processing' | 'preview'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({
    vehicleRegistration: null,
    insurance: null,
    loanSchedule: null,
  });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [issueFilter, setIssueFilter] = useState<string>('all');
  
  // 차종 필터 추가
  const [modelFilter, setModelFilter] = useState('all');
  
  // 차량 상세 모달 탭 상태 추가
  const [detailTab, setDetailTab] = useState<'info' | 'history' | 'sensor'>('info');

  const navigate = useNavigate();

  const {
    isLoading: isAssetsLoading,
    error: assetsError,
    errorKind: assetsErrorKind,
    isEmpty: isAssetsApiEmpty,
    run: hydrateAssets,
  } = usePageEndpointState<unknown>({
    request: (signal) => getAssetsDashboard({ signal }),
    onSuccess: (payload) => {
      setAssets(toAssetRows(payload));
    },
    isEmpty: (payload) => {
      const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
      if (rows) {
        return rows.length === 0;
      }
      return isPayloadEmpty(payload, ['assets', 'items', 'rows', 'list']);
    },
  });

  useEffect(() => {
    void hydrateAssets();
  }, []);

  const handleAssetsRetry = useCallback(() => {
    void hydrateAssets();
  }, [hydrateAssets]);

  const resetAssetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setIssueFilter('all');
    setModelFilter('all');
  }, []);

  const handleAssetsErrorAction = useCallback(() => {
    handlePageErrorAction(assetsErrorKind, navigate);
  }, [assetsErrorKind, navigate]);

  // URL 파라미터에서 status, 검색어, vehicle 가져오기
  useEffect(() => {
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const vehicle = searchParams.get('vehicle');
    
    if (search) {
      setSearchQuery(search);
    }
    if (status) {
      setStatusFilter(status);
    }
    if (vehicle) {
      // vehicle 파라미터가 있으면 해당 차량 찾아서 상세 모달 열기
      setSearchQuery(vehicle);
      const targetAsset = assets.find(a => a.vehicleNumber === vehicle);
      if (targetAsset) {
        setSelectedAsset(targetAsset);
        setShowDetailModal(true);
      }
    }
  }, [searchParams, assets]);

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
  
  // 고유 차종 목록 추출
  const uniqueModels = Array.from(new Set(assets.map(a => a.model))).sort();

  // 상태 필터링 (URL 파라미터 'status'에 따라)
  const filteredAssets = assets.filter(asset => {
    // 차종 필터
    const matchesModel = modelFilter === 'all' || asset.model === modelFilter;
    
    // "예약"과 "예약됨"을 모두 처리
    if (statusFilter === '예약' || statusFilter === '예약됨') {
      const matchesStatus = asset.status === '예약' || asset.status === '예약됨';
      const matchesSearch = searchQuery === '' || 
        asset.vehicleNumber.includes(searchQuery) ||
        asset.model.includes(searchQuery);
      return matchesStatus && matchesSearch && matchesModel;
    }
    
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      asset.vehicleNumber.includes(searchQuery) ||
      asset.model.includes(searchQuery);
    return matchesStatus && matchesSearch && matchesModel;
  });

  // OCR 데이터 상태 추가
  const [ocrData, setOcrData] = useState({
    vehicleNumber: '',
    vin: '',
    model: '',
    year: '',
    owner: '',
    insuranceExpiry: '',
  });

  // 상세 모달 수정 상태
  const [newInsuranceExpiry, setNewInsuranceExpiry] = useState('');
  const [newNextInspection, setNewNextInspection] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles({ ...uploadedFiles, vehicleRegistration: file });
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
      setUploadedFiles({ ...uploadedFiles, insurance: file });
    }
  };

  const handleLoanScheduleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles({ ...uploadedFiles, loanSchedule: file });
    }
  };

  const handleDetailModalOpen = (asset: Asset) => {
    setSelectedAsset(asset);
    setNewInsuranceExpiry(asset.insuranceExpiry);
    setNewNextInspection(asset.nextInspection);
    setShowDetailModal(true);
    setUploadedFiles({
      vehicleRegistration: null,
      insurance: null,
      loanSchedule: null,
    });
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
    setShowDetailModal(false);
    setShowInsuranceUpload(false);
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
          vehiclesWithoutDevice={11}
          onCTAClick={() => {
            alert('프리미엄 문의: 1588-XXXX\n\n단말 일괄 설치 신청이 접수되었습니다.\n담당자가 곧 연락드리겠습니다.');
          }}
        />

        {/* 상단 헤더 & 필터 */}
        <div className="mb-6 space-y-4">
          {/* 검색창 */}
          <div className="relative">
            <input
              type="text"
              placeholder="차량번호 또는 차종으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
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
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({assets.length})
            </button>
            <button
              onClick={() => setStatusFilter('대여중')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === '대여중'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대여중 ({assets.filter(a => a.status === '대여중').length})
            </button>
            <button
              onClick={() => setStatusFilter('예약')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === '예약' || statusFilter === '예약됨'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              예약 ({assets.filter(a => a.status === '예약' || a.status === '예약됨').length})
            </button>
            <button
              onClick={() => setStatusFilter('가용')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === '가용'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              가용 ({assets.filter(a => a.status === '가용').length})
            </button>
            <button
              onClick={() => setStatusFilter('정비중')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === '정비중'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              정비중 ({assets.filter(a => a.status === '정비중').length})
            </button>
          </div>

          {/* 차종 필터 & 등록 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">차종:</span>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                <option value="all">전체</option>
                {uniqueModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                ({filteredAssets.length}대 표시 중)
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
          error={assetsError}
          isEmpty={!isAssetsLoading && !assetsError && (isAssetsApiEmpty || filteredAssets.length === 0)}
          errorDescription="차량 자산 목록을 불러오는 중 문제가 발생했습니다."
          emptyTitle="조건에 맞는 차량이 없습니다"
          emptyDescription="검색어 또는 필터를 조정해 다시 확인해 주세요."
          onRetry={handleAssetsRetry}
          errorActionLabel={getPageErrorActionLabel(assetsErrorKind)}
          onErrorAction={handleAssetsErrorAction}
          emptyActionLabel="필터 초기화"
          onEmptyAction={resetAssetFilters}
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
                  {filteredAssets.map((asset) => (
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
                            if (file) setUploadedFiles({ ...uploadedFiles, insurance: file });
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
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setShowInsuranceUpload(false);
            }}
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
