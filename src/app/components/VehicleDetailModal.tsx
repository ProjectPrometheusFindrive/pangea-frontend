import { useState } from 'react';
import { X, Activity, History, Info, Zap, AlertTriangle } from 'lucide-react';
import { type VehicleAsset, reservations } from '../data/mockData';
import { useNavigate } from 'react-router';

interface VehicleDetailModalProps {
  asset: VehicleAsset;
  isOpen: boolean;
  onClose: () => void;
  newInsuranceExpiry: string;
  setNewInsuranceExpiry: (value: string) => void;
  newNextInspection: string;
  setNewNextInspection: (value: string) => void;
  uploadedFiles: {
    insurance: File | null;
    loanSchedule: File | null;
  };
  handleInsuranceFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLoanScheduleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSave: () => void;
  getStatusColor: (status: string) => string;
}

export function VehicleDetailModal({
  asset,
  isOpen,
  onClose,
  newInsuranceExpiry,
  setNewInsuranceExpiry,
  newNextInspection,
  setNewNextInspection,
  uploadedFiles,
  handleInsuranceFileSelect,
  handleLoanScheduleUpload,
  handleSave,
  getStatusColor,
}: VehicleDetailModalProps) {
  const [detailTab, setDetailTab] = useState<'info' | 'history' | 'sensor'>('info');
  const navigate = useNavigate();

  if (!isOpen) return null;

  // 이 차량의 예약 히스토리 가져오기
  const vehicleReservations = reservations
    .filter(r => r.vehicleNumber === asset.vehicleNumber)
    .sort((a, b) => b.startDate - a.startDate);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[700px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1e2939]">차량 상세 정보</h2>
            <button
              onClick={() => {
                onClose();
                setDetailTab('info');
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-1 mt-4 border-b border-gray-200">
            <button
              onClick={() => setDetailTab('info')}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors ${
                detailTab === 'info'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Info className="w-4 h-4" />
              기본 정보
            </button>
            <button
              onClick={() => setDetailTab('history')}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors ${
                detailTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="w-4 h-4" />
              예약 히스토리
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold">
                {vehicleReservations.length}
              </span>
            </button>
            <button
              onClick={() => setDetailTab('sensor')}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors ${
                detailTab === 'sensor'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              차량 이상 히스토리
              {asset.hasPremiumDevice && asset.deviceStatus && (
                <Zap className="w-3 h-3 text-yellow-500" />
              )}
            </button>
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 기본 정보 탭 */}
          {detailTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">차량번호</label>
                  <p className="text-lg text-gray-900 mt-1 font-bold">{asset.vehicleNumber}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">차종</label>
                  <p className="text-lg text-gray-900 mt-1 font-medium">{asset.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">연식</label>
                  <p className="text-lg text-gray-900 mt-1">{asset.year}년</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">차대번호</label>
                  <p className="text-base text-gray-900 mt-1 font-mono">{asset.vin}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">현재 상태</label>
                  <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-2 ${getStatusColor(asset.status)}`}>
                    {asset.status}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">소유주</label>
                  <p className="text-lg text-gray-900 mt-1">{asset.owner}</p>
                </div>
              </div>

              {asset.issues.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    차량 이슈
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {asset.issues.map((issue, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onClose();
                          navigate(`/action-required?filter=${encodeURIComponent(issue)}`);
                        }}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                      >
                        {issue}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">보험 및 점검 정보 수정</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">보험가입증서 업로드</label>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                          파일 선택
                        </div>
                        {uploadedFiles.insurance ? (
                          <span className="text-sm text-green-600">
                            ✓ {uploadedFiles.insurance.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">선택된 파일 없음</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleInsuranceFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">보험만료일</label>
                    <input
                      type="date"
                      value={newInsuranceExpiry}
                      onChange={(e) => setNewInsuranceExpiry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">자동차종합검사 결과표 업로드</label>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                          파일 선택
                        </div>
                        <span className="text-sm text-gray-500">선택된 파일 없음</span>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">다음 정기점검일</label>
                    <input
                      type="date"
                      value={newNextInspection}
                      onChange={(e) => setNewNextInspection(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">차량구매 대출 상환계획서 업로드</label>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                          파일 선택
                        </div>
                        {uploadedFiles.loanSchedule ? (
                          <span className="text-sm text-green-600">
                            ✓ {uploadedFiles.loanSchedule.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">선택된 파일 없음</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={handleLoanScheduleUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 예약 히스토리 탭 */}
          {detailTab === 'history' && (
            <div className="space-y-4">
              {vehicleReservations.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">예약번호</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">고객명</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">유형</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">대여 기간</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">결제 방법</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">대여료</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {vehicleReservations.map((reservation) => (
                          <tr key={reservation.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => {
                                  onClose();
                                  navigate(`/reservations?search=${encodeURIComponent(reservation.id)}`);
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                              >
                                {reservation.id}
                              </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{reservation.customer}</div>
                                <div className="text-xs text-gray-500">{reservation.phone}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                reservation.type === 'reservation' 
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {reservation.type === 'reservation' ? '예약' : '대여'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="whitespace-nowrap">{reservation.startDateFull}</div>
                              <div className="whitespace-nowrap text-xs text-gray-500">~ {reservation.endDateFull}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {reservation.paymentMethod}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="text-sm font-bold text-blue-600">{reservation.amount}</div>
                              <div className="text-xs text-gray-500">선금: {reservation.deposit}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {reservation.issues && reservation.issues.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  <span className="text-xs text-orange-700 font-medium">
                                    {reservation.issues[0]}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-green-600">정상</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">이 차량의 예약 히스토리가 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* 센서 데이터 탭 */}
          {detailTab === 'sensor' && (
            <div className="space-y-4">
              {asset.hasPremiumDevice ? (
                // 프리미엄 가입 - DTC 히스토리 + 센서 데이터 표시
                <div className="space-y-4">
                  {/* DTC 이상 코드 히스토리 (테이블 형식) */}
                  {asset.dtcHistory && asset.dtcHistory.length > 0 && (
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3">차량 이상 히스토리 (DTC 코드)</h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">DTC 코드</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">이상 내용</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">발생일시</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">조치 내용 / 상태</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">정상복귀일시</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {asset.dtcHistory.map((dtc) => (
                              <tr key={dtc.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <span className="text-sm font-mono font-bold text-gray-900">{dtc.dtcCode}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-sm text-gray-900">{dtc.description}</p>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-xs text-gray-600">
                                    {new Date(dtc.detectedAt).toLocaleString('ko-KR', {
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {dtc.status === 'resolved' ? (
                                    <div>
                                      <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full mb-1">
                                        ✓ 완료
                                      </span>
                                      {dtc.notes && (
                                        <p className="text-xs text-gray-700 mt-1">{dtc.notes}</p>
                                      )}
                                      {dtc.resolvedBy && (
                                        <p className="text-xs text-gray-500 mt-1">담당: {dtc.resolvedBy}</p>
                                      )}
                                    </div>
                                  ) : dtc.status === 'in-progress' ? (
                                    <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                      진행중
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        navigate(`/action-required?filter=차량이상`);
                                      }}
                                      className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                    >
                                      조치 필요
                                    </button>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {dtc.resolvedAt ? (
                                    <span className="text-xs text-green-600">
                                      {new Date(dtc.resolvedAt).toLocaleString('ko-KR', {
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 실시간 센서 데이터 */}
                  {asset.deviceStatus && (
                    <div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-green-800">프리미엄 단말 장착</span>
                        </div>
                        <p className="text-sm text-green-700">
                          실시간 차량 상태 모니터링 중입니다.
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          마지막 업데이트: {new Date(asset.deviceStatus.lastUpdate).toLocaleString('ko-KR')}
                        </p>
                      </div>

                      {/* 엔진 및 전기 시스템 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          엔진 및 전기 시스템
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">엔진 경고등</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              asset.deviceStatus.engineWarning 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {asset.deviceStatus.engineWarning ? '⚠️ 점등' : '✓ 정상'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">배터리 전압</span>
                            <span className={`font-medium ${
                              asset.deviceStatus.batteryVoltage < 12.0 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {asset.deviceStatus.batteryVoltage.toFixed(1)}V
                              {asset.deviceStatus.batteryVoltage < 12.0 && ' ⚠️'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">오일 압력</span>
                            <span className={`font-medium ${
                              asset.deviceStatus.oilPressure < 25 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {asset.deviceStatus.oilPressure.toFixed(0)} PSI
                              {asset.deviceStatus.oilPressure < 25 && ' ⚠️'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 냉각 및 온도 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-gray-900 mb-3">냉각 및 온도</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">냉각수 온도</span>
                            <span className={`font-medium ${
                              asset.deviceStatus.coolantTemp > 105 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {asset.deviceStatus.coolantTemp.toFixed(0)}°C
                              {asset.deviceStatus.coolantTemp > 105 && ' ⚠️'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">변속기 온도</span>
                            <span className={`font-medium ${
                              asset.deviceStatus.transmissionTemp > 100 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {asset.deviceStatus.transmissionTemp.toFixed(0)}°C
                              {asset.deviceStatus.transmissionTemp > 100 && ' ⚠️'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 타이어 및 브레이크 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-gray-900 mb-3">타이어 및 브레이크</h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-gray-600 block mb-2">타이어 공기압</span>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className={`flex justify-between ${
                                asset.deviceStatus.tirePressure[0] < 30 ? 'text-red-600 font-medium' : 'text-gray-900'
                              }`}>
                                <span>좌측 앞:</span>
                                <span>{asset.deviceStatus.tirePressure[0].toFixed(0)} PSI {asset.deviceStatus.tirePressure[0] < 30 && '⚠️'}</span>
                              </div>
                              <div className={`flex justify-between ${
                                asset.deviceStatus.tirePressure[1] < 30 ? 'text-red-600 font-medium' : 'text-gray-900'
                              }`}>
                                <span>우측 앞:</span>
                                <span>{asset.deviceStatus.tirePressure[1].toFixed(0)} PSI {asset.deviceStatus.tirePressure[1] < 30 && '⚠️'}</span>
                              </div>
                              <div className={`flex justify-between ${
                                asset.deviceStatus.tirePressure[2] < 30 ? 'text-red-600 font-medium' : 'text-gray-900'
                              }`}>
                                <span>좌측 뒤:</span>
                                <span>{asset.deviceStatus.tirePressure[2].toFixed(0)} PSI {asset.deviceStatus.tirePressure[2] < 30 && '⚠️'}</span>
                              </div>
                              <div className={`flex justify-between ${
                                asset.deviceStatus.tirePressure[3] < 30 ? 'text-red-600 font-medium' : 'text-gray-900'
                              }`}>
                                <span>우측 뒤:</span>
                                <span>{asset.deviceStatus.tirePressure[3].toFixed(0)} PSI {asset.deviceStatus.tirePressure[3] < 30 && '⚠️'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">브레이크액</span>
                            <span className={`font-medium ${
                              asset.deviceStatus.brakeFluid < 80 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {asset.deviceStatus.brakeFluid.toFixed(0)}%
                              {asset.deviceStatus.brakeFluid < 80 && ' ⚠️'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 안전 시스템 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-gray-900 mb-3">안전 시스템</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">ABS 경고등</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              asset.deviceStatus.absWarning 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {asset.deviceStatus.absWarning ? '⚠️ 점등' : '✓ 정상'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">에어백 경고등</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              asset.deviceStatus.airbagWarning 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {asset.deviceStatus.airbagWarning ? '⚠️ 점등' : '✓ 정상'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 연료 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-gray-900 mb-3">연료</h4>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">연료 잔량</span>
                          <span className={`font-medium ${
                            asset.deviceStatus.fuelLevel < 15 
                              ? 'text-red-600' 
                              : 'text-gray-900'
                          }`}>
                            {asset.deviceStatus.fuelLevel.toFixed(0)}%
                            {asset.deviceStatus.fuelLevel < 15 && ' ⚠️'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // 프리미엄 미가입 - 전환 유도
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border-2 border-dashed border-purple-300">
                    <Zap className="w-16 h-16 mx-auto mb-4 text-purple-500" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      프리미엄 기능
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      차량 단말을 장착하면 실시간 센서 데이터와 DTC 이상 코드 히스토리를 확인할 수 있습니다.
                    </p>
                    
                    <div className="bg-white rounded-lg p-4 mb-6 text-left">
                      <h4 className="font-bold text-gray-900 mb-3">프리미엄으로 이용 가능한 기능:</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>DTC 이상 코드 자동 감지 및 히스토리 관리</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>실시간 엔진 상태 모니터링 (경고등, 오일 압력, 배터리 전압)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>냉각수 및 변속기 온도 감시</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>타이어 공기압 및 브레이크액 알림</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>ABS/에어백 시스템 이상 알림</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>연료 잔량 및 주행 거리 추적</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>도난 의심 및 지오펜스 알림</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        alert('프리미엄 문의: 1588-XXXX\n\n담당자가 곧 연락드려 단말 설치 일정을 안내해 드리겠습니다.\n\n월 29,000원으로 차량당 프리미엄 서비스를 이용하실 수 있습니다.');
                      }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105"
                    >
                      프리미엄으로 업그레이드
                    </button>
                    <p className="text-xs text-gray-500 mt-3">
                      월 29,000원 · 차량 단말 무료 설치 · 언제든 해지 가능
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 액션 버튼 */}
        {detailTab === 'info' ? (
          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={() => {
                onClose();
                setDetailTab('info');
              }}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              닫기
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              저장
            </button>
          </div>
        ) : (
          <div className="p-6 border-t border-gray-200">
            <button
              onClick={() => {
                onClose();
                setDetailTab('info');
              }}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}