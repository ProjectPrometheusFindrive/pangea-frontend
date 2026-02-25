import { Layout } from '../components/Layout';
import { useState, useRef } from 'react';
import { Plus, MapPin, Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { vehicleAssets, reservations } from '../data/mockData';

type TabType = 'bulk' | 'geofence' | 'accounts';
type UploadType = 'vehicles' | 'reservations' | 'ocr';

interface UploadResult {
  success: boolean;
  total: number;
  valid: number;
  errors: string[];
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('bulk');
  const [uploadType, setUploadType] = useState<UploadType>('vehicles');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const geofences = [
    { id: '1', name: '서울 강남 영업소', radius: '500m', vehicleCount: 12, active: true },
    { id: '2', name: '인천 공항 반납지점', radius: '1km', vehicleCount: 8, active: true },
    { id: '3', name: '부산 해운대 지점', radius: '800m', vehicleCount: 15, active: false },
    { id: '4', name: '대구 동성로 지점', radius: '600m', vehicleCount: 10, active: true },
  ];

  const users = [
    { id: '1', name: '김민수', email: 'kim@example.com', role: '관리자', status: '활성' },
    { id: '2', name: '이영희', email: 'lee@example.com', role: '운영자', status: '활성' },
    { id: '3', name: '박철수', email: 'park@example.com', role: '운영자', status: '활성' },
    { id: '4', name: '최지우', email: 'choi@example.com', role: '조회자', status: '활성' },
    { id: '5', name: '정우진', email: 'jung@example.com', role: '조회자', status: '비활성' },
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case '관리자':
        return 'bg-purple-100 text-purple-700';
      case '운영자':
        return 'bg-blue-100 text-blue-700';
      case '조회자':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // CSV 템플릿 다운로드
  const downloadTemplate = (type: UploadType) => {
    let csv = '';
    let filename = '';

    if (type === 'vehicles') {
      csv = '차량번호,차종,상태,보험만료일,정기검사일,차대번호,연식,소유자\n';
      csv += '12가3456,그랜저,가용,2025-12-31,2025-06-30,KMHXX00XXXX000001,2023,렌터카(주)\n';
      csv += '34나5678,쏘나타,가용,2025-11-30,2025-05-31,KMHXX00XXXX000002,2022,렌터카(주)\n';
      filename = 'vehicle_template.csv';
    } else {
      csv = '예약ID,차량번호,고객명,시작일,종료일,유형,전화번호,결제방법,금액,선금\n';
      reservations.slice(0, 10).forEach(r => {
        const type = r.type === 'rental' ? '대여중' : r.type === 'reservation' ? '예약됨' : '반납완료';
        csv += `${r.id},${r.vehicleNumber},${r.customer},${r.startDateFull},${r.endDateFull},${type},${r.phone},${r.paymentMethod},${r.amount},${r.deposit}\n`;
      });
      filename = 'reservation_template.csv';
    }

    // BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // 현재 데이터 다운로드
  const downloadCurrentData = (type: UploadType) => {
    let csv = '';
    let filename = '';

    if (type === 'vehicles') {
      csv = '차량번호,차종,상태,보험만료일,정기검사일,차대번호,연식,소유자\n';
      vehicleAssets.slice(0, 10).forEach(v => {
        csv += `${v.vehicleNumber},${v.model},${v.status},${v.insuranceExpiry},${v.nextInspection},${v.vin},${v.year},${v.owner}\n`;
      });
      filename = 'vehicles_current.csv';
    } else {
      csv = '예약ID,차량번호,고객명,시작일,종료일,유형,전화번호,결제방법,금액,보증금\n';
      reservations.slice(0, 10).forEach(r => {
        const type = r.type === 'rental' ? '대여중' : r.type === 'reservation' ? '예약됨' : '반납완료';
        csv += `${r.id},${r.vehicleNumber},${r.customer},${r.startDateFull},${r.endDateFull},${type},${r.phone},${r.paymentMethod},${r.amount},${r.deposit}\n`;
      });
      filename = 'reservations_current.csv';
    }

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // 파일 검증
  const validateVehicleData = (data: any[]): { valid: any[], errors: string[] } => {
    const valid: any[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // CSV 헤더 + 1
      
      if (!row['차량번호']) {
        errors.push(`${rowNum}행: 차량번호가 없습니다`);
        return;
      }
      if (!row['차종']) {
        errors.push(`${rowNum}행: 차종이 없습니다`);
        return;
      }
      if (!['대여중', '예약됨', '가용', '정비중'].includes(row['상태'])) {
        errors.push(`${rowNum}행: 상태는 '대여중', '예약됨', '가용', '정비중' 중 하나여야 합니다`);
        return;
      }

      valid.push(row);
    });

    return { valid, errors };
  };

  const validateReservationData = (data: any[]): { valid: any[], errors: string[] } => {
    const valid: any[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;
      
      if (!row['예약ID']) {
        errors.push(`${rowNum}행: 예약ID가 없습니다`);
        return;
      }
      if (!row['차량번호']) {
        errors.push(`${rowNum}행: 차량번호가 없습니다`);
        return;
      }
      if (!row['고객명']) {
        errors.push(`${rowNum}행: 고객명이 없습니다`);
        return;
      }
      if (!['대여중', '예약됨', '반납완료'].includes(row['유형'])) {
        errors.push(`${rowNum}행: 유형은 '대여중', '예약됨', '반납완료' 중 하나여야 합니다`);
        return;
      }

      valid.push(row);
    });

    return { valid, errors };
  };

  // 파일 업로드 처리
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('CSV 파일만 업로드 가능합니다');
      return;
    }

    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const data = results.data.filter((row: any) => {
          // 빈 행 제거
          return Object.values(row).some(val => val !== '');
        });

        if (data.length === 0) {
          alert('유효한 데이터가 없습니다');
          return;
        }

        // 미리보기
        setPreviewData(data.slice(0, 5));

        // 검증
        let validation;
        if (uploadType === 'vehicles') {
          validation = validateVehicleData(data);
        } else {
          validation = validateReservationData(data);
        }

        setUploadResult({
          success: validation.errors.length === 0,
          total: data.length,
          valid: validation.valid.length,
          errors: validation.errors.slice(0, 10), // 최대 10개 에러만 표시
        });
      },
      error: (error) => {
        alert('파일 파싱 오류: ' + error.message);
      }
    });
  };

  // 드래그앤드롭
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleUploadClick = () => {
    if (uploadResult && uploadResult.valid > 0) {
      alert(`${uploadResult.valid}건의 데이터가 업로드되었습니다!`);
      setUploadResult(null);
      setPreviewData([]);
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <Layout title="설정">
      <div className="p-6">
        {/* 탭 */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'bulk'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            대량 업로드/다운로드
          </button>
          <button
            onClick={() => setActiveTab('geofence')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'geofence'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            지오펜스
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'accounts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            계정 관리
          </button>
        </div>

        {/* 대량 업로드/다운로드 탭 */}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            {/* 안내 메시지 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">초기 데이터 설정 가이드</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>CSV 템플릿을 다운로드하여 데이터를 입력하세요</li>
                    <li>차량 자산과 대여 예약을 한번에 등록할 수 있습니다</li>
                    <li>업로드 전 데이터 검증이 자동으로 수행됩니다</li>
                    <li>현재 데이터를 다운로드하여 참고할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 업로드 타입 선택 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-[#1e2939] mb-4">데이터 유형 선택</h2>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setUploadType('vehicles');
                    setUploadResult(null);
                    setPreviewData([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadType === 'vehicles'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <FileSpreadsheet className={`w-6 h-6 ${uploadType === 'vehicles' ? 'text-blue-600' : 'text-gray-400'}`} />
                    {uploadType === 'vehicles' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="text-left">
                    <div className={`font-semibold mb-1 ${uploadType === 'vehicles' ? 'text-blue-900' : 'text-gray-900'}`}>
                      차량 자산 (CSV)
                    </div>
                    <div className="text-sm text-gray-600">
                      차량번호, 차종, 상태 등
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setUploadType('reservations');
                    setUploadResult(null);
                    setPreviewData([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadType === 'reservations'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <FileText className={`w-6 h-6 ${uploadType === 'reservations' ? 'text-blue-600' : 'text-gray-400'}`} />
                    {uploadType === 'reservations' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="text-left">
                    <div className={`font-semibold mb-1 ${uploadType === 'reservations' ? 'text-blue-900' : 'text-gray-900'}`}>
                      대여 예약 (CSV)
                    </div>
                    <div className="text-sm text-gray-600">
                      예약ID, 고객명, 기간 등
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setUploadType('ocr');
                    setUploadResult(null);
                    setPreviewData([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadType === 'ocr'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Upload className={`w-6 h-6 ${uploadType === 'ocr' ? 'text-green-600' : 'text-gray-400'}`} />
                    {uploadType === 'ocr' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  </div>
                  <div className="text-left">
                    <div className={`font-semibold mb-1 ${uploadType === 'ocr' ? 'text-green-900' : 'text-gray-900'}`}>
                      자동차 등록증 (OCR)
                    </div>
                    <div className="text-sm text-gray-600">
                      이미지 파일 대량 업로드
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 업로드 영역 */}
            {uploadType === 'ocr' ? (
              /* OCR 대량 업로드 영역 */
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#1e2939] mb-1">자동차 등록증 OCR 대량 업로드</h2>
                    <p className="text-sm text-gray-600">여러 개의 차량등록증 이미지를 한번에 업로드하면 OCR로 자동 처리됩니다</p>
                  </div>
                </div>
                
                <div className="border-2 border-dashed border-green-300 rounded-lg p-8 bg-green-50">
                  <div className="text-center">
                    <Upload className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-900 mb-2">차량등록증 이미지 업로드</h3>
                    <p className="text-sm text-gray-700 mb-4">
                      여러 개의 이미지를 한번에 선택하거나 드래그하여 업로드하세요
                    </p>
                    <label className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer font-medium">
                      이미지 파일 선택
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            alert(`${files.length}개의 파일이 선택되었습니다.\\nOCR 처리를 시작합니다...`);
                            setTimeout(() => {
                              alert(`${files.length}개 차량 정보가 자동 추출되어 등록되었습니다!`);
                            }, 2000);
                          }
                        }}
                      />
                    </label>
                    <p className="text-xs text-gray-600 mt-4">
                      지원 형식: JPG, PNG, PDF | 최대 50개 파일까지 업로드 가능
                    </p>
                  </div>
                </div>

                {/* OCR 처리 안내 */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 OCR 자동 추출 항목</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 차량번호, 차대번호, 차종, 연식</li>
                    <li>• 소유자명, 보험만료일</li>
                    <li>• 추출 완료 후 수정 및 확인 가능</li>
                  </ul>
                </div>
              </div>
            ) : (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[#1e2939]">
                  {uploadType === 'vehicles' ? '차량 자산' : '대여 예약'} 업로드
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => downloadTemplate(uploadType)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    템플릿 다운로드
                  </button>
                  <button 
                    onClick={handleUploadClick}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadResult && uploadResult.valid > 0 ? '데이터 업로드' : '파일 선택'}
                  </button>
                </div>
              </div>
              
              {/* 파일 업로드 영역 */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-[300px] rounded-lg flex items-center justify-center border-2 border-dashed transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : uploadResult
                    ? uploadResult.success
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  {uploadResult ? (
                    <>
                      {uploadResult.success ? (
                        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-3" />
                      ) : (
                        <XCircle className="w-16 h-16 text-red-600 mx-auto mb-3" />
                      )}
                      <p className={`font-semibold mb-2 ${uploadResult.success ? 'text-green-900' : 'text-red-900'}`}>
                        {uploadResult.success ? '검증 성공!' : '검증 실패'}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        전체 {uploadResult.total}건 중 {uploadResult.valid}건 유효
                      </p>
                      {uploadResult.errors.length > 0 && (
                        <div className="text-left bg-white rounded-lg p-4 max-w-md mx-auto">
                          <p className="text-sm font-semibold text-red-900 mb-2">오류 목록:</p>
                          <ul className="text-xs text-red-800 space-y-1 max-h-32 overflow-y-auto">
                            {uploadResult.errors.map((error, i) => (
                              <li key={i}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium mb-1">
                        CSV 파일을 드래그하거나 클릭하여 업로드
                      </p>
                      <p className="text-sm text-gray-500">
                        최대 1,000건까지 한번에 업로드 가능
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* 미리보기 */}
              {previewData.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">미리보기 (최대 5건)</h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {previewData.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="px-4 py-2 text-gray-700">
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 현재 데이터 다운로드 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1e2939] mb-1">현재 데이터 다운로드</h2>
                  <p className="text-sm text-gray-600">
                    현재 시스템에 등록된 데이터를 CSV로 다운로드할 수 있습니다
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => downloadCurrentData('vehicles')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                    <div className="font-semibold text-gray-900">차량 자산 데이터</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    현재 {vehicleAssets.length}대의 차량 정보
                  </div>
                </button>

                <button
                  onClick={() => downloadCurrentData('reservations')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-6 h-6 text-green-600" />
                    <div className="font-semibold text-gray-900">대여 예약 데이터</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    현재 {reservations.length}건의 예약 정보
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 지오펜스 탭 */}
        {activeTab === 'geofence' && (
          <div className="space-y-6">
            {/* 지도 영역 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[#1e2939]">지오펜스 지도</h2>
                <button 
                  onClick={() => alert('지오펜스 생성 기능\n\n지도에서 영역을 그려 지오펜스를 생성할 수 있습니다.\n차량이 이 영역을 벗어나면 자동으로 알림이 발송됩니다.\n\n[프리미엄 기능]')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  지오펜스 생성
                </button>
              </div>
              
              {/* 지도 Placeholder */}
              <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">지도 영역</p>
                  <p className="text-sm text-gray-500 mt-1">지오펜스 위치가 여기에 표시됩니다</p>
                </div>
              </div>
            </div>

            {/* 지오펜스 리스트 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-base font-semibold text-[#1e2939]">지오펜스 목록</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">이름</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">반경</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">적용 차량 수</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">활성 상태</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {geofences.map((geofence) => (
                      <tr key={geofence.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {geofence.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {geofence.radius}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {geofence.vehicleCount}대
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={geofence.active}
                              readOnly
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button className="text-blue-600 hover:text-blue-800 font-medium mr-3">
                            편집
                          </button>
                          <button className="text-red-600 hover:text-red-800 font-medium">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 계정 관리 탭 */}
        {activeTab === 'accounts' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1e2939]">사용자 목록</h2>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" />
                초대하기
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">이메일</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">권한</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.status === '활성'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button className="text-blue-600 hover:text-blue-800 font-medium mr-3">
                          편집
                        </button>
                        <button className="text-red-600 hover:text-red-800 font-medium">
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 권한 설명 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">권한 설명</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">관리자:</span> 모든 기능 접근 및 설정 변경 가능</p>
                <p><span className="font-medium">운영자:</span> 예약, 자산, 조치사항 관리 가능</p>
                <p><span className="font-medium">조회자:</span> 데이터 조회만 가능, 수정 불가</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}