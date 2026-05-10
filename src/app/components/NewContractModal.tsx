import { useEffect, useState } from 'react';
import { X, Upload, CheckCircle, Loader2, AlertTriangle, Plus } from 'lucide-react';
import type { VehicleAsset } from '../types/assets';

interface DragSelection {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
}

export type NewContractField =
  | 'rentalType'
  | 'selectedVehicle'
  | 'startDate'
  | 'endDate'
  | 'startTime'
  | 'endTime'
  | 'customerName'
  | 'customerPhone'
  | 'customerLicense'
  | 'customerAddress'
  | 'contractorName'
  | 'contractorBusinessNumber'
  | 'contractorContactName'
  | 'contractorContactPhone'
  | 'payerType'
  | 'payerName'
  | 'payerPhone'
  | 'billingAccount'
  | 'pickupLocation'
  | 'returnLocation'
  | 'amount'
  | 'deposit'
  | 'monthlyAmount'
  | 'billingDay'
  | 'requesterName'
  | 'requesterPhone'
  | 'requesterOrganizationName'
  | 'insurerName'
  | 'claimNo'
  | 'adjusterPhone'
  | 'repairShopName'
  | 'repairShopLocation'
  | 'damagedVehicleNumber'
  | 'paymentDepositorName'
  | 'paymentApprovalNo'
  | 'licenseFile'
  | 'additionalDriverLicenseFiles'
  | 'contractFile';

export interface NewContractFormValues {
  rentalType: 'short_term' | 'long_term' | 'accident_replacement';
  selectedVehicle: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  customerLicense: string;
  customerAddress: string;
  contractorType: 'individual' | 'corporate';
  contractorName: string;
  contractorBusinessNumber: string;
  contractorContactName: string;
  contractorContactPhone: string;
  payerType: 'customer' | 'corporate';
  payerName: string;
  payerPhone: string;
  billingAccount: string;
  pickupLocation: string;
  returnLocation: string;
  amount: string;
  deposit: string;
  monthlyAmount: string;
  billingDay: string;
  billingTiming: 'prepaid' | 'postpaid';
  graceDays: string;
  advancePayment: string;
  requestSource: 'customer' | 'repair_shop' | 'insurer' | 'partner_platform' | 'corporate_partner' | 'dealer' | 'other';
  requesterOrganizationName: string;
  requesterName: string;
  requesterPhone: string;
  insurerName: string;
  claimNo: string;
  adjusterName: string;
  adjusterPhone: string;
  repairShopName: string;
  repairShopLocation: string;
  damagedVehicleNumber: string;
  damagedVehicleModel: string;
  deliveryLocation: string;
  billedAmount: string;
  paymentMethod: '카드' | '현금' | '계좌이체';
  paymentStatus: '대기' | '완료' | '미납' | '부분납부';
  paymentDepositorName: string;
  paymentApprovalNo: string;
  licenseFile: File | null;
  additionalDriverLicenseFiles: (File | null)[];
  contractFile: File | null;
  contractFiles: File[];
  additionalDrivers: NewContractDriverValues[];
}

export interface NewContractDriverValues {
  name: string;
  phone: string;
  licenseNumber: string;
  address: string;
}

export interface NewContractSubmitFeedback {
  formError?: string;
  fieldErrors?: Partial<Record<NewContractField, string>>;
  additionalDriverLicenseFileErrors?: Partial<Record<number, string>>;
}

export interface NewContractLocationOption {
  id: string;
  name: string;
  address: string;
}

interface NewContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: string[];
  vehicleAssets: VehicleAsset[];
  locationOptions?: NewContractLocationOption[];
  onCreateLocationOption?: (payload: { name: string; address: string }) => Promise<NewContractLocationOption>;
  dragSelection?: DragSelection | null;
  onValidateStepOne?: (formValues: Pick<NewContractFormValues, 'selectedVehicle' | 'startDate' | 'endDate' | 'startTime' | 'endTime'>) => Promise<NewContractSubmitFeedback | null>;
  onSubmit: (formValues: NewContractFormValues) => Promise<NewContractSubmitFeedback | null>;
}

function createTodayBaseDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const CALENDAR_BASE_DATE = createTodayBaseDate();
const PHONE_REGEX = /^010-\d{4}-\d{4}$/;
const CONTACT_PHONE_REGEX = /^(010-\d{4}-\d{4}|0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})$/;
const LICENSE_REGEX = /^\d{2}-\d{6}-\d{2}$/;
const BUSINESS_NUMBER_REGEX = /^\d{3}-\d{2}-\d{5}$/;
const FIELD_LABELS: Record<NewContractField, string> = {
  rentalType: '계약 유형',
  selectedVehicle: '차량',
  startDate: '대여 시작일',
  endDate: '대여 종료일',
  startTime: '픽업 시간',
  endTime: '반납 시간',
  customerName: '고객명',
  customerPhone: '연락처',
  customerLicense: '면허번호',
  customerAddress: '주소',
  contractorName: '계약 주체',
  contractorBusinessNumber: '사업자번호',
  contractorContactName: '계약 담당자',
  contractorContactPhone: '계약 담당자 연락처',
  payerType: '청구 대상',
  payerName: '청구 담당자',
  payerPhone: '청구 담당자 연락처',
  billingAccount: '청구 계정',
  pickupLocation: '대여 장소',
  returnLocation: '반납 장소',
  amount: '대여 요금',
  deposit: '선금',
  monthlyAmount: '월 렌트료',
  billingDay: '월 납부일',
  requesterOrganizationName: '요청 기관명',
  requesterName: '요청자명',
  requesterPhone: '요청자 연락처',
  insurerName: '보험사',
  claimNo: '사고접수번호',
  adjusterPhone: '담당자 연락처',
  repairShopName: '정비공장',
  repairShopLocation: '정비공장 주소',
  damagedVehicleNumber: '피해차량 번호',
  paymentDepositorName: '입금자명',
  paymentApprovalNo: '승인번호',
  licenseFile: '운전면허증 파일',
  additionalDriverLicenseFiles: '추가 운전자 면허증 파일',
  contractFile: '계약서 파일',
};

function hasTextValue(value: string): boolean {
  return value.trim().length > 0;
}

function formatCurrencyInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  return Number(digitsOnly).toLocaleString('ko-KR');
}

function currencyInputToNumber(value: string): number {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) {
    return 0;
  }
  return Number(digitsOnly);
}

function formatDateAsYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function buildValidationSummary(fieldErrors: Partial<Record<NewContractField, string>>): string {
  const messages = Object.entries(fieldErrors)
    .flatMap(([field, message]) => {
      if (!message) {
        return [];
      }
      const label = FIELD_LABELS[field as NewContractField] ?? field;
      return [`${label}: ${message}`];
    });

  return Array.from(new Set(messages)).join(' / ');
}

function buildSubmitErrorMessage(
  baseMessage: string,
  fieldErrors: Partial<Record<NewContractField, string>>,
): string {
  const summary = buildValidationSummary(fieldErrors);
  if (!summary) {
    return baseMessage;
  }
  return `${baseMessage} ${summary}`;
}

