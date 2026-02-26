import { useEffect, useState } from 'react';
import { X, Upload, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import type { VehicleAsset } from '../types/assets';

interface DragSelection {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
}

export type NewContractField =
  | 'selectedVehicle'
  | 'startDate'
  | 'endDate'
  | 'startTime'
  | 'endTime'
  | 'customerName'
  | 'customerPhone'
  | 'customerSSN'
  | 'customerLicense'
  | 'customerAddress'
  | 'pickupLocation'
  | 'returnLocation'
  | 'amount'
  | 'deposit'
  | 'licenseFile';

export interface NewContractFormValues {
  selectedVehicle: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  customerSSN: string;
  customerLicense: string;
  customerAddress: string;
  pickupLocation: string;
  returnLocation: string;
  amount: string;
  deposit: string;
  paymentMethod: '카드' | '현금' | '계좌이체';
  paymentStatus: '대기' | '완료' | '미납' | '부분납부';
  licenseFile: File;
  contractFile: File | null;
}

export interface NewContractSubmitFeedback {
  formError?: string;
  fieldErrors?: Partial<Record<NewContractField, string>>;
}

interface NewContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: string[];
  vehicleAssets: VehicleAsset[];
  dragSelection?: DragSelection | null;
  onSubmit: (formValues: NewContractFormValues) => Promise<NewContractSubmitFeedback | null>;
}

function hasTextValue(value: string): boolean {
  return value.trim().length > 0;
}

