import { useState, useEffect } from 'react';
import { X, Upload, CheckCircle } from 'lucide-react';
import type { VehicleAsset } from '../types/assets';

interface DragSelection {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
}

interface NewContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: string[];
  vehicleAssets: VehicleAsset[];
  dragSelection?: DragSelection | null;
}

export function NewContractModal({ isOpen, onClose, vehicles, vehicleAssets, dragSelection }: NewContractModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // 폼 상태
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSSN, setCustomerSSN] = useState(''); // 주민번호
  const [customerLicense, setCustomerLicense] = useState(''); // 면허번호
  const [customerAddress, setCustomerAddress] = useState(''); // 주소
  const [pickupLocation, setPickupLocation] = useState(''); // 대여 장소
  const [returnLocation, setReturnLocation] = useState(''); // 반납 장소
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('카드');
  const [paymentStatus, setPaymentStatus] = useState<'대기' | '완료' | '미납' | '부분납부'>('대기'); // 결제 상태
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);

  // dragSelection이 변경되면 폼에 반영
  useEffect(() => {
    if (dragSelection && isOpen) {
      setSelectedVehicle(dragSelection.vehicleNumber);
      
      // startDate와 endDate를 실제 날짜로 변환
      const baseDate = new Date(2025, 1, 17); // 2025-02-17
      const start = new Date(baseDate);
      start.setDate(start.getDate() + dragSelection.startDate);
      const end = new Date(baseDate);
      end.setDate(end.getDate() + dragSelection.endDate);
      
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [dragSelection, isOpen]);

  // 선택된 기간 계산
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleClose = () => {
    setStep(1);
    setSelectedVehicle('');
    setStartDate('');
    setEndDate('');
    setStartTime('09:00');
    setEndTime('18:00');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerSSN('');
    setCustomerLicense('');
    setCustomerAddress('');
    setPickupLocation('');
    setReturnLocation('');
    setAmount('');
    setDeposit('');
    setPaymentMethod('카드');
    setPaymentStatus('대기');
    setLicenseFile(null);
    setContractFile(null);
    onClose();
  };

  // 선택된 차량 정보
  const selectedVehicleInfo = vehicleAssets.find(v => v.vehicleNumber === selectedVehicle);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[600px] max-h-[85vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="p-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#1e2939]">새 계약 등록</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 단계 표시 */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${step === 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
                </div>
                <span className="text-sm font-medium">선택 확인</span>
              </div>
              <div className="w-12 h-0.5 bg-gray-300" />
              <div className={`flex items-center gap-2 ${step === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
                </div>
                <span className="text-sm font-medium">고객 정보</span>
              </div>
              <div className="w-12 h-0.5 bg-gray-300" />
              <div className={`flex items-center gap-2 ${step === 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="text-sm font-medium">서류</span>
              </div>
            </div>
          </div>
        </div>

        {/* 모달 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 단계 1: 선택 확인 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">📅 선택한 정보</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-blue-700 uppercase">차량</label>
                    <p className="text-lg text-blue-900 mt-1 font-bold">
                      {selectedVehicle || '선택되지 않음'}
                    </p>
                    {selectedVehicleInfo && (
                      <p className="text-sm text-blue-700 mt-1">
                        {selectedVehicleInfo.model} ({selectedVehicleInfo.year}년)
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase">픽업 일시</label>
                      <p className="text-base text-blue-900 mt-1 font-medium">
                        {startDate || '선택되지 않음'}
                      </p>
                      <p className="text-lg text-blue-900 font-bold">
                        {startTime}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase">반납 일시</label>
                      <p className="text-base text-blue-900 mt-1 font-medium">
                        {endDate || '선택되지 않음'}
                      </p>
                      <p className="text-lg text-blue-900 font-bold">
                        {endTime}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-blue-700 uppercase">대여 일수</label>
                    <p className="text-2xl text-blue-900 mt-1 font-bold">
                      {calculateDays()}일
                    </p>
                  </div>
                </div>
              </div>

              {!dragSelection && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600 mb-4">
                    💡 캘린더에서 드래그하지 않았나요? 수동으로 입력할 수 있습니다.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        차량 선택 <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">차량을 선택하세요</option>
                        {vehicleAssets.map(v => (
                          <option key={v.vehicleNumber} value={v.vehicleNumber}>
                            {v.vehicleNumber} - {v.model} ({v.year}년)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          대여 시작일 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          대여 종료일 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          픽업 시간 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          반납 시간 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {dragSelection && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    🕐 픽업/반납 시간을 설정하세요
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        픽업 시간 <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        반납 시간 <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => {
                    if (!selectedVehicle || !startDate || !endDate) {
                      alert('모든 필수 항목을 입력해주세요.');
                      return;
                    }
                    setStep(2);
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* 단계 2: 고객 정보 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  고객명 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="고객 이름"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  연락처 <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  주민번호 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerSSN}
                  onChange={(e) => setCustomerSSN(e.target.value)}
                  placeholder="123456-1234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  면허번호 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerLicense}
                  onChange={(e) => setCustomerLicense(e.target.value)}
                  placeholder="1234567890123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  주소 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="서울특별시 강남구 논현동 123-456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 차량 인도 정보 */}
              <div className="border-t border-gray-200 pt-4 mt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">🚗 차량 인도/반납 장소</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">
                      대여 장소 <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">
                      반납 장소 <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={returnLocation}
                      onChange={(e) => setReturnLocation(e.target.value)}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    대여 요금 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="450,000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    선금 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder="500,000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  결제 방법 <span className="text-red-600">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>카드</option>
                  <option>현금</option>
                  <option>계좌이체</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  결제 상태 <span className="text-red-600">*</span>
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as '대기' | '완료' | '미납' | '부분납부')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="대기">대기 (아직 결제 예정일 전)</option>
                  <option value="완료">완납 (전액 결제 완료)</option>
                  <option value="미납">미납 (결제 안됨)</option>
                  <option value="부분납부">부분납부 (일부만 결제됨)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 현장에서 결제받은 경우 '완납'을 선택하세요
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  이전
                </button>
                <button
                  onClick={() => {
                    if (!customerName || !customerPhone || !customerSSN || !customerLicense || !customerAddress || !pickupLocation || !returnLocation || !amount || !deposit) {
                      alert('모든 필수 항목을 입력해주세요.');
                      return;
                    }
                    setStep(3);
                  }}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* 단계 3: 서류 업로드 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  운전면허증 <span className="text-red-600">*</span>
                </label>
                <label className="cursor-pointer block">
                  <div className="flex items-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 justify-center transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {licenseFile ? licenseFile.name : '파일 선택'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLicenseFile(file);
                      }
                    }}
                  />
                </label>
                {licenseFile && (
                  <p className="text-xs text-green-600 mt-1">✓ 파일이 선택되었습니다</p>
                )}
                <p className="text-xs text-gray-500 mt-1">면허증 앞면 또는 전체 사진을 업로드하세요</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  대여계약서 (선택)
                </label>
                <label className="cursor-pointer block">
                  <div className="flex items-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 justify-center transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {contractFile ? contractFile.name : '파일 선택'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setContractFile(file);
                      }
                    }}
                  />
                </label>
                {contractFile && (
                  <p className="text-xs text-green-600 mt-1">✓ 파일이 선택되었습니다</p>
                )}
                <p className="text-xs text-gray-500 mt-1">계약서가 있는 경우 업로드하세요</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  이전
                </button>
                <button
                  onClick={() => {
                    if (!licenseFile) {
                      alert('운전면허증은 필수 항목입니다.');
                      return;
                    }
                    alert(`계약이 등록되었습니다.\\n\\n고객명: ${customerName}\\n차량: ${selectedVehicle}\\n픽업: ${startDate} ${startTime}\\n반납: ${endDate} ${endTime}\\n일수: ${calculateDays()}일\\n요금: ${amount}원\\n선금: ${deposit}원`);
                    handleClose();
                  }}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  확인 및 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