export function NewContractModal({
  isOpen,
  onClose,
  vehicleAssets,
  locationOptions,
  onCreateLocationOption,
  dragSelection,
  onValidateStepOne,
  onSubmit,
}: NewContractModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [rentalType, setRentalType] = useState<'short_term' | 'long_term' | 'accident_replacement'>('short_term');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLicense, setCustomerLicense] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [contractorType, setContractorType] = useState<'individual' | 'corporate'>('individual');
  const [contractorName, setContractorName] = useState('');
  const [contractorBusinessNumber, setContractorBusinessNumber] = useState('');
  const [contractorContactName, setContractorContactName] = useState('');
  const [contractorContactPhone, setContractorContactPhone] = useState('');
  const [payerType, setPayerType] = useState<'customer' | 'corporate'>('customer');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [billingAccount, setBillingAccount] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [returnLocation, setReturnLocation] = useState('');
  const [pickupLocationMode, setPickupLocationMode] = useState<'garage' | 'custom'>('custom');
  const [returnLocationMode, setReturnLocationMode] = useState<'garage' | 'custom'>('custom');
  const [activeLocationRegistrationTarget, setActiveLocationRegistrationTarget] = useState<'pickup' | 'return' | null>(null);
  const [newGarageName, setNewGarageName] = useState('');
  const [newGarageAddress, setNewGarageAddress] = useState('');
  const [newGarageError, setNewGarageError] = useState<string | null>(null);
  const [newGarageFieldErrors, setNewGarageFieldErrors] = useState<Partial<Record<'name' | 'address', string>>>({});
  const [isNewGarageSaving, setIsNewGarageSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [billingDay, setBillingDay] = useState('5');
  const [billingTiming, setBillingTiming] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [graceDays, setGraceDays] = useState('0');
  const [advancePayment, setAdvancePayment] = useState('');
  const [requestSource, setRequestSource] = useState<NewContractFormValues['requestSource']>('repair_shop');
  const [requesterOrganizationName, setRequesterOrganizationName] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [claimNo, setClaimNo] = useState('');
  const [adjusterName, setAdjusterName] = useState('');
  const [adjusterPhone, setAdjusterPhone] = useState('');
  const [repairShopName, setRepairShopName] = useState('');
  const [repairShopLocation, setRepairShopLocation] = useState('');
  const [damagedVehicleNumber, setDamagedVehicleNumber] = useState('');
  const [damagedVehicleModel, setDamagedVehicleModel] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [billedAmount, setBilledAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'카드' | '현금' | '계좌이체'>('카드');
  const [paymentStatus, setPaymentStatus] = useState<'대기' | '완료' | '미납' | '부분납부'>('대기');
  const [paymentDepositorName, setPaymentDepositorName] = useState('');
  const [paymentApprovalNo, setPaymentApprovalNo] = useState('');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [additionalDriverLicenseFiles, setAdditionalDriverLicenseFiles] = useState<(File | null)[]>([]);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [selectedModelFilters, setSelectedModelFilters] = useState<string[]>(['all']);
  const [additionalDrivers, setAdditionalDrivers] = useState<NewContractDriverValues[]>([]);
  const [activeDriverIndex, setActiveDriverIndex] = useState(0);
  const [pendingDriverRemovalIndex, setPendingDriverRemovalIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStepOne, setIsCheckingStepOne] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NewContractField, string>>>({});
  const [additionalDriverLicenseFileErrors, setAdditionalDriverLicenseFileErrors] = useState<Partial<Record<number, string>>>({});

  const uniqueVehicleModels = Array.from(new Set(
    vehicleAssets
      .map((vehicle) => vehicle.model?.trim())
      .filter((model): model is string => Boolean(model)),
  )).sort((a, b) => a.localeCompare(b, 'ko-KR'));

  const filteredVehicleAssets = selectedModelFilters.includes('all') || selectedModelFilters.length === 0
    ? vehicleAssets
    : vehicleAssets.filter((vehicle) => selectedModelFilters.includes(vehicle.model));

  const firstDriver = {
    name: contractorType === 'individual' ? contractorName : customerName,
    phone: contractorType === 'individual' ? contractorContactPhone : customerPhone,
    licenseNumber: customerLicense,
    address: customerAddress,
  };

  const visibleDrivers = [firstDriver, ...additionalDrivers];

  const derivedPayerType: 'customer' | 'corporate' = contractorType === 'corporate' ? 'corporate' : 'customer';
  const defaultLocationOption = locationOptions && locationOptions.length > 0 ? locationOptions[0] : null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSubmitError(null);
    setFieldErrors({});
    setAdditionalDriverLicenseFileErrors({});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!defaultLocationOption) {
      setPickupLocationMode('custom');
      setReturnLocationMode('custom');
      return;
    }
    setPickupLocationMode('garage');
    setReturnLocationMode('garage');
    setPickupLocation((previous) => previous || defaultLocationOption.name);
    setReturnLocation((previous) => previous || defaultLocationOption.name);
  }, [defaultLocationOption, isOpen]);

  useEffect(() => {
    if (rentalType !== 'long_term') {
      return;
    }
    setPayerType(derivedPayerType);
    if (contractorType === 'individual') {
      setCustomerName(contractorName);
      setCustomerPhone(contractorContactPhone);
      setPayerName('');
      setPayerPhone('');
      return;
    }
    setPayerName((previous) => previous || contractorContactName);
    setPayerPhone((previous) => previous || contractorContactPhone);
  }, [contractorContactName, contractorContactPhone, contractorName, contractorType, derivedPayerType, rentalType]);

  useEffect(() => {
    if (!selectedVehicle) {
      return;
    }
    if (filteredVehicleAssets.some((vehicle) => vehicle.vehicleNumber === selectedVehicle)) {
      return;
    }
    setSelectedVehicle('');
  }, [filteredVehicleAssets, selectedVehicle]);

  useEffect(() => {
    setAdditionalDriverLicenseFiles((previous) => additionalDrivers.map((_, index) => previous[index] ?? null));
  }, [additionalDrivers]);

  useEffect(() => {
    if (dragSelection && isOpen) {
      setSelectedVehicle(dragSelection.vehicleNumber);

      const start = new Date(CALENDAR_BASE_DATE);
      start.setDate(start.getDate() + dragSelection.startDate);
      const end = new Date(CALENDAR_BASE_DATE);
      end.setDate(end.getDate() + dragSelection.endDate);

      setStartDate(formatDateAsYmd(start));
      setEndDate(formatDateAsYmd(end));
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

  const toggleModelFilter = (model: string) => {
    setSelectedModelFilters((previous) => {
      if (model === 'all') {
        return ['all'];
      }
      const activeModels = previous.filter((value) => value !== 'all');
      const nextModels = activeModels.includes(model)
        ? activeModels.filter((value) => value !== model)
        : [...activeModels, model];
      return nextModels.length > 0 ? nextModels : ['all'];
    });
    if (selectedVehicle) {
      const selected = vehicleAssets.find((vehicle) => vehicle.vehicleNumber === selectedVehicle);
      if (selected && model !== 'all' && selectedModelFilters.includes('all') && selected.model !== model) {
        setSelectedVehicle('');
      }
    }
  };

  const updateAdditionalDriver = (
    index: number,
    field: keyof NewContractDriverValues,
    value: string,
  ) => {
    setAdditionalDrivers((previous) => previous.map((driver, currentIndex) => (
      currentIndex === index ? { ...driver, [field]: value } : driver
    )));
    const errorFieldByDriverField: Record<keyof NewContractDriverValues, NewContractField> = {
      name: 'customerName',
      phone: 'customerPhone',
      licenseNumber: 'customerLicense',
      address: 'customerAddress',
    };
    clearFieldError(errorFieldByDriverField[field]);
  };

  const addDriver = () => {
    setAdditionalDrivers((previous) => {
      if (previous.length >= 2) {
        return previous;
      }
      const nextDrivers = [...previous, { name: '', phone: '', licenseNumber: '', address: '' }];
      setActiveDriverIndex(nextDrivers.length);
      return nextDrivers;
    });
  };

  const removeDriver = (driverIndex: number) => {
    if (driverIndex <= 0) {
      return;
    }
    setPendingDriverRemovalIndex(driverIndex);
  };

  const confirmDriverRemoval = () => {
    if (pendingDriverRemovalIndex === null || pendingDriverRemovalIndex <= 0) {
      setPendingDriverRemovalIndex(null);
      return;
    }
    const additionalIndex = pendingDriverRemovalIndex - 1;
    setAdditionalDrivers((previous) => previous.filter((_, index) => index !== additionalIndex));
    setAdditionalDriverLicenseFiles((previous) => previous.filter((_, index) => index !== additionalIndex));
    setActiveDriverIndex((previous) => Math.max(0, Math.min(previous, additionalDrivers.length - 1)));
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next.customerName;
      delete next.customerPhone;
      delete next.customerLicense;
      delete next.customerAddress;
      delete next.additionalDriverLicenseFiles;
      return next;
    });
    setAdditionalDriverLicenseFileErrors({});
    setSubmitError(null);
    setPendingDriverRemovalIndex(null);
  };

  const updateAdditionalDriverLicenseFile = (index: number, file: File | null) => {
    setAdditionalDriverLicenseFiles((previous) => {
      const next = [...previous];
      next[index] = file;
      return next;
    });
    clearAdditionalDriverLicenseFileError(index);
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

  const clearAdditionalDriverLicenseFileError = (index: number) => {
    setAdditionalDriverLicenseFileErrors((previous) => {
      if (!previous[index]) {
        return previous;
      }
      const next = { ...previous };
      delete next[index];
      return next;
    });
    setFieldErrors((previous) => {
      if (!previous.additionalDriverLicenseFiles) {
        return previous;
      }
      const next = { ...previous };
      delete next.additionalDriverLicenseFiles;
      return next;
    });
    setSubmitError(null);
  };

  const resetState = () => {
    setStep(1);
    setRentalType('short_term');
    setSelectedVehicle('');
    setStartDate('');
    setEndDate('');
    setStartTime('09:00');
    setEndTime('18:00');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerLicense('');
    setCustomerAddress('');
    setContractorType('individual');
    setContractorName('');
    setContractorBusinessNumber('');
    setContractorContactName('');
    setContractorContactPhone('');
    setPayerType('customer');
    setPayerName('');
    setPayerPhone('');
    setBillingAccount('');
    setPickupLocation('');
    setReturnLocation('');
    setPickupLocationMode(locationOptions && locationOptions.length > 0 ? 'garage' : 'custom');
    setReturnLocationMode(locationOptions && locationOptions.length > 0 ? 'garage' : 'custom');
    setActiveLocationRegistrationTarget(null);
    setNewGarageName('');
    setNewGarageAddress('');
    setNewGarageError(null);
    setNewGarageFieldErrors({});
    setIsNewGarageSaving(false);
    setAmount('');
    setDeposit('');
    setMonthlyAmount('');
    setBillingDay('5');
    setBillingTiming('prepaid');
    setGraceDays('0');
    setAdvancePayment('');
    setRequestSource('repair_shop');
    setRequesterOrganizationName('');
    setRequesterName('');
    setRequesterPhone('');
    setInsurerName('');
    setClaimNo('');
    setAdjusterName('');
    setAdjusterPhone('');
    setRepairShopName('');
    setRepairShopLocation('');
    setDamagedVehicleNumber('');
    setDamagedVehicleModel('');
    setDeliveryLocation('');
    setBilledAmount('');
    setPaymentMethod('카드');
    setPaymentStatus('대기');
    setPaymentDepositorName('');
    setPaymentApprovalNo('');
    setLicenseFile(null);
    setAdditionalDriverLicenseFiles([]);
    setContractFile(null);
    setContractFiles([]);
    setSelectedModelFilters(['all']);
    setAdditionalDrivers([]);
    setActiveDriverIndex(0);
    setSubmitError(null);
    setFieldErrors({});
    setAdditionalDriverLicenseFileErrors({});
    setIsSubmitting(false);
    setIsCheckingStepOne(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const closeLocationRegistration = () => {
    if (isNewGarageSaving) {
      return;
    }
    setActiveLocationRegistrationTarget(null);
    setNewGarageName('');
    setNewGarageAddress('');
    setNewGarageError(null);
    setNewGarageFieldErrors({});
  };

  const handleLocationModeChange = (target: 'pickup' | 'return', value: string) => {
    if (value === '__custom__') {
      if (target === 'pickup') {
        setPickupLocationMode('custom');
        setPickupLocation('');
        clearFieldError('pickupLocation');
      } else {
        setReturnLocationMode('custom');
        setReturnLocation('');
        clearFieldError('returnLocation');
      }
      return;
    }
    if (value === '__new__') {
      setActiveLocationRegistrationTarget(target);
      setNewGarageName('');
      setNewGarageAddress('');
      setNewGarageError(null);
      setNewGarageFieldErrors({});
      return;
    }
    if (target === 'pickup') {
      setPickupLocationMode('garage');
      setPickupLocation(value);
      clearFieldError('pickupLocation');
    } else {
      setReturnLocationMode('garage');
      setReturnLocation(value);
      clearFieldError('returnLocation');
    }
  };

  const handleCreateGarageFromModal = async () => {
    if (!onCreateLocationOption || isNewGarageSaving || !activeLocationRegistrationTarget) {
      return;
    }
    const trimmedName = newGarageName.trim();
    const trimmedAddress = newGarageAddress.trim();
    const nextFieldErrors: Partial<Record<'name' | 'address', string>> = {};
    if (!trimmedName) {
      nextFieldErrors.name = '차고지 이름을 입력해 주세요.';
    }
    if (!trimmedAddress) {
      nextFieldErrors.address = '주소를 입력해 주세요.';
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setNewGarageFieldErrors(nextFieldErrors);
      setNewGarageError('입력값을 확인해 주세요.');
      return;
    }
    setIsNewGarageSaving(true);
    setNewGarageError(null);
    try {
      const createdGarage = await onCreateLocationOption({
        name: trimmedName,
        address: trimmedAddress,
      });
      if (activeLocationRegistrationTarget === 'pickup') {
        setPickupLocationMode('garage');
        setPickupLocation(createdGarage.name);
        clearFieldError('pickupLocation');
      } else {
        setReturnLocationMode('garage');
        setReturnLocation(createdGarage.name);
        clearFieldError('returnLocation');
      }
      setActiveLocationRegistrationTarget(null);
      setNewGarageName('');
      setNewGarageAddress('');
      setNewGarageFieldErrors({});
    } catch {
      setNewGarageError('차고지 등록에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsNewGarageSaving(false);
    }
  };

  const renderLocationField = (
    target: 'pickup' | 'return',
    label: string,
    value: string,
    mode: 'garage' | 'custom',
    field: Extract<NewContractField, 'pickupLocation' | 'returnLocation'>,
    testId: string,
    setValue: (nextValue: string) => void,
  ) => {
    const selectedLocationOption = mode === 'garage'
      ? (locationOptions ?? []).find((location) => location.name === value)
      : null;

    return (
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          {label} <span className="text-red-600">*</span>
        </label>
        <select
          data-testid={`${testId}-select`}
          value={mode === 'custom' ? '__custom__' : value}
          onChange={(event) => handleLocationModeChange(target, event.target.value)}
          className={fieldInputClass(field)}
          disabled={isSubmitting}
        >
          <option value="__custom__">직접 입력</option>
          {(locationOptions ?? []).map((location) => (
            <option key={location.id} value={location.name}>{location.name}</option>
          ))}
          {onCreateLocationOption && <option value="__new__">신규 차고지 등록</option>}
        </select>
        {mode === 'custom' && (
          <input
            data-testid={testId}
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              clearFieldError(field);
            }}
            placeholder="서울특별시 강남구 테헤란로 123"
            className={`${fieldInputClass(field)} mt-2`}
            disabled={isSubmitting}
          />
        )}
        {mode === 'garage' && selectedLocationOption?.address && (
          <p className="mt-1 text-xs text-gray-500">
            주소: {selectedLocationOption.address}
          </p>
        )}
        {fieldErrors[field] && <p className="mt-1 text-xs text-red-600">{fieldErrors[field]}</p>}
      </div>
    );
  };

  const selectedVehicleInfo = vehicleAssets.find((vehicle) => vehicle.vehicleNumber === selectedVehicle);

  const handleStepOneNext = async () => {
    if (isCheckingStepOne) {
      return;
    }
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
      const startDay = parseLocalDate(startDate);
      const today = createTodayBaseDate();
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || !startDay) {
        nextErrors.startDate = '유효한 날짜를 입력해 주세요.';
      } else if (endAt <= startAt) {
        nextErrors.endDate = '반납 일시는 픽업 일시보다 이후여야 합니다.';
      } else if (startDay < today) {
        nextErrors.startDate = '대여 시작일은 오늘 이후로 입력해 주세요.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setSubmitError(buildSubmitErrorMessage('필수 입력값을 확인해 주세요.', nextErrors));
      return;
    }

    if (onValidateStepOne) {
      setIsCheckingStepOne(true);
      setSubmitError(null);
      try {
        const feedback = await onValidateStepOne({
          selectedVehicle,
          startDate,
          endDate,
          startTime,
          endTime,
        });
        if (feedback) {
          if (feedback.fieldErrors) {
            setFieldErrors((prev) => ({ ...prev, ...feedback.fieldErrors }));
          }
          if (feedback.formError) {
            setSubmitError(buildSubmitErrorMessage(feedback.formError, feedback.fieldErrors ?? {}));
          }
          return;
        }
      } finally {
        setIsCheckingStepOne(false);
      }
    }

    setStep(2);
  };

  const handleStepTwoNext = () => {
    const nextErrors: Partial<Record<NewContractField, string>> = {};
    const requiresDriverAtCreation = rentalType === 'short_term' || (rentalType === 'long_term' && contractorType === 'individual');
    if (rentalType === 'long_term') {
      if (!hasTextValue(contractorName)) {
        nextErrors.contractorName = contractorType === 'corporate' ? '법인명을 입력해 주세요.' : '계약자명을 입력해 주세요.';
      }
      if (contractorType === 'corporate') {
        if (!hasTextValue(contractorBusinessNumber)) {
          nextErrors.contractorBusinessNumber = '사업자번호를 입력해 주세요.';
        } else if (!BUSINESS_NUMBER_REGEX.test(contractorBusinessNumber.trim())) {
          nextErrors.contractorBusinessNumber = '사업자번호는 000-00-00000 형식으로 입력해 주세요.';
        }
        if (!hasTextValue(contractorContactName)) {
          nextErrors.contractorContactName = '계약 담당자명을 입력해 주세요.';
        }
      }
      if (!hasTextValue(contractorContactPhone)) {
        nextErrors.contractorContactPhone = contractorType === 'corporate' ? '계약 담당자 연락처를 입력해 주세요.' : '계약자 연락처를 입력해 주세요.';
      } else if (!CONTACT_PHONE_REGEX.test(contractorContactPhone.trim())) {
        nextErrors.contractorContactPhone = '연락처는 010-0000-0000, 02-0000-0000 또는 1588-0000 형식으로 입력해 주세요.';
      }
      if (hasTextValue(payerPhone) && !CONTACT_PHONE_REGEX.test(payerPhone.trim())) {
        nextErrors.payerPhone = '청구 담당자 연락처는 010-0000-0000, 02-0000-0000 또는 1588-0000 형식으로 입력해 주세요.';
      }
    }
    if (requiresDriverAtCreation && !hasTextValue(customerName)) {
      nextErrors.customerName = rentalType === 'long_term' ? '실제 운전자명을 입력해 주세요.' : '고객명을 입력해 주세요.';
    }
    if (requiresDriverAtCreation && !hasTextValue(customerPhone)) {
      nextErrors.customerPhone = '연락처를 입력해 주세요.';
    } else if (hasTextValue(customerPhone) && !PHONE_REGEX.test(customerPhone.trim())) {
      nextErrors.customerPhone = '전화번호는 010-0000-0000 형식으로 입력해 주세요.';
    }
    if (requiresDriverAtCreation && !hasTextValue(customerLicense)) {
      nextErrors.customerLicense = '면허번호를 입력해 주세요.';
    } else if (hasTextValue(customerLicense) && !LICENSE_REGEX.test(customerLicense.trim())) {
      nextErrors.customerLicense = '면허번호는 XX-XXXXXX-XX 형식으로 입력해 주세요. (예: 11-123456-78)';
    }
    if (requiresDriverAtCreation && !hasTextValue(customerAddress)) {
      nextErrors.customerAddress = '주소를 입력해 주세요.';
    } else if (hasTextValue(customerAddress) && customerAddress.trim().length < 5) {
      nextErrors.customerAddress = '주소는 5자 이상 입력해 주세요.';
    }
    if (rentalType === 'long_term' && contractorType === 'individual') {
      for (const [index, driver] of additionalDrivers.entries()) {
        const driverLabel = `${index + 2}번째 운전자`;
        if (!hasTextValue(driver.name)) {
          nextErrors.customerName = `${driverLabel} 이름을 입력해 주세요.`;
          break;
        }
        if (!hasTextValue(driver.phone)) {
          nextErrors.customerPhone = `${driverLabel} 연락처를 입력해 주세요.`;
          break;
        }
        if (!PHONE_REGEX.test(driver.phone.trim())) {
          nextErrors.customerPhone = `${driverLabel} 연락처는 010-0000-0000 형식으로 입력해 주세요.`;
          break;
        }
        if (!hasTextValue(driver.licenseNumber)) {
          nextErrors.customerLicense = `${driverLabel} 면허번호를 입력해 주세요.`;
          break;
        }
        if (!LICENSE_REGEX.test(driver.licenseNumber.trim())) {
          nextErrors.customerLicense = `${driverLabel} 면허번호는 XX-XXXXXX-XX 형식으로 입력해 주세요.`;
          break;
        }
        if (!hasTextValue(driver.address)) {
          nextErrors.customerAddress = `${driverLabel} 주소를 입력해 주세요.`;
          break;
        }
        if (driver.address.trim().length < 5) {
          nextErrors.customerAddress = `${driverLabel} 주소는 5자 이상 입력해 주세요.`;
          break;
        }
      }
    }
    if (!hasTextValue(pickupLocation)) {
      nextErrors.pickupLocation = '대여 장소를 입력해 주세요.';
    }
    if (!hasTextValue(returnLocation)) {
      nextErrors.returnLocation = '반납 장소를 입력해 주세요.';
    }
    if (rentalType === 'accident_replacement') {
      const requestSourceLabel = {
        repair_shop: '정비공장',
        insurer: '보험사',
        customer: '고객 직접',
        partner_platform: '제휴 플랫폼',
        corporate_partner: '법인 제휴',
        dealer: '딜러',
        other: '기타',
      }[requestSource];
      if (!hasTextValue(requesterName)) {
        nextErrors.requesterName = '요청자명을 입력해 주세요.';
      }
      if (hasTextValue(requesterPhone) && !CONTACT_PHONE_REGEX.test(requesterPhone.trim())) {
        nextErrors.requesterPhone = '요청자 연락처는 010-0000-0000, 02-0000-0000 또는 1588-0000 형식으로 입력해 주세요.';
      }
      if (hasTextValue(adjusterPhone) && !CONTACT_PHONE_REGEX.test(adjusterPhone.trim())) {
        nextErrors.adjusterPhone = '담당자 연락처는 010-0000-0000, 02-0000-0000 또는 1588-0000 형식으로 입력해 주세요.';
      }
      if (requestSource === 'repair_shop') {
        if (!hasTextValue(requesterPhone)) {
          nextErrors.requesterPhone = '정비공장 요청자 연락처를 입력해 주세요.';
        }
        if (!hasTextValue(repairShopName)) {
          nextErrors.repairShopName = '정비공장을 입력해 주세요.';
        }
        if (!hasTextValue(repairShopLocation)) {
          nextErrors.repairShopLocation = '정비공장 주소를 입력해 주세요.';
        }
      } else if (requestSource === 'insurer') {
        if (!hasTextValue(insurerName)) {
          nextErrors.insurerName = '보험사를 입력해 주세요.';
        }
        if (!hasTextValue(requesterPhone) && !hasTextValue(adjusterPhone)) {
          nextErrors.requesterPhone = '보험사 요청자 또는 담당자 연락처를 입력해 주세요.';
          nextErrors.adjusterPhone = '보험사 요청자 또는 담당자 연락처를 입력해 주세요.';
        }
      } else if (requestSource === 'customer') {
        if (!hasTextValue(customerName)) {
          nextErrors.customerName = '고객명을 입력해 주세요.';
        }
        if (!hasTextValue(customerPhone)) {
          nextErrors.customerPhone = '고객 연락처를 입력해 주세요.';
        }
      } else if (requestSource === 'partner_platform') {
        if (!hasTextValue(requesterOrganizationName)) {
          nextErrors.requesterOrganizationName = '요청 기관명을 입력해 주세요.';
        }
        if (!hasTextValue(claimNo)) {
          nextErrors.claimNo = '외부 접수번호를 입력해 주세요.';
        }
        if (!hasTextValue(requesterPhone)) {
          nextErrors.requesterPhone = '제휴 플랫폼 연락처를 입력해 주세요.';
        }
      } else if (!hasTextValue(requesterPhone)) {
        nextErrors.requesterPhone = `${requestSourceLabel} 요청자 연락처를 입력해 주세요.`;
      }
      if (!hasTextValue(insurerName) && !hasTextValue(claimNo)) {
        nextErrors.insurerName = '보험사 또는 사고접수번호 중 하나를 입력해 주세요.';
        nextErrors.claimNo = '보험사 또는 사고접수번호 중 하나를 입력해 주세요.';
      }
    } else if (rentalType === 'long_term') {
      if (!hasTextValue(monthlyAmount)) {
        nextErrors.monthlyAmount = '월 렌트료를 입력해 주세요.';
      } else if (currencyInputToNumber(monthlyAmount) <= 0) {
        nextErrors.monthlyAmount = '월 렌트료는 0보다 커야 합니다.';
      }
      const billingDayValue = Number(billingDay);
      if (!hasTextValue(billingDay) || !Number.isInteger(billingDayValue) || billingDayValue < 1 || billingDayValue > 31) {
        nextErrors.billingDay = '월 납부일은 1일부터 31일 사이로 입력해 주세요.';
      }
    } else {
      if (!hasTextValue(amount)) {
        nextErrors.amount = '대여 요금을 입력해 주세요.';
      } else if (currencyInputToNumber(amount) <= 0) {
        nextErrors.amount = '대여 요금은 0보다 커야 합니다.';
      }
      const amountValue = currencyInputToNumber(amount);
      const depositValue = currencyInputToNumber(deposit);
      if (depositValue > amountValue) {
        nextErrors.deposit = '선금은 대여 요금을 초과할 수 없습니다.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setSubmitError(buildSubmitErrorMessage('필수 입력값을 확인해 주세요.', nextErrors));
      return;
    }

    setFieldErrors((previous) => {
      const next = { ...previous };
      ([
        'contractorName',
        'contractorBusinessNumber',
        'contractorContactName',
        'contractorContactPhone',
        'customerName',
        'customerPhone',
        'customerLicense',
        'customerAddress',
        'pickupLocation',
        'returnLocation',
        'billingAccount',
        'payerName',
        'payerPhone',
        'monthlyAmount',
        'billingDay',
        'amount',
        'deposit',
      ] as NewContractField[]).forEach((field) => {
        delete next[field];
      });
      return next;
    });
    setSubmitError(null);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const nextErrors: Partial<Record<NewContractField, string>> = {};
    const nextAdditionalDriverLicenseFileErrors: Partial<Record<number, string>> = {};
    if ((rentalType === 'short_term' || (rentalType === 'long_term' && contractorType === 'individual')) && !licenseFile) {
      nextErrors.licenseFile = '운전면허증 파일은 필수입니다.';
    }
    if (rentalType === 'long_term' && contractorType === 'individual') {
      const missingDriverFileIndex = additionalDrivers.findIndex((_, index) => !additionalDriverLicenseFiles[index]);
      if (missingDriverFileIndex >= 0) {
        const message = `${missingDriverFileIndex + 2}번째 운전자 면허증 파일을 업로드해 주세요.`;
        nextErrors.additionalDriverLicenseFiles = message;
        nextAdditionalDriverLicenseFileErrors[missingDriverFileIndex] = message;
      }
    }
    if (rentalType === 'long_term' && contractFiles.length === 0) {
      nextErrors.contractFile = '장기렌트 계약서 또는 납부 일정표 파일은 필수입니다.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      if (Object.keys(nextAdditionalDriverLicenseFileErrors).length > 0) {
        setAdditionalDriverLicenseFileErrors((prev) => ({ ...prev, ...nextAdditionalDriverLicenseFileErrors }));
      }
      setSubmitError(buildSubmitErrorMessage('필수 입력값을 확인해 주세요.', nextErrors));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const feedback = await onSubmit({
        rentalType,
        selectedVehicle,
        startDate,
        endDate,
        startTime,
        endTime,
        customerName,
        customerPhone,
        customerLicense,
        customerAddress,
        contractorType,
        contractorName,
        contractorBusinessNumber,
        contractorContactName,
        contractorContactPhone,
        payerType,
        payerName,
        payerPhone,
        billingAccount,
        pickupLocation,
        returnLocation,
        amount,
        deposit,
        monthlyAmount,
        billingDay,
        billingTiming,
        graceDays,
        advancePayment,
        requestSource,
        requesterOrganizationName,
        requesterName,
        requesterPhone,
        insurerName,
        claimNo,
        adjusterName,
        adjusterPhone,
        repairShopName,
        repairShopLocation,
        damagedVehicleNumber,
        damagedVehicleModel,
        deliveryLocation,
        billedAmount,
        paymentMethod,
        paymentStatus,
        paymentDepositorName,
        paymentApprovalNo,
        licenseFile,
        additionalDriverLicenseFiles,
        contractFile,
        contractFiles,
        additionalDrivers,
      });

      if (feedback) {
        if (feedback.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...feedback.fieldErrors }));
        }
        if (feedback.additionalDriverLicenseFileErrors) {
          setAdditionalDriverLicenseFileErrors((prev) => ({
            ...prev,
            ...feedback.additionalDriverLicenseFileErrors,
          }));
        }
        if (feedback.formError) {
          setSubmitError(buildSubmitErrorMessage(feedback.formError, feedback.fieldErrors ?? {}));
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
    <>
    <div data-testid="new-contract-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                <span className="text-sm font-medium">
                  {rentalType === 'long_term' ? '월 납부 조건' : rentalType === 'accident_replacement' ? '사고/보험 정보' : '고객 정보'}
                </span>
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
            <div data-testid="new-contract-submit-error" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  계약 유형 <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'short_term', label: '단기렌트' },
                    { value: 'long_term', label: '장기렌트' },
                    { value: 'accident_replacement', label: '사고대차' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setRentalType(option.value as NewContractFormValues['rentalType']);
                        clearFieldError('rentalType');
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                        rentalType === option.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      disabled={isSubmitting}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
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
                        차종
                      </label>
                      <details className="rounded-lg border border-gray-300 bg-white">
                        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-gray-700">
                          {selectedModelFilters.includes('all') || selectedModelFilters.length === 0
                            ? '전체'
                            : selectedModelFilters.join(', ')}
                        </summary>
                        <div className="border-t border-gray-200 p-2">
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={selectedModelFilters.includes('all')}
                              onChange={() => toggleModelFilter('all')}
                              disabled={isSubmitting}
                            />
                            전체
                          </label>
                          {uniqueVehicleModels.map((model) => (
                            <label key={model} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={!selectedModelFilters.includes('all') && selectedModelFilters.includes(model)}
                                onChange={() => toggleModelFilter(model)}
                                disabled={isSubmitting}
                              />
                              {model}
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        차량 선택 <span className="text-red-600">*</span>
                      </label>
                      <select
                        data-testid="new-contract-vehicle-select"
                        value={selectedVehicle}
                        onChange={(event) => {
                          setSelectedVehicle(event.target.value);
                          clearFieldError('selectedVehicle');
                        }}
                        className={fieldInputClass('selectedVehicle')}
                        disabled={isSubmitting}
                      >
                        <option value="">차량을 선택하세요</option>
                        {filteredVehicleAssets.map((vehicle) => (
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
                          data-testid="new-contract-start-date-input"
                          type="date"
                          value={startDate}
                          min={formatDateAsYmd(new Date())}
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
                          data-testid="new-contract-end-date-input"
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
                          data-testid="new-contract-start-time-input"
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
                          data-testid="new-contract-end-time-input"
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
                        data-testid="new-contract-start-time-input"
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
                        data-testid="new-contract-end-time-input"
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
                  data-testid="new-contract-step1-next"
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting || isCheckingStepOne}
                >
                  {isCheckingStepOne ? '예약 중복 확인 중...' : '다음'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700">
                {rentalType === 'long_term' ? '계약 주체/운전자/월 납부 조건' : rentalType === 'accident_replacement' ? '고객 정보' : '고객/결제 조건'}
              </h3>
              {rentalType === 'long_term' && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-gray-700">계약 주체</h4>
                    <div className="inline-flex rounded-lg border border-gray-300 p-1">
                      {[
                        { value: 'individual', label: '개인' },
                        { value: 'corporate', label: '법인' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            const nextType = option.value as 'individual' | 'corporate';
                            setContractorType(nextType);
                            setPayerType(nextType === 'corporate' ? 'corporate' : 'customer');
                            setActiveDriverIndex(0);
                            if (nextType === 'corporate') {
                              setAdditionalDrivers([]);
                            }
                            clearFieldError('contractorName');
                            clearFieldError('contractorBusinessNumber');
                            clearFieldError('contractorContactName');
                            clearFieldError('contractorContactPhone');
                          }}
                          className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                            contractorType === option.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          disabled={isSubmitting}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        {contractorType === 'corporate' ? '법인명' : '계약자명'} <span className="text-red-600">*</span>
                      </label>
                      <input
                        data-testid="new-contract-contractor-name-input"
                        type="text"
                        value={contractorName}
                        onChange={(event) => {
                          setContractorName(event.target.value);
                          clearFieldError('contractorName');
                        }}
                        placeholder={contractorType === 'corporate' ? '주식회사 판게아렌탈' : '계약자 이름'}
                        className={fieldInputClass('contractorName')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.contractorName && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractorName}</p>}
                    </div>
                    {contractorType === 'corporate' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          사업자번호 <span className="text-red-600">*</span>
                        </label>
                        <input
                          data-testid="new-contract-contractor-business-number-input"
                          type="text"
                          value={contractorBusinessNumber}
                          onChange={(event) => {
                            setContractorBusinessNumber(event.target.value);
                            clearFieldError('contractorBusinessNumber');
                          }}
                          placeholder="000-00-00000"
                          className={fieldInputClass('contractorBusinessNumber')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.contractorBusinessNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractorBusinessNumber}</p>}
                      </div>
                    )}
                    {contractorType === 'individual' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          계약자 연락처 <span className="text-red-600">*</span>
                        </label>
                        <input
                          data-testid="new-contract-contractor-contact-phone-input"
                          type="tel"
                          value={contractorContactPhone}
                          onChange={(event) => {
                            setContractorContactPhone(event.target.value);
                            clearFieldError('contractorContactPhone');
                          }}
                          placeholder="010-0000-0000"
                          className={fieldInputClass('contractorContactPhone')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.contractorContactPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractorContactPhone}</p>}
                      </div>
                    )}
                  </div>
                  {contractorType === 'corporate' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          계약 담당자명 <span className="text-red-600">*</span>
                        </label>
                        <input
                          data-testid="new-contract-contractor-contact-name-input"
                          type="text"
                          value={contractorContactName}
                          onChange={(event) => {
                            setContractorContactName(event.target.value);
                            clearFieldError('contractorContactName');
                          }}
                          className={fieldInputClass('contractorContactName')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.contractorContactName && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractorContactName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">
                          계약 담당자 연락처 <span className="text-red-600">*</span>
                        </label>
                        <input
                          data-testid="new-contract-contractor-contact-phone-input"
                          type="tel"
                          value={contractorContactPhone}
                          onChange={(event) => {
                            setContractorContactPhone(event.target.value);
                            clearFieldError('contractorContactPhone');
                          }}
                          placeholder="010-0000-0000"
                          className={fieldInputClass('contractorContactPhone')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.contractorContactPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractorContactPhone}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {rentalType === 'long_term' && contractorType === 'individual' && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-gray-700">실제 운전자</h4>
                    <button
                      type="button"
                      onClick={addDriver}
                      disabled={isSubmitting || additionalDrivers.length >= 2}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      운전자 추가
                    </button>
                  </div>
                  <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
                    {visibleDrivers.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActiveDriverIndex(index)}
                        className={`flex shrink-0 items-center gap-1 rounded-t-lg px-3 py-2 text-sm font-semibold ${
                          activeDriverIndex === index
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        운전자 {index + 1}
                        {index > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeDriver(index);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                removeDriver(index);
                              }
                            }}
                            className="ml-1 rounded-full px-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            x
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {activeDriverIndex === 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">운전자명</label>
                          <input type="text" value={firstDriver.name} className={fieldInputClass('customerName')} disabled />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">연락처</label>
                          <input type="tel" value={firstDriver.phone} className={fieldInputClass('customerPhone')} disabled />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">면허번호 <span className="text-red-600">*</span></label>
                          <input
                            data-testid="new-contract-customer-license-input"
                            type="text"
                            value={customerLicense}
                            onChange={(event) => {
                              setCustomerLicense(event.target.value);
                              clearFieldError('customerLicense');
                            }}
                            placeholder="11-123456-78"
                            className={fieldInputClass('customerLicense')}
                            disabled={isSubmitting}
                          />
                          {fieldErrors.customerLicense && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerLicense}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">주소 <span className="text-red-600">*</span></label>
                          <input
                            data-testid="new-contract-customer-address-input"
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
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">운전자명 <span className="text-red-600">*</span></label>
                          <input
                            data-testid="new-contract-additional-driver-name-input"
                            type="text"
                            value={additionalDrivers[activeDriverIndex - 1]?.name ?? ''}
                            onChange={(event) => updateAdditionalDriver(activeDriverIndex - 1, 'name', event.target.value)}
                            className={fieldInputClass('customerName')}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">연락처 <span className="text-red-600">*</span></label>
                          <input
                            data-testid="new-contract-additional-driver-phone-input"
                            type="tel"
                            value={additionalDrivers[activeDriverIndex - 1]?.phone ?? ''}
                            onChange={(event) => updateAdditionalDriver(activeDriverIndex - 1, 'phone', event.target.value)}
                            placeholder="010-0000-0000"
                            className={fieldInputClass('customerPhone')}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">면허번호 <span className="text-red-600">*</span></label>
                          <input
                            data-testid="new-contract-additional-driver-license-input"
                            type="text"
                            value={additionalDrivers[activeDriverIndex - 1]?.licenseNumber ?? ''}
                            onChange={(event) => updateAdditionalDriver(activeDriverIndex - 1, 'licenseNumber', event.target.value)}
                            placeholder="11-123456-78"
                            className={fieldInputClass('customerLicense')}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">주소 <span className="text-red-600">*</span></label>
                          <input
                            data-testid="new-contract-additional-driver-address-input"
                            type="text"
                            value={additionalDrivers[activeDriverIndex - 1]?.address ?? ''}
                            onChange={(event) => updateAdditionalDriver(activeDriverIndex - 1, 'address', event.target.value)}
                            className={fieldInputClass('customerAddress')}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {rentalType !== 'long_term' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  {rentalType === 'long_term' ? '운전자명' : '고객명'} {rentalType !== 'accident_replacement' && <span className="text-red-600">*</span>}
                </label>
                <input
                  data-testid="new-contract-customer-name-input"
                  type="text"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    clearFieldError('customerName');
                  }}
                  placeholder={rentalType === 'long_term' ? '실제 운전자 이름' : '고객 이름'}
                  className={fieldInputClass('customerName')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerName}</p>}
              </div>
              )}

              {rentalType !== 'long_term' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  연락처 {rentalType !== 'accident_replacement' && <span className="text-red-600">*</span>}
                </label>
                <input
                  data-testid="new-contract-customer-phone-input"
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
              )}

              {rentalType !== 'long_term' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  면허번호 {rentalType !== 'accident_replacement' && <span className="text-red-600">*</span>}
                </label>
                <input
                  data-testid="new-contract-customer-license-input"
                  type="text"
                  value={customerLicense}
                  onChange={(event) => {
                    setCustomerLicense(event.target.value);
                    clearFieldError('customerLicense');
                  }}
                  placeholder="11-123456-78"
                  className={fieldInputClass('customerLicense')}
                  disabled={isSubmitting}
                />
                {fieldErrors.customerLicense && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerLicense}</p>}
              </div>
              )}

              {rentalType !== 'long_term' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  주소 {rentalType !== 'accident_replacement' && <span className="text-red-600">*</span>}
                </label>
                <input
                  data-testid="new-contract-customer-address-input"
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
              )}

              <div className="border-t border-gray-200 pt-4 mt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">🚗 차량 인도/반납 장소</h3>

                <div className="grid grid-cols-2 gap-4">
                  {renderLocationField('pickup', '대여 장소', pickupLocation, pickupLocationMode, 'pickupLocation', 'new-contract-pickup-location-input', setPickupLocation)}
                  {renderLocationField('return', '반납 장소', returnLocation, returnLocationMode, 'returnLocation', 'new-contract-return-location-input', setReturnLocation)}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  차고지 목록은 설정 페이지의 차고지 탭에서 관리할 수 있습니다.
                </p>
              </div>

              {rentalType === 'long_term' ? (
                <div className="border-t border-gray-200 pt-4 mt-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-700">월 납부 조건</h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">청구 계정</label>
                    <input
                      data-testid="new-contract-billing-account-input"
                      type="text"
                      value={billingAccount}
                      onChange={(event) => {
                        setBillingAccount(event.target.value);
                        clearFieldError('billingAccount');
                      }}
                      placeholder="거래처 코드 또는 계좌 메모"
                      className={fieldInputClass('billingAccount')}
                      disabled={isSubmitting}
                    />
                    {fieldErrors.billingAccount && <p className="mt-1 text-xs text-red-600">{fieldErrors.billingAccount}</p>}
                  </div>
                  {contractorType === 'corporate' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">청구 담당자</label>
                        <input
                          data-testid="new-contract-payer-name-input"
                          type="text"
                          value={payerName}
                          onChange={(event) => {
                            setPayerName(event.target.value);
                            clearFieldError('payerName');
                          }}
                          className={fieldInputClass('payerName')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.payerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.payerName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">청구 담당자 연락처</label>
                        <input
                          data-testid="new-contract-payer-phone-input"
                          type="tel"
                          value={payerPhone}
                          onChange={(event) => {
                            setPayerPhone(event.target.value);
                            clearFieldError('payerPhone');
                          }}
                          placeholder="010-0000-0000"
                          className={fieldInputClass('payerPhone')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.payerPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.payerPhone}</p>}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        월 렌트료 <span className="text-red-600">*</span>
                      </label>
                      <input
                        data-testid="new-contract-monthly-amount-input"
                        type="text"
                        value={monthlyAmount}
                        onChange={(event) => {
                          setMonthlyAmount(formatCurrencyInput(event.target.value));
                          setAmount(formatCurrencyInput(event.target.value));
                          clearFieldError('monthlyAmount');
                        }}
                        placeholder="550,000"
                        className={fieldInputClass('monthlyAmount')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.monthlyAmount && <p className="mt-1 text-xs text-red-600">{fieldErrors.monthlyAmount}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        월 납부일 <span className="text-red-600">*</span>
                      </label>
                      <input
                        data-testid="new-contract-billing-day-input"
                        type="number"
                        min={1}
                        max={31}
                        value={billingDay}
                        onChange={(event) => {
                          setBillingDay(event.target.value.replace(/[^\d]/g, ''));
                          clearFieldError('billingDay');
                        }}
                        className={fieldInputClass('billingDay')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.billingDay && <p className="mt-1 text-xs text-red-600">{fieldErrors.billingDay}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        보증금
                      </label>
                      <input
                        data-testid="new-contract-deposit-input"
                        type="text"
                        value={deposit}
                        onChange={(event) => {
                          setDeposit(formatCurrencyInput(event.target.value));
                          clearFieldError('deposit');
                        }}
                        placeholder="1,000,000"
                        className={fieldInputClass('deposit')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.deposit && <p className="mt-1 text-xs text-red-600">{fieldErrors.deposit}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        선수금
                      </label>
                      <input
                        data-testid="new-contract-advance-payment-input"
                        type="text"
                        value={advancePayment}
                        onChange={(event) => setAdvancePayment(formatCurrencyInput(event.target.value))}
                        placeholder="550,000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        납부 방식
                      </label>
                      <select
                        value={billingTiming}
                        onChange={(event) => setBillingTiming(event.target.value as 'prepaid' | 'postpaid')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      >
                        <option value="prepaid">선불</option>
                        <option value="postpaid">후불</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">
                        연체 유예일
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={graceDays}
                        onChange={(event) => setGraceDays(event.target.value.replace(/[^\d]/g, ''))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              ) : rentalType === 'accident_replacement' ? (
                <div className="border-t border-gray-200 pt-4 mt-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-700">사고/보험 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">요청 출처</label>
                      <select
                        value={requestSource}
                        onChange={(event) => setRequestSource(event.target.value as NewContractFormValues['requestSource'])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      >
                        <option value="repair_shop">정비공장</option>
                        <option value="insurer">보험사</option>
                        <option value="customer">고객 직접</option>
                        <option value="partner_platform">제휴 플랫폼</option>
                        <option value="corporate_partner">법인 제휴</option>
                        <option value="dealer">딜러</option>
                        <option value="other">기타</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">요청 기관명</label>
                      <input
                        type="text"
                        value={requesterOrganizationName}
                        onChange={(event) => {
                          setRequesterOrganizationName(event.target.value);
                          clearFieldError('requesterOrganizationName');
                        }}
                        placeholder="정비공장/보험사/제휴처"
                        className={fieldInputClass('requesterOrganizationName')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.requesterOrganizationName && <p className="mt-1 text-xs text-red-600">{fieldErrors.requesterOrganizationName}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">요청자명 <span className="text-red-600">*</span></label>
                      <input
                        type="text"
                        value={requesterName}
                        onChange={(event) => {
                          setRequesterName(event.target.value);
                          clearFieldError('requesterName');
                        }}
                        className={fieldInputClass('requesterName')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.requesterName && <p className="mt-1 text-xs text-red-600">{fieldErrors.requesterName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">요청자 연락처 <span className="text-red-600">*</span></label>
                      <input
                        type="tel"
                        value={requesterPhone}
                        onChange={(event) => {
                          setRequesterPhone(event.target.value);
                          clearFieldError('requesterPhone');
                        }}
                        placeholder="010-0000-0000"
                        className={fieldInputClass('requesterPhone')}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.requesterPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.requesterPhone}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">보험사 <span className="text-red-600">*</span> <span className="text-xs font-medium text-gray-400">(사고접수번호 없을 때)</span></label>
                      <input type="text" value={insurerName} onChange={(event) => { setInsurerName(event.target.value); clearFieldError('insurerName'); }} className={fieldInputClass('insurerName')} disabled={isSubmitting} />
                      {fieldErrors.insurerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.insurerName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">사고접수번호 <span className="text-red-600">*</span> <span className="text-xs font-medium text-gray-400">(보험사 없을 때)</span></label>
                      <input type="text" value={claimNo} onChange={(event) => { setClaimNo(event.target.value); clearFieldError('claimNo'); }} className={fieldInputClass('claimNo')} disabled={isSubmitting} />
                      {fieldErrors.claimNo && <p className="mt-1 text-xs text-red-600">{fieldErrors.claimNo}</p>}
                    </div>
                    <p className="col-span-2 text-xs text-gray-500">보험사 또는 사고접수번호 중 하나는 필수입니다.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">보험 담당자</label>
                      <input type="text" value={adjusterName} onChange={(event) => setAdjusterName(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">담당자 연락처</label>
                      <input type="tel" value={adjusterPhone} onChange={(event) => { setAdjusterPhone(event.target.value); clearFieldError('adjusterPhone'); }} className={fieldInputClass('adjusterPhone')} disabled={isSubmitting} />
                      {fieldErrors.adjusterPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.adjusterPhone}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">정비공장 <span className="text-red-600">*</span></label>
                      <input type="text" value={repairShopName} onChange={(event) => { setRepairShopName(event.target.value); clearFieldError('repairShopName'); }} className={fieldInputClass('repairShopName')} disabled={isSubmitting} />
                      {fieldErrors.repairShopName && <p className="mt-1 text-xs text-red-600">{fieldErrors.repairShopName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">정비공장 주소 {requestSource === 'repair_shop' && <span className="text-red-600">*</span>}</label>
                      <input type="text" value={repairShopLocation} onChange={(event) => { setRepairShopLocation(event.target.value); clearFieldError('repairShopLocation'); }} placeholder="정비공장 주소" className={fieldInputClass('repairShopLocation')} disabled={isSubmitting} />
                      {fieldErrors.repairShopLocation && <p className="mt-1 text-xs text-red-600">{fieldErrors.repairShopLocation}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">실제 인도지</label>
                      <input type="text" value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} placeholder="비워두면 대여 장소 사용" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">피해차량 번호</label>
                      <input type="text" value={damagedVehicleNumber} onChange={(event) => { setDamagedVehicleNumber(event.target.value); clearFieldError('damagedVehicleNumber'); }} className={fieldInputClass('damagedVehicleNumber')} disabled={isSubmitting} />
                      {fieldErrors.damagedVehicleNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.damagedVehicleNumber}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">피해차량 차종/차급</label>
                      <input type="text" value={damagedVehicleModel} onChange={(event) => setDamagedVehicleModel(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">예상 보험청구액</label>
                      <input type="text" value={billedAmount} onChange={(event) => setBilledAmount(formatCurrencyInput(event.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">
                      대여 요금 <span className="text-red-600">*</span>
                    </label>
                    <input
                      data-testid="new-contract-amount-input"
                      type="text"
                      value={amount}
                      onChange={(event) => {
                        setAmount(formatCurrencyInput(event.target.value));
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
                      선금
                    </label>
                    <input
                      data-testid="new-contract-deposit-input"
                      type="text"
                      value={deposit}
                      onChange={(event) => {
                        setDeposit(formatCurrencyInput(event.target.value));
                        clearFieldError('deposit');
                      }}
                      placeholder="500,000"
                      className={fieldInputClass('deposit')}
                      disabled={isSubmitting}
                    />
                    {fieldErrors.deposit && <p className="mt-1 text-xs text-red-600">{fieldErrors.deposit}</p>}
                  </div>
                </div>
              )}

              {rentalType === 'short_term' && (
                <>
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
                      현장에서 결제받은 경우 '완료'를 선택하세요
                    </p>
                  </div>

                  {(paymentStatus === '완료' || paymentStatus === '부분납부') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">입금자명</label>
                        <input
                          data-testid="new-contract-payment-depositor-input"
                          type="text"
                          value={paymentDepositorName}
                          onChange={(event) => {
                            setPaymentDepositorName(event.target.value);
                            clearFieldError('paymentDepositorName');
                          }}
                          placeholder="입금자 또는 카드 명의"
                          className={fieldInputClass('paymentDepositorName')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.paymentDepositorName && <p className="mt-1 text-xs text-red-600">{fieldErrors.paymentDepositorName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">승인번호</label>
                        <input
                          data-testid="new-contract-payment-approval-input"
                          type="text"
                          value={paymentApprovalNo}
                          onChange={(event) => {
                            setPaymentApprovalNo(event.target.value);
                            clearFieldError('paymentApprovalNo');
                          }}
                          placeholder="카드 승인번호 또는 입금 메모"
                          className={fieldInputClass('paymentApprovalNo')}
                          disabled={isSubmitting}
                        />
                        {fieldErrors.paymentApprovalNo && <p className="mt-1 text-xs text-red-600">{fieldErrors.paymentApprovalNo}</p>}
                      </div>
                    </div>
                  )}
                </>
              )}

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
                  data-testid="new-contract-step2-next"
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
              {rentalType === 'long_term' && contractorType === 'individual' ? (
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="mb-3 text-sm font-bold text-gray-700">운전자별 면허증</h3>
                  <div className="space-y-3">
                    {visibleDrivers.map((driver, index) => {
                      const file = index === 0 ? licenseFile : additionalDriverLicenseFiles[index - 1];
                      const driverFileError = index === 0 ? fieldErrors.licenseFile : additionalDriverLicenseFileErrors[index - 1];
                      const hasError = index === 0 ? Boolean(fieldErrors.licenseFile) : Boolean(driverFileError);
                      return (
                        <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-gray-700">
                              운전자 {index + 1}{driver.name ? ` - ${driver.name}` : ''}
                            </span>
                            <span className="text-xs font-medium text-red-600">필수</span>
                          </div>
                          <label className="block cursor-pointer">
                            <div className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-gray-700 transition-colors ${
                              hasError
                                ? 'border-red-300 bg-red-50'
                                : 'border-gray-300 bg-white hover:bg-gray-100'
                            }`}>
                              <Upload className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {file ? file.name : '파일 선택'}
                              </span>
                            </div>
                            <input
                              data-testid={index === 0 ? 'new-contract-license-file-input' : `new-contract-additional-driver-license-file-${index}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] ?? null;
                                if (index === 0) {
                                  setLicenseFile(nextFile);
                                  clearFieldError('licenseFile');
                                } else {
                                  updateAdditionalDriverLicenseFile(index - 1, nextFile);
                                }
                              }}
                              disabled={isSubmitting}
                            />
                          </label>
                          {file && (
                            <p className="mt-1 text-xs text-green-600">✓ 파일이 선택되었습니다</p>
                          )}
                          {driverFileError && (
                            <p className="mt-1 text-xs text-red-600">{driverFileError}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {fieldErrors.additionalDriverLicenseFiles && Object.keys(additionalDriverLicenseFileErrors).length === 0 && (
                    <p className="mt-2 text-xs text-red-600">{fieldErrors.additionalDriverLicenseFiles}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">각 운전자별 면허증 앞면 또는 전체 사진을 업로드하세요.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    운전면허증 {rentalType === 'short_term' && <span className="text-red-600">*</span>}
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
                      data-testid="new-contract-license-file-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setLicenseFile(file);
                        clearFieldError('licenseFile');
                      }}
                      disabled={isSubmitting}
                    />
                  </label>
                  {licenseFile && (
                    <p className="text-xs text-green-600 mt-1">✓ 파일이 선택되었습니다</p>
                  )}
                  {fieldErrors.licenseFile && <p className="mt-1 text-xs text-red-600">{fieldErrors.licenseFile}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    {rentalType === 'long_term' && contractorType === 'corporate'
                      ? '법인 장기렌트는 실제 운전자 정보를 등록하지 않으므로 선택 입력입니다'
                      : rentalType === 'accident_replacement'
                      ? '정비소 배차 접수 단계에서는 선택 입력입니다. 실제 운전자 인수 전 확보하세요'
                      : '면허증 앞면 또는 전체 사진을 업로드하세요'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  {rentalType === 'long_term' ? '장기렌트 계약서/납부 일정표' : '대여계약서'}
                  {rentalType === 'long_term' ? <span className="text-red-600"> *</span> : ' (선택)'}
                </label>
                <label className="cursor-pointer block">
                  <div className={`flex items-center gap-2 p-3 text-gray-700 rounded-lg border justify-center transition-colors ${
                    fieldErrors.contractFile
                      ? 'bg-red-50 border-red-300'
                      : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                  }`}>
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {contractFiles.length > 0
                        ? `${contractFiles.length}개 파일 선택됨`
                        : contractFile
                          ? contractFile.name
                          : '파일 선택'}
                    </span>
                  </div>
                  <input
                    data-testid="new-contract-contract-file-input"
                    type="file"
                    multiple={rentalType === 'long_term'}
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (files.length > 0) {
                        setContractFiles(files);
                        setContractFile(files[0] ?? null);
                        clearFieldError('contractFile');
                        setSubmitError(null);
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </label>
                {contractFiles.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {contractFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                        <span className="min-w-0 truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextFiles = contractFiles.filter((_, fileIndex) => fileIndex !== index);
                            setContractFiles(nextFiles);
                            setContractFile(nextFiles[0] ?? null);
                          }}
                          className="shrink-0 font-semibold text-green-800 hover:text-green-950"
                          disabled={isSubmitting}
                        >
                          제거
                        </button>
                      </div>
                    ))}
                  </div>
                ) : contractFile && (
                  <p className="text-xs text-green-600 mt-1">파일이 선택되었습니다</p>
                )}
                {fieldErrors.contractFile && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractFile}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  {rentalType === 'long_term'
                    ? '월 납부 조건 확인을 위해 계약서 또는 납부 일정표를 업로드하세요'
                    : rentalType === 'accident_replacement'
                      ? '보험사/정비소 요청서 또는 대차 확인서가 있는 경우 업로드하세요'
                      : '계약서가 있는 경우 업로드하세요'}
                </p>
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
                  data-testid="new-contract-submit"
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
    {activeLocationRegistrationTarget !== null && (
      <div data-testid="new-contract-garage-registration-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#1e2939]">신규 차고지 등록</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              등록한 차고지는 설정 페이지의 차고지 탭에도 반영됩니다.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                차고지 이름 <span className="text-red-600">*</span>
              </label>
              <input
                data-testid="new-contract-garage-name-input"
                type="text"
                value={newGarageName}
                onChange={(event) => {
                  setNewGarageName(event.target.value);
                  setNewGarageFieldErrors((prev) => ({ ...prev, name: undefined }));
                  setNewGarageError(null);
                }}
                placeholder="차고지 이름을 입력하세요"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  newGarageFieldErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isNewGarageSaving}
              />
              {newGarageFieldErrors.name && <p className="mt-1 text-xs text-red-600">{newGarageFieldErrors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                주소 <span className="text-red-600">*</span>
              </label>
              <input
                data-testid="new-contract-garage-address-input"
                type="text"
                value={newGarageAddress}
                onChange={(event) => {
                  setNewGarageAddress(event.target.value);
                  setNewGarageFieldErrors((prev) => ({ ...prev, address: undefined }));
                  setNewGarageError(null);
                }}
                placeholder="주소를 입력하세요"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  newGarageFieldErrors.address ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isNewGarageSaving}
              />
              {newGarageFieldErrors.address && <p className="mt-1 text-xs text-red-600">{newGarageFieldErrors.address}</p>}
            </div>
            {newGarageError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {newGarageError}
              </p>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeLocationRegistration}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isNewGarageSaving}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => { void handleCreateGarageFromModal(); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isNewGarageSaving}
            >
              {isNewGarageSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isNewGarageSaving ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </div>
    )}
    {pendingDriverRemovalIndex !== null && (
      <div data-testid="driver-delete-confirm-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-full bg-red-50 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1e2939]">운전자 삭제</h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                운전자 {pendingDriverRemovalIndex + 1} 정보를 삭제하시겠습니까?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingDriverRemovalIndex(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={confirmDriverRemoval}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