export function NewContractModal({
  isOpen,
  onClose,
  vehicleAssets,
  dragSelection,
  onSubmit,
}: NewContractModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSSN, setCustomerSSN] = useState('');
  const [customerLicense, setCustomerLicense] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [returnLocation, setReturnLocation] = useState('');
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'카드' | '현금' | '계좌이체'>('카드');
  const [paymentStatus, setPaymentStatus] = useState<'대기' | '완료' | '미납' | '부분납부'>('대기');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NewContractField, string>>>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSubmitError(null);
    setFieldErrors({});
  }, [isOpen]);

  useEffect(() => {
    if (dragSelection && isOpen) {
      setSelectedVehicle(dragSelection.vehicleNumber);

      const baseDate = new Date(2025, 1, 17);
      const start = new Date(baseDate);
      start.setDate(start.getDate() + dragSelection.startDate);
      const end = new Date(baseDate);
      end.setDate(end.getDate() + dragSelection.endDate);

      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [dragSelection, isOpen]);

  const calculateDays = () => {
    if (!startDate || !endDate) {
      return 0;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const clearFieldError = (field: NewContractField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setSubmitError(null);
  };

  const resetState = () => {
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
    setSubmitError(null);
    setFieldErrors({});
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const selectedVehicleInfo = vehicleAssets.find((vehicle) => vehicle.vehicleNumber === selectedVehicle);

  const handleStepOneNext = () => {
    const nextErrors: Partial<Record<NewContractField, string>> = {};
    if (!hasTextValue(selectedVehicle)) {
      nextErrors.selectedVehicle = '차량을 선택해 주세요.';
    }
    if (!hasTextValue(startDate)) {
      nextErrors.startDate = '대여 시작일을 입력해 주세요.';
    }
    if (!hasTextValue(endDate)) {
      nextErrors.endDate = '대여 종료일을 입력해 주세요.';
    }
    if (!hasTextValue(startTime)) {
      nextErrors.startTime = '픽업 시간을 입력해 주세요.';
    }
    if (!hasTextValue(endTime)) {
      nextErrors.endTime = '반납 시간을 입력해 주세요.';
    }

    if (
      hasTextValue(startDate)
      && hasTextValue(startTime)
      && hasTextValue(endDate)
      && hasTextValue(endTime)
    ) {
      const startAt = new Date(`${startDate}T${startTime}`);
      const endAt = new Date(`${endDate}T${endTime}`);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt < startAt) {
        nextErrors.endDate = '반납 일시는 픽업 일시보다 빠를 수 없습니다.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setSubmitError('필수 입력값을 확인해 주세요.');
      return;
    }

    setStep(2);
  };

  const handleStepTwoNext = () => {
    const nextErrors: Partial<Record<NewContractField, string>> = {};
    if (!hasTextValue(customerName)) {
      nextErrors.customerName = '고객명을 입력해 주세요.';
    }
    if (!hasTextValue(customerPhone)) {
      nextErrors.customerPhone = '연락처를 입력해 주세요.';
    }
    if (!hasTextValue(customerSSN)) {
      nextErrors.customerSSN = '주민번호를 입력해 주세요.';
    }
    if (!hasTextValue(customerLicense)) {
      nextErrors.customerLicense = '면허번호를 입력해 주세요.';
    }
    if (!hasTextValue(customerAddress)) {
      nextErrors.customerAddress = '주소를 입력해 주세요.';
    }
    if (!hasTextValue(pickupLocation)) {
      nextErrors.pickupLocation = '대여 장소를 입력해 주세요.';
    }
    if (!hasTextValue(returnLocation)) {
      nextErrors.returnLocation = '반납 장소를 입력해 주세요.';
    }
    if (!hasTextValue(amount)) {
      nextErrors.amount = '대여 요금을 입력해 주세요.';
    }
    if (!hasTextValue(deposit)) {
      nextErrors.deposit = '선금을 입력해 주세요.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setSubmitError('필수 입력값을 확인해 주세요.');
      return;
    }

    setStep(3);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const nextErrors: Partial<Record<NewContractField, string>> = {};
    if (!licenseFile) {
      nextErrors.licenseFile = '운전면허증 파일은 필수입니다.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setSubmitError('필수 입력값을 확인해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const feedback = await onSubmit({
        selectedVehicle,
        startDate,
        endDate,
        startTime,
        endTime,
        customerName,
        customerPhone,
        customerSSN,
        customerLicense,
        customerAddress,
        pickupLocation,
        returnLocation,
        amount,
        deposit,
        paymentMethod,
        paymentStatus,
        licenseFile,
        contractFile,
      });

      if (feedback) {
        if (feedback.formError) {
          setSubmitError(feedback.formError);
        }
        if (feedback.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...feedback.fieldErrors }));
        }
        return;
      }

      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const fieldInputClass = (field: NewContractField) => `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    fieldErrors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[600px] max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#1e2939]">새 계약 등록</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

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

        <div className="flex-1 overflow-y-auto p-6">
          {submitError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

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
                        onChange={(event) => {
                          setSelectedVehicle(event.target.value);
                          clearFieldError('selectedVehicle');
                        }}
                        className={fieldInputClass('selectedVehicle')}
                        disabled={isSubmitting}
                      >
                        <option value="">차량을 선택하세요</option>
                        {vehicleAssets.map((vehicle) => (
                          <option key={vehicle.vehicleNumber} value={vehicle.vehicleNumber}>
                            {vehicle.vehicleNumber} - {vehicle.model} ({vehicle.year}년)
                          </option>
                        ))}
                      </select>
                      {fieldErrors.selectedVehicle && <p className="mt-1 text-xs text-red-600">{fieldErrors.selectedVehicle}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          대여 시작일 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => {
                            setStartDate(event.target.value);
                            clearFieldError('startDate');
                          }}
                          className={fieldInputClass('startDate')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.startDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.startDate}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          대여 종료일 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(event) => {
                            setEndDate(event.target.value);
                            clearFieldError('endDate');
                          }}
                          className={fieldInputClass('endDate')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.endDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.endDate}</p>}
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
                          onChange={(event) => {
                            setStartTime(event.target.value);
                            clearFieldError('startTime');
                          }}
                          className={fieldInputClass('startTime')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.startTime && <p className="mt-1 text-xs text-red-600">{fieldErrors.startTime}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          반납 시간 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(event) => {
                            setEndTime(event.target.value);
                            clearFieldError('endTime');
                          }}
                          className={fieldInputClass('endTime')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.endTime && <p className="mt-1 text-xs text-red-600">{fieldErrors.endTime}</p>}
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
                        onChange={(event) => {
                          setStartTime(event.target.value);
                          clearFieldError('startTime');
                        }}
                        className={fieldInputClass('startTime')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.startTime && <p className="mt-1 text-xs text-red-600">{fieldErrors.startTime}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        반납 시간 <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(event) => {
                          setEndTime(event.target.value);
                          clearFieldError('endTime');
                        }}
                        className={fieldInputClass('endTime')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.endTime && <p className="mt-1 text-xs text-red-600">{fieldErrors.endTime}</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleStepOneNext}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  disabled={isSubmitting}
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  고객명 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    clearFieldError('customerName');
                  }}
                  placeholder="고객 이름"
                  className={fieldInputClass('customerName')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  연락처 <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => {
                    setCustomerPhone(event.target.value);
                    clearFieldError('customerPhone');
                  }}
                  placeholder="010-0000-0000"
                  className={fieldInputClass('customerPhone')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerPhone}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  주민번호 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerSSN}
                  onChange={(event) => {
                    setCustomerSSN(event.target.value);
                    clearFieldError('customerSSN');
                  }}
                  placeholder="123456-1234567"
                  className={fieldInputClass('customerSSN')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerSSN && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerSSN}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  면허번호 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerLicense}
                  onChange={(event) => {
                    setCustomerLicense(event.target.value);
                    clearFieldError('customerLicense');
                  }}
                  placeholder="1234567890123"
                  className={fieldInputClass('customerLicense')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerLicense && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerLicense}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  주소 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(event) => {
                    setCustomerAddress(event.target.value);
                    clearFieldError('customerAddress');
                  }}
                  placeholder="서울특별시 강남구 논현동 123-456"
                  className={fieldInputClass('customerAddress')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerAddress && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerAddress}</p>}
              </div>

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
                      onChange={(event) => {
                        setPickupLocation(event.target.value);
                        clearFieldError('pickupLocation');
                      }}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className={fieldInputClass('pickupLocation')}
                      disabled={isSubmitting}
                    />
                    {fieldErrors.pickupLocation && <p className="mt-1 text-xs text-red-600">{fieldErrors.pickupLocation}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">
                      반납 장소 <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={returnLocation}
                      onChange={(event) => {
                        setReturnLocation(event.target.value);
                        clearFieldError('returnLocation');
                      }}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className={fieldInputClass('returnLocation')}
                      disabled={isSubmitting}
                    />
                    {fieldErrors.returnLocation && <p className="mt-1 text-xs text-red-600">{fieldErrors.returnLocation}</p>}
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
                    onChange={(event) => {
                      setAmount(event.target.value);
                      clearFieldError('amount');
                    }}
                    placeholder="450,000"
                    className={fieldInputClass('amount')}
                    disabled={isSubmitting}
                  />
                  {fieldErrors.amount && <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    선금 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={deposit}
                    onChange={(event) => {
                      setDeposit(event.target.value);
                      clearFieldError('deposit');
                    }}
                    placeholder="500,000"
                    className={fieldInputClass('deposit')}
                    disabled={isSubmitting}
                  />
                  {fieldErrors.deposit && <p className="mt-1 text-xs text-red-600">{fieldErrors.deposit}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  결제 방법 <span className="text-red-600">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value as '카드' | '현금' | '계좌이체');
                    setSubmitError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                >
                  <option value="카드">카드</option>
                  <option value="현금">현금</option>
                  <option value="계좌이체">계좌이체</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  결제 상태 <span className="text-red-600">*</span>
                </label>
                <select
                  value={paymentStatus}
                  onChange={(event) => {
                    setPaymentStatus(event.target.value as '대기' | '완료' | '미납' | '부분납부');
                    setSubmitError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                >
                  이전
                </button>
                <button
                  onClick={handleStepTwoNext}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  disabled={isSubmitting}
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  운전면허증 <span className="text-red-600">*</span>
                </label>
                <label className="cursor-pointer block">
                  <div className={`flex items-center gap-2 p-3 text-gray-700 rounded-lg border justify-center transition-colors ${
                    fieldErrors.licenseFile
                      ? 'bg-red-50 border-red-300'
                      : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                  }`}>
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {licenseFile ? licenseFile.name : '파일 선택'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setLicenseFile(file);
                        clearFieldError('licenseFile');
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </label>
                {licenseFile && (
                  <p className="text-xs text-green-600 mt-1">✓ 파일이 선택되었습니다</p>
                )}
                {fieldErrors.licenseFile && <p className="mt-1 text-xs text-red-600">{fieldErrors.licenseFile}</p>}
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
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setContractFile(file);
                        setSubmitError(null);
                      }
                    }}
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
                >
                  이전
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? '저장 중...' : '확인 및 저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
