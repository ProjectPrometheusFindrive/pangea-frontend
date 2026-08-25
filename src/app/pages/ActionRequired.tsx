import { Layout } from '../components/Layout';
import { useSearchParams, useNavigate } from 'react-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, X, ArrowUp, ArrowDown, Clock, User, CheckCircle2, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Calendar, DollarSign, Car, Info, Activity, Upload } from 'lucide-react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { ACTION_PERMISSIONS, ROUTE_PERMISSIONS } from '../authorization';
import { ApiError } from '../../services/api';
import { getAssetDetail, getAssetsList, patchAsset } from '../../services/assets';
import { signAssetUpload, uploadFileToSignedUrl } from '../../services/assetOcr';
import {
  getActionRequiredDetail,
  getActionRequiredListAll,
  patchActionRequiredMemo,
  patchActionRequiredStatus,
  rejectActionRequiredAccidentApproval,
  runActionRequiredDomainAction,
} from '../../services/actionRequired';
import { patchPaymentStatus } from '../../services/payments';
import {
  getReservationDetail,
  patchReservation,
  patchReservationAccidentFollowup,
  returnReservation,
} from '../../services/reservations';
import {
  createReservationChargeItem,
  createReservationPaymentRecord,
  patchChargeItem,
} from '../../services/billing';
import {
  getAccidentClaim,
  patchAccidentClaim,
  recognizeAccidentClaim,
  submitAccidentClaim,
} from '../../services/accidentClaims';
import { listSettingsMembers, type SettingsMember } from '../../services/settings';
import { formatDateKst, formatDateTimeKst } from '../utils/dateTimeFormat';
import { toDateInputValue } from '../utils/dateInputValue';
import { DateTextPicker } from '../components/DateTextPicker';
import {
  invalidatePaymentStatusCache,
  paymentStatusToLabel,
  toCanonicalPaymentStatus,
} from '../utils/paymentStatusSync';
import {
  ACTION_MAIN_CATEGORIES,
  ACTION_SUBCATEGORIES_BY_CATEGORY,
  type ActionMainCategory,
  normalizeActionMainCategory,
  normalizeActionSubCategory,
} from '../utils/actionItemTaxonomy';
import {
  type ActionItemWorkChargeItem,
  type ActionItemWorkContext,
  WorkContextPanel,
  isRefundChargeItem,
  isWorkChargeSettled,
  toWorkChargeItems,
  toWorkContext,
} from './action-required/workContext';

type ActionStatusCode = 'pending' | 'in-progress' | 'resolved';
type SettlementPaymentCheckStatus = 'required' | 'completed' | 'waiting' | 'not_applicable';
type SettlementDifferenceStatus = 'required' | 'settled' | 'not_applicable';

interface MemoLog {
  id: string;
  content: string;
  timestamp: string;
  author: string;
  status: ActionStatusCode;
  statusLabel: string;
  sortTimestamp: number;
  sortTimestampRaw: string;
  sortSequence: number;
}

interface ActionItem {
  id: string;
  type: string;
  subCategory?: string;
  reasonType?: string;
  issueCode?: string;
  submissionDelayed?: boolean;
  delayBusinessDays?: number;
  claimReadyAt?: string;
  returnFollowupKind?: string;
  settlementNeedsPaymentCheck?: boolean;
  settlementNeedsDifference?: boolean;
  settlementPaymentCheckStatus?: SettlementPaymentCheckStatus;
  settlementPaymentCheckMessage?: string;
  settlementDifferenceStatus?: SettlementDifferenceStatus;
  settlementDifferenceMessage?: string;
  resolutionPolicy?: string;
  availableActions?: string[];
  relatedChargeItemId?: string;
  vehicleNumber: string;
  customerName: string;
  date: string;
  severity: 'High' | 'Medium' | 'Low';
  status: string;
  statusCode: ActionStatusCode;
  assignee: string;
  assigneeId?: string;
  reservationId?: string;
  paymentId?: string;
  description?: string;
  memos?: MemoLog[];
  documentDetails?: ActionDocumentDetail[];
  workContext?: ActionItemWorkContext;
  paymentInfo?: {
    paymentId?: string;
    reservationId?: string;
    principalAmount: number;
    additionalAmount: number;
    amount: number;
    overdueDays: number;
    totalAmount: number;
    dueDate: string;
    paymentType: '카드' | '현금' | '계좌이체';
    status?: string;
    statusLabel?: string;
    updatedAt?: string;
  };
}

interface ActionDocumentDetail {
  objectName: string;
  fileName?: string;
  contentType?: string;
  url?: string;
}

interface FilePickerCardProps {
  label: string;
  buttonLabel: string;
  selectedFileNames?: string[];
  savedLabel?: string;
  savedDocuments?: ActionDocumentDetail[];
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (files: File[]) => void;
  onPreview?: (document: ActionDocumentDetail) => void;
}

function FilePickerCard({
  label,
  buttonLabel,
  selectedFileNames = [],
  savedLabel = '저장된 문서',
  savedDocuments = [],
  accept,
  multiple = false,
  disabled = false,
  onChange,
  onPreview,
}: FilePickerCardProps) {
  const hasFiles = selectedFileNames.length > 0 || savedDocuments.length > 0;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      <label className={`block rounded-lg border border-dashed px-3 py-3 text-center text-sm font-semibold ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
          : 'cursor-pointer border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
      }`}>
        <span className="inline-flex items-center justify-center gap-2">
          <Upload className="h-4 w-4" />
          {selectedFileNames.length > 0
            ? multiple
              ? `${selectedFileNames.length}개 파일 선택됨`
              : selectedFileNames[0]
            : buttonLabel}
        </span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
          disabled={disabled}
          className="sr-only"
        />
      </label>
      {hasFiles && (
        <div className="space-y-1 text-xs">
          {selectedFileNames.map((fileName, index) => (
            <div key={`${fileName}-${index}`} className="rounded-md bg-green-50 px-2 py-1 font-medium text-green-700">
              {fileName}
            </div>
          ))}
          {savedDocuments.map((document) => (
            document.url || onPreview ? (
              <button
                key={document.objectName}
                type="button"
                onClick={() => {
                  if (onPreview) {
                    onPreview(document);
                  } else if (document.url) {
                    window.open(document.url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="block w-full rounded-md bg-gray-50 px-2 py-1 text-left font-semibold text-blue-700 hover:bg-blue-100"
              >
                {document.fileName || savedLabel}
              </button>
            ) : (
              <div key={document.objectName} className="rounded-md bg-gray-50 px-2 py-1 text-gray-600">
                {document.fileName || savedLabel}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

interface SettlementChecklistRowProps {
  title: string;
  statusLabel: string;
  statusClassName: string;
  message: string;
}

function SettlementChecklistRow({
  title,
  statusLabel,
  statusClassName,
  message,
}: SettlementChecklistRowProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{message}</p>
    </div>
  );
}

interface RecognizedAmountInputProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function RecognizedAmountInput({ value, disabled, onChange }: RecognizedAmountInputProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-600">보험 인정금액</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ''))}
          placeholder="금액 입력"
          inputMode="numeric"
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">원</span>
      </div>
      <p className="text-xs text-gray-500">보험사가 인정한 대차료 금액을 입력하면 차액이 자동 계산됩니다.</p>
    </div>
  );
}

const DIFFERENCE_PAYER_OPTIONS = [
  {
    value: 'customer',
    label: '고객에게 청구',
    description: '인정되지 않은 금액을 고객 부담금으로 청구합니다.',
  },
  {
    value: 'insurer',
    label: '보험사에 재청구',
    description: '보완 자료로 추가 인정 또는 재정산을 요청합니다.',
  },
  {
    value: 'waived',
    label: '차액 면제 처리',
    description: '내부 정책에 따라 차액을 받지 않고 종결합니다.',
  },
  {
    value: 'disputed',
    label: '분쟁/보류',
    description: '책임 또는 금액이 확정되지 않아 정산을 보류합니다.',
  },
] as const;

interface DifferencePayerRadioCardsProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function DifferencePayerRadioCards({ value, disabled, onChange }: DifferencePayerRadioCardsProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-gray-600">차액 처리 방식</legend>
      <div className="grid gap-2">
        {DIFFERENCE_PAYER_OPTIONS.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 ${
                checked ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-orange-200'}`}
            >
              <input
                type="radio"
                name="accident-claim-difference-payer"
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="mt-1 h-4 w-4 text-orange-600"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                <span className="block text-xs leading-relaxed text-gray-600">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

type SortField = 'type' | 'vehicleNumber' | 'customerName' | 'date' | 'severity' | 'status' | 'assignee';
type SortDirection = 'asc' | 'desc' | null;
type ActionStatusFilter = 'all' | 'pending' | 'in-progress' | 'resolved';
type ActionPriorityFilter = 'all' | 'high' | 'medium' | 'low';
type ActionWriteKind = 'status' | 'memo' | 'resolve' | 'assignee';
type ActionIssueFilter =
  ActionMainCategory;

const STATUS_OPTIONS = ['대기중', '진행중', '완료'] as const;
const LIST_COLLECTION_KEYS = ['items', 'rows', 'list', 'actionRequired', 'actionItems'];
const ACTIVE_ACTION_STATUS_QUERY = 'open,in_progress';
const ISSUE_FILTER_CHIPS: ActionIssueFilter[] = ACTION_MAIN_CATEGORIES;
const ACTION_PRIORITY_LABELS: Record<ActionItem['severity'], string> = {
  High: '높음',
  Medium: '보통',
  Low: '낮음',
};

interface ActionWriteErrorState {
  kind: ActionWriteKind;
  message: string;
  retryable: boolean;
  fields?: { name?: string; reason?: string }[];
}

interface OptimisticActionSnapshot {
  selectedItem: ActionItem | null;
  sourceActionItems: ActionItem[];
  totalItems: number;
}

interface AssigneeOption {
  userId: string;
  name: string;
}

type LateReturnResolveDialogState = 'confirm-returned' | 'return-required' | null;
type PaymentIssueResolveDialogState = 'choose-payment-resolution' | null;
type RelatedContextPanelKind = 'reservation' | 'asset' | 'billing' | 'claim';

type PendingPaymentConfirmation =
  | {
      kind: 'payment-issue';
      item: ActionItem;
      nextStatus: 'paid' | 'canceled';
      title: string;
      description: string;
      confirmLabel: string;
    }
  | {
      kind: 'work-charge';
      item: ActionItem;
      charge: ActionItemWorkChargeItem;
      mode: 'paid' | 'waived' | 'refunded';
      title: string;
      description: string;
      confirmLabel: string;
    };

type IssueAssetKind = 'insurance' | 'inspection';

interface IssueAssetRecord {
  id: string;
  version: number;
  vehicleNumber: string;
  insuranceExpiry: string;
  nextInspection: string;
}

interface AccidentClaimDraft {
  claimNo: string;
  insurerName: string;
  repairShopName: string;
  repairCompletedAt: string;
  billingAccount: string;
  approvalStatus: string;
  approvalDocumentObjectName: string;
  approvalDocumentObjectNames: string[];
  approvalDocumentDetails: ActionDocumentDetail[];
  approvalMemo: string;
  billedAmount: string;
  recognizedAmount: string;
  differencePayerType: string;
  supplementMemo: string;
  documentDetails: ActionDocumentDetail[];
  documentStatus: string;
  claimStatus: string;
  submittedAt: string;
}

interface RentalAccidentDraft {
  registrationDescription: string;
  accidentLocation: string;
  opponentInfo: string;
  insuranceClaimNo: string;
  evidenceStatus: string;
  accidentEvidenceDocuments: Record<string, string>;
  accidentEvidenceDocumentDetails: Record<string, ActionDocumentDetail>;
  insuranceProcessStatus: string;
  customerChargeAmount: string;
  customerChargeStatus: string;
  memo: string;
}

const RENTAL_ACCIDENT_EVIDENCE_SLOTS = [
  { key: 'accidentPhotos', label: '사고 사진' },
  { key: 'blackbox', label: '블랙박스' },
  { key: 'opponentInfo', label: '상대방 정보' },
  { key: 'insuranceReceipt', label: '보험 접수증' },
  { key: 'repairEstimate', label: '수리 견적서' },
] as const;
type RentalAccidentEvidenceSlotKey = typeof RENTAL_ACCIDENT_EVIDENCE_SLOTS[number]['key'];
type RentalAccidentEvidenceFiles = Partial<Record<RentalAccidentEvidenceSlotKey, File | null>>;

function buildFallbackDocumentDetail(objectName: string, fileName?: string): ActionDocumentDetail {
  return {
    objectName,
    fileName: fileName || objectName.split('/').pop() || objectName,
  };
}

type OperationalDomainActionTone = 'standard' | 'danger';
type OperationalDomainActionGroup = '확인 조치' | '위험 조치';
interface OperationalDomainActionConfig {
  action: string;
  label: string;
  group?: OperationalDomainActionGroup;
  tone?: OperationalDomainActionTone;
}

const OPERATIONAL_DOMAIN_ACTIONS: Record<string, OperationalDomainActionConfig[]> = {
  'vehicle.malfunction': [
    { action: 'maintenance_requested', label: '정비 접수' },
    { action: 'maintenance_completed', label: '정비 완료' },
    { action: 'diagnostic_resolved', label: '진단 해소 확인' },
  ],
  'vehicle.terminal_off': [
    { action: 'communication_confirmed', label: '재통신 확인' },
    { action: 'terminal_checked', label: '장착 상태 확인' },
    { action: 'terminal_replaced', label: '단말 교체' },
  ],
  'vehicle.theft_suspected': [
    { action: 'customer_contacted', label: '고객 연락', group: '확인 조치' },
    { action: 'false_alarm', label: '오탐 처리', group: '확인 조치' },
    { action: 'reported_to_authority', label: '신고 처리', group: '위험 조치', tone: 'danger' },
    { action: 'vehicle_recovered', label: '차량 회수', group: '위험 조치', tone: 'danger' },
  ],
};

interface AccidentReplacementDriverDraft {
  customerName: string;
  phone: string;
  licenseNumber: string;
  address: string;
  licenseDocumentObjectName: string;
}

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
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }
  return null;
}

function canonicalActionIssueCode(value: string | null | undefined): string | undefined {
  const code = (value ?? '').trim();
  if (!code) {
    return undefined;
  }
  const aliases: Record<string, string> = {
    'rental_accident.followup': 'rental_accident.intake_required',
    'rental_accident.reported': 'rental_accident.intake_required',
    'rental_accident.insurance_processing': 'rental_accident.insurance_result_required',
    'accident_claim.documents_required': 'accident_claim.submission_required',
    'accident_claim.claim_delayed': 'accident_claim.submission_required',
    'accident_claim.payment_check': 'accident_claim.settlement_required',
    'accident_claim.difference': 'accident_claim.settlement_required',
    'return.late': 'return.followup_required',
    'return.repair_done_not_returned': 'return.followup_required',
  };
  return aliases[code] ?? code;
}

function toPaymentAmountFromInput(value: string): number {
  const numeric = Number(String(value || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, numeric);
}

function normalizePaymentType(value: string | null): '카드' | '현금' | '계좌이체' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === '현금' || normalized === 'cash') {
    return '현금';
  }
  if (normalized === '계좌이체' || normalized === 'transfer' || normalized === 'bank_transfer') {
    return '계좌이체';
  }
  return '카드';
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function pickPartyDisplayName(source: Record<string, unknown>): string | null {
  const parties = isRecord(source.parties) ? source.parties : {};
  const candidates: Array<[string, string]> = [
    ['driver', 'name'],
    ['contractor', 'name'],
    ['requester', 'organizationName'],
    ['requester', 'name'],
  ];
  for (const [role, key] of candidates) {
    const party = parties[role];
    if (isRecord(party)) {
      const value = toStringValue(party[key]);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

// vehicleNumber 전용 추출: '?' 문자가 포함된 값(한글 깨짐)보다 정상 값을 우선 선택
function pickVehicleNumber(source: Record<string, unknown>): string | null {
  const keys = ['vehicleNumber', 'plateNumber', 'vehicleNo', 'plate'];
  // 첫 번째 패스: '?' 없는 정상 값 우선
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate && !candidate.includes('?')) {
      return candidate;
    }
  }
  // 폴백: '?' 포함 여부 관계없이 첫 번째 유효 값 반환
  return pickString(source, keys) ?? pickString(source, ['vin', 'assetId', 'vehicleId']);
}

function formatActionDate(rawValue: string): string {
  return formatDateTimeKst(rawValue, '-');
}

function formatActionDateOnly(rawValue: string): string {
  return formatDateKst(rawValue, '-');
}

function parseDateOnly(value: string | null | undefined): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') {
    return null;
  }
  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  const candidate = isoPrefix ? `${isoPrefix[1]}T00:00:00` : `${raw}T00:00:00`;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function differenceInCalendarDays(targetDate: Date, baseDate: Date): number {
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const baseMidnight = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  return Math.round((targetMidnight.getTime() - baseMidnight.getTime()) / 86_400_000);
}

function addCalendarDays(baseDate: Date, days: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
}

function buildInspectionExpiryDescription(daysLeft: number): string {
  if (daysLeft < 0) {
    return '정기점검 기한이 경과하였습니다.';
  }
  if (daysLeft === 0) {
    return '정기점검 기한이 오늘입니다.';
  }
  return `정기점검 기한 만료일이 임박했습니다.(D-${daysLeft})`;
}

function buildInspectionWindowExpiryDescription(daysLeft: number): string {
  if (daysLeft < 0) {
    return '수검 가능 기간 만료일이 경과하였습니다.';
  }
  if (daysLeft === 0) {
    return '수검 가능 기간 만료일이 오늘입니다.';
  }
  if (daysLeft >= 31) {
    return `수검 가능 기간이 ${daysLeft}일 남았습니다`;
  }
  return `수검 가능 기간 만료일이 임박했습니다.(D-${daysLeft})`;
}

function getIssueAssetDescription(item: ActionItem, issueAsset: IssueAssetRecord | null): string | null {
  const assetKind = getIssueAssetKind(item);
  if (!assetKind || !issueAsset) {
    return item.description ?? null;
  }
  if (item.statusCode === 'resolved' || item.status === '완료') {
    return '이슈가 해소되었습니다';
  }

  const targetDate = parseDateOnly(assetKind === 'insurance' ? issueAsset.insuranceExpiry : issueAsset.nextInspection);
  if (!targetDate) {
    return item.description ?? null;
  }

  const daysLeft = differenceInCalendarDays(targetDate, new Date());
  if (assetKind === 'insurance') {
    if (daysLeft < 0) {
      return '차량 보험이 만료되었습니다.';
    }
    if (daysLeft === 0) {
      return '차량 보험이 오늘 만료됩니다.';
    }
    return `차량 보험 만료일이 임박했습니다(D-${daysLeft})`;
  }

  const inspectionExpiryLine = buildInspectionExpiryDescription(daysLeft);
  const availablePeriodExpiryDate = addCalendarDays(targetDate, 31);
  const availablePeriodDaysLeft = differenceInCalendarDays(availablePeriodExpiryDate, new Date());
  const availablePeriodExpiryLine = buildInspectionWindowExpiryDescription(availablePeriodDaysLeft);
  return `${inspectionExpiryLine}\n${availablePeriodExpiryLine}`;
}

function isStrictlyLaterDate(nextValue: string, previousValue: string | null | undefined): boolean {
  const nextDate = parseDateOnly(nextValue);
  if (!nextDate) {
    return false;
  }
  const previousDate = parseDateOnly(previousValue);
  if (!previousDate) {
    return true;
  }
  return nextDate.getTime() > previousDate.getTime();
}

function getIssueAssetKind(item: Pick<ActionItem, 'type' | 'subCategory'> | null | undefined): IssueAssetKind | null {
  if (!item) {
    return null;
  }
  if (item.type === '보험 만료 임박' || item.subCategory === '보험 만료 임박') {
    return 'insurance';
  }
  if (item.type === '정기점검' || item.subCategory === '정기점검 만료 임박') {
    return 'inspection';
  }
  return null;
}

function isIssueAssetType(item: Pick<ActionItem, 'type' | 'subCategory'> | null | undefined): boolean {
  return getIssueAssetKind(item) !== null;
}

function getInsuranceIssueResolveBlockMessage(issueAsset: IssueAssetRecord | null): string | null {
  const insuranceDue = parseDateOnly(issueAsset?.insuranceExpiry);
  if (!insuranceDue) {
    return '보험 만료 임박 이슈가 해소되지 않았습니다.(D-0)일';
  }

  const daysLeft = differenceInCalendarDays(insuranceDue, new Date());
  if (daysLeft >= 31) {
    return null;
  }

  return `보험 만료 임박 이슈가 해소되지 않았습니다.(D-${Math.max(daysLeft, 0)})일`;
}

function isInsuranceIssueResolved(insuranceExpiry: string | null | undefined): boolean {
  const insuranceDue = parseDateOnly(insuranceExpiry);
  if (!insuranceDue) {
    return false;
  }

  return differenceInCalendarDays(insuranceDue, new Date()) >= 31;
}

function getInspectionIssueResolveBlockMessage(issueAsset: IssueAssetRecord | null): string | null {
  const inspectionDue = parseDateOnly(issueAsset?.nextInspection);
  if (!inspectionDue) {
    return '정기점검 만료 임박 이슈가 해소되지 않았습니다.(D-0)일';
  }

  const daysLeft = differenceInCalendarDays(inspectionDue, new Date());
  if (daysLeft >= 31) {
    return null;
  }

  return `정기점검 만료 임박 이슈가 해소되지 않았습니다.(D-${Math.max(daysLeft, 0)})일`;
}

function isInspectionIssueResolved(nextInspection: string | null | undefined): boolean {
  const inspectionDue = parseDateOnly(nextInspection);
  if (!inspectionDue) {
    return false;
  }

  return differenceInCalendarDays(inspectionDue, new Date()) >= 31;
}

function getIssueResolveBlockMessage(item: ActionItem, issueAsset: IssueAssetRecord | null): string | null {
  const assetKind = getIssueAssetKind(item);
  if (assetKind === 'insurance') {
    return getInsuranceIssueResolveBlockMessage(issueAsset);
  }
  if (assetKind === 'inspection') {
    return getInspectionIssueResolveBlockMessage(issueAsset);
  }
  return null;
}

function resolveActionRequiredDocumentContentType(file: File): string {
  const contentType = file.type.trim();
  if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
    return contentType;
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 'PDF 또는 이미지 파일만 업로드할 수 있습니다.');
}

function isPaymentActionItem(item: ActionItem | null | undefined): item is ActionItem {
  if (!item?.paymentInfo) {
    return false;
  }
  return item.type === '정산/수납'
    || item.resolutionPolicy === 'requires_payment_settled'
    || String(item.issueCode ?? '').startsWith('payment.');
}

function isLateReturnActionItem(item: ActionItem | null | undefined): item is ActionItem {
  return Boolean(
    item
      && (
        item.issueCode === 'return.late'
        || item.issueCode === 'return.repair_done_not_returned'
        || item.issueCode === 'return.followup_required'
        || item.reasonType === 'late_return'
        || item.reasonType === 'return_followup_required'
        || item.reasonType === 'accident_replacement_repair_done_not_returned'
        || (item.type === '반납/회수' && item.subCategory === '반납 지연')
        || (item.type === '반납/회수' && item.subCategory === '수리완료 후 미반납')
        || (item.type === '반납/회수' && item.subCategory === '차량 반납/회수 확인')
      ),
  );
}

function isRepairDoneNotReturnedActionItem(item: ActionItem | null | undefined): item is ActionItem {
  return Boolean(
    item
      && (
        item.issueCode === 'return.repair_done_not_returned'
        || (item.issueCode === 'return.followup_required' && item.returnFollowupKind === 'repair_done_not_returned')
        || item.reasonType === 'accident_replacement_repair_done_not_returned'
        || (item.reasonType === 'return_followup_required' && item.returnFollowupKind === 'repair_done_not_returned')
        || (item.type === '반납/회수' && item.subCategory === '수리완료 후 미반납')
      ),
  );
}

function isReturnFollowupActionItem(item: ActionItem | null | undefined): item is ActionItem {
  return isLateReturnActionItem(item);
}

function getRepairDoneNotReturnedSummary(item: ActionItem) {
  const accidentClaimSource = isRecord(item.workContext?.sourceSnapshot?.accidentClaim)
    ? item.workContext.sourceSnapshot.accidentClaim
    : {};
  const reservationSource = isRecord(item.workContext?.sourceSnapshot?.reservation)
    ? item.workContext.sourceSnapshot.reservation
    : {};
  const repairCompletedAt = pickString(accidentClaimSource, ['repairCompletedAt', 'readyToClaimAt', 'returnedAt'])
    ?? item.date;
  const repairShopName = pickString(accidentClaimSource, ['repairShopName'])
    ?? pickString(reservationSource, ['repairShopName'])
    ?? '-';
  const returnStatus = pickString(reservationSource, ['contractStatus', 'status'])
    ?? (item.statusCode === 'resolved' ? '반납 완료' : '미반납');

  return {
    repairCompletedAt,
    repairShopName,
    returnStatus,
  };
}

function getOperationalDomainActionButtonClassName(tone: OperationalDomainActionTone | undefined): string {
  if (tone === 'danger') {
    return 'rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60';
  }
  return 'rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
}

function groupOperationalDomainActions(actions: OperationalDomainActionConfig[]): [OperationalDomainActionGroup, OperationalDomainActionConfig[]][] {
  const groups: [OperationalDomainActionGroup, OperationalDomainActionConfig[]][] = [
    ['확인 조치', []],
    ['위험 조치', []],
  ];
  const fallbackActions: OperationalDomainActionConfig[] = [];

  actions.forEach((action) => {
    if (action.group === '확인 조치') {
      groups[0][1].push(action);
    } else if (action.group === '위험 조치') {
      groups[1][1].push(action);
    } else {
      fallbackActions.push(action);
    }
  });

  if (fallbackActions.length > 0) {
    return [['확인 조치', fallbackActions]];
  }
  return groups.filter(([, groupActions]) => groupActions.length > 0);
}

type RentalAccidentIssueMode = 'intake' | 'evidence' | 'insurance';

function isRentalAccidentActionItem(item: ActionItem | null | undefined): item is ActionItem {
  return Boolean(
    item
      && (
        item.type === '대여 중 사고'
        || String(item.issueCode ?? '').startsWith('rental_accident.')
      ),
  );
}

function getRentalAccidentIssueMode(item: ActionItem | null | undefined): RentalAccidentIssueMode {
  if (
    item?.issueCode === 'rental_accident.intake_required'
    || item?.issueCode === 'rental_accident.followup'
    || item?.issueCode === 'rental_accident.reported'
    || item?.reasonType === 'rental_accident_intake_required'
    || item?.reasonType === 'rental_accident_reported'
    || item?.reasonType === 'rental_accident_followup'
  ) {
    return 'intake';
  }
  switch (item?.issueCode) {
    case 'rental_accident.evidence_required':
      return 'evidence';
    case 'rental_accident.insurance_result_required':
    case 'rental_accident.insurance_processing':
      return 'insurance';
    default:
      if (item?.reasonType === 'rental_accident_evidence_required') {
        return 'evidence';
      }
      if (item?.reasonType === 'rental_accident_insurance_result_required' || item?.reasonType === 'rental_accident_insurance_processing') {
        return 'insurance';
      }
      return 'intake';
  }
}

function getRentalAccidentPanelTitle(mode: RentalAccidentIssueMode): string {
  switch (mode) {
    case 'evidence':
      return '사고자료 준비 필요';
    case 'insurance':
      return '보험처리 결과 확인 필요';
    case 'intake':
    default:
      return '사고 접수 정보 입력 필요';
  }
}

function getRentalAccidentSummaryText(mode: RentalAccidentIssueMode): string {
  switch (mode) {
    case 'evidence':
      return '사고 사진, 블랙박스, 상대방 정보, 보험 접수증, 수리 견적서를 확보하거나 자료 생략으로 정리하세요.';
    case 'insurance':
      return '보험처리 결과를 처리완료 또는 고객부담 전환으로 정리하세요.';
    case 'intake':
    default:
      return '사고 장소, 상대방 정보, 보험접수번호를 보완하세요.';
  }
}

function isRentalAccidentIntakeComplete(draft: RentalAccidentDraft): boolean {
  return Boolean(
    draft.accidentLocation.trim()
    && draft.opponentInfo.trim()
    && draft.insuranceClaimNo.trim(),
  );
}

function isRentalAccidentEvidenceComplete(draft: RentalAccidentDraft): boolean {
  return draft.evidenceStatus === 'ready' || draft.evidenceStatus === 'completed' || draft.evidenceStatus === 'waived';
}

function isRentalAccidentInsuranceResultComplete(draft: RentalAccidentDraft): boolean {
  if (draft.insuranceProcessStatus === 'completed') {
    return true;
  }
  if (draft.insuranceProcessStatus !== 'customer_charge') {
    return false;
  }
  const amount = toPaymentAmountFromInput(draft.customerChargeAmount);
  return amount > 0 && ['pending', 'due', 'overdue', 'paid', 'waived'].includes(draft.customerChargeStatus);
}

function isRentalAccidentIssueCompleteForMode(mode: RentalAccidentIssueMode, draft: RentalAccidentDraft): boolean {
  if (mode === 'intake') {
    return isRentalAccidentIntakeComplete(draft);
  }
  if (mode === 'evidence') {
    return isRentalAccidentEvidenceComplete(draft);
  }
  return isRentalAccidentInsuranceResultComplete(draft);
}

function getRentalAccidentSaveButtonLabel(mode: RentalAccidentIssueMode): string {
  if (mode === 'intake') {
    return '사고 접수 정보 저장';
  }
  if (mode === 'evidence') {
    return '사고자료 정보 저장';
  }
  return '보험처리 결과 저장';
}

type AccidentClaimIssueMode = 'intake' | 'submission' | 'settlement' | 'payment' | 'difference' | 'other';

function getAccidentClaimIssueMode(item: ActionItem | null | undefined): AccidentClaimIssueMode {
  if (item?.issueCode === 'accident_claim.submission_required' || item?.reasonType === 'accident_claim_submission_required') {
    return 'submission';
  }
  if (item?.issueCode === 'accident_claim.settlement_required' || item?.reasonType === 'accident_claim_settlement_required') {
    return 'settlement';
  }
  switch (item?.reasonType) {
    case 'accident_replacement_info_missing':
      return 'intake';
    case 'accident_claim_documents_required':
    case 'accident_claim_delayed':
      return 'submission';
    case 'accident_claim_payment_check':
      return 'payment';
    case 'accident_claim_difference':
      return 'difference';
    default:
      return 'other';
  }
}

function isCompactAccidentClaimActionItem(item: ActionItem | null | undefined): item is ActionItem {
  return getAccidentClaimIssueMode(item) !== 'other';
}

function getAccidentClaimSummaryText(mode: AccidentClaimIssueMode): string {
  switch (mode) {
    case 'intake':
      return '사고접수번호, 보험사, 정비소를 먼저 입력합니다.';
    case 'submission':
      return '청구 서류와 진행 상태를 확인하고 보험청구 제출을 진행합니다.';
    case 'settlement':
      return '보험금 입금 상태와 대차료 차액 정산 상태를 확인하세요.';
    case 'payment':
      return '보험 인정금액을 확인한 뒤 입금 확인을 처리합니다.';
    case 'difference':
      return '청구액과 인정금액의 차액 부담 주체를 정리합니다.';
    default:
      return '보험청구 단계에 필요한 정보를 확인합니다.';
  }
}

function getAccidentClaimDifferenceAmount(draft: AccidentClaimDraft): number {
  const billedAmount = toPaymentAmountFromInput(draft.billedAmount);
  const recognizedAmount = toPaymentAmountFromInput(draft.recognizedAmount);
  return Math.max(billedAmount - recognizedAmount, 0);
}

function normalizeSettlementPaymentCheckStatus(item: ActionItem): SettlementPaymentCheckStatus {
  const status = item.settlementPaymentCheckStatus;
  if (status === 'required' || status === 'completed' || status === 'waiting' || status === 'not_applicable') {
    return status;
  }
  return item.settlementNeedsPaymentCheck ? 'required' : 'not_applicable';
}

function normalizeSettlementDifferenceStatus(item: ActionItem): SettlementDifferenceStatus {
  const status = item.settlementDifferenceStatus;
  if (status === 'required' || status === 'settled' || status === 'not_applicable') {
    return status;
  }
  return item.settlementNeedsDifference ? 'required' : 'not_applicable';
}

function getSettlementPaymentCheckLabel(status: SettlementPaymentCheckStatus): string {
  switch (status) {
    case 'required':
      return '필요';
    case 'completed':
      return '완료';
    case 'waiting':
      return '대기';
    case 'not_applicable':
      return '대상 아님';
    default:
      return '확인';
  }
}

function getSettlementDifferenceLabel(status: SettlementDifferenceStatus): string {
  switch (status) {
    case 'required':
      return '필요';
    case 'settled':
      return '정리됨';
    case 'not_applicable':
      return '차액 없음';
    default:
      return '확인';
  }
}

function getSettlementStatusClassName(status: SettlementPaymentCheckStatus | SettlementDifferenceStatus): string {
  switch (status) {
    case 'required':
      return 'bg-orange-100 text-orange-700';
    case 'completed':
    case 'settled':
      return 'bg-emerald-100 text-emerald-700';
    case 'waiting':
      return 'bg-amber-100 text-amber-700';
    case 'not_applicable':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getSettlementPaymentCheckMessage(item: ActionItem, status: SettlementPaymentCheckStatus): string {
  if (item.settlementPaymentCheckMessage) {
    return item.settlementPaymentCheckMessage;
  }
  switch (status) {
    case 'required':
      return '보험사 청구 항목의 입금 확인이 필요합니다.';
    case 'completed':
      return '보험사 청구 항목의 미수 잔액이 없어 추가 조치가 필요하지 않습니다.';
    case 'waiting':
      return '보험청구가 진행 중 상태가 되면 입금 확인을 진행합니다.';
    case 'not_applicable':
      return '현재 보험금 입금 확인 조치가 필요하지 않습니다.';
    default:
      return '보험금 입금 확인 상태를 확인합니다.';
  }
}

function getSettlementDifferenceMessage(item: ActionItem, status: SettlementDifferenceStatus): string {
  if (item.settlementDifferenceMessage) {
    return item.settlementDifferenceMessage;
  }
  switch (status) {
    case 'required':
      return '보험 인정금액과 청구액의 차액 처리 방향을 정해야 합니다.';
    case 'settled':
      return '대차료 차액 항목이 이미 정리되었습니다.';
    case 'not_applicable':
      return '청구액과 보험 인정금액 사이에 정리할 차액이 없습니다.';
    default:
      return '대차료 차액 정산 상태를 확인합니다.';
  }
}

function getActionItemCapabilities(item: ActionItem | null, canWritePayments: boolean, canWriteActionRequired: boolean) {
  const isPaymentIssue = isPaymentActionItem(item);
  const isResolved = item?.statusCode === 'resolved';
  const actions = new Set(item?.availableActions ?? []);
  const hasActions = actions.size > 0;
  const hasLedgerChargeContext = Boolean(item?.relatedChargeItemId) || toWorkChargeItems(item?.workContext).length > 0;
  return {
    canEditPaymentFields: Boolean(isPaymentIssue && canWritePayments && !isResolved),
    canEditStandalonePaymentType: Boolean(isPaymentIssue && canWritePayments && !isResolved && !hasLedgerChargeContext),
    canUseLateReturnFlow: isLateReturnActionItem(item),
    canEditIssueAsset: Boolean(item && getIssueAssetKind(item) && canWriteActionRequired && (!hasActions || actions.has('asset_update'))),
    canUseAccidentClaimActions: Boolean(item?.type === '대차/보험청구' && item?.reservationId && canWriteActionRequired && (!hasActions || actions.has('accident_claim_update') || actions.has('accident_claim_submit') || actions.has('accident_claim_recognize'))),
    canUseAccidentReplacementDriverActions: Boolean(item?.type === '대차/보험청구' && item?.reservationId && canWriteActionRequired && (
      item.reasonType === 'accident_replacement_driver_license_required'
      || item.reasonType === 'accident_replacement_driver_required'
      || item.reasonType === 'accident_replacement_license_required'
    )),
    canUseRentalAccidentActions: Boolean(item?.reservationId && canWriteActionRequired && (item.type === '대여 중 사고' || String(item.issueCode ?? '').startsWith('rental_accident.')) && (!hasActions || actions.has('accident_followup_update'))),
    canUseOperationalDomainActions: Boolean(item?.issueCode && OPERATIONAL_DOMAIN_ACTIONS[item.issueCode] && canWriteActionRequired),
  };
}

function getAccidentClaimPanelTitle(item: ActionItem, isDriverLicenseCard: boolean): string {
  if (isDriverLicenseCard) {
    return '운전자/면허 정보';
  }
  if (item.issueCode === 'accident_claim.submission_required' || item.reasonType === 'accident_claim_submission_required') {
    return '보험청구 제출/보완';
  }
  if (item.issueCode === 'accident_claim.settlement_required' || item.reasonType === 'accident_claim_settlement_required') {
    return '보험금 정산 확인';
  }
  switch (item.reasonType) {
    case 'accident_replacement_approval_required':
      return '대차 승인 정보';
    case 'accident_replacement_info_missing':
      return '사고 기본 정보';
    case 'accident_claim_documents_required':
      return '보험청구 제출/보완';
    case 'accident_claim_payment_check':
      return '보험금 정산 확인';
    case 'accident_claim_difference':
      return '보험금 정산 확인';
    case 'accident_claim_delayed':
      return '보험청구 제출/보완';
    default:
      return '청구 진행 정보';
  }
}

function getPrimarySettlementCharge(item: ActionItem): ActionItemWorkChargeItem | null {
  const chargeItems = toWorkChargeItems(item.workContext);
  if (item.workContext?.module === 'payment_deposit_refund') {
    return chargeItems.find((charge) => isRefundChargeItem(charge) && !isWorkChargeSettled(charge))
      ?? chargeItems.find((charge) => isRefundChargeItem(charge))
      ?? chargeItems.find((charge) => !isWorkChargeSettled(charge))
      ?? chargeItems[0]
      ?? null;
  }
  return chargeItems.find((charge) => !isWorkChargeSettled(charge)) ?? chargeItems[0] ?? null;
}

function getSettlementStatusLabel(status: string | undefined): string | null {
  if (!status) {
    return null;
  }
  const labels: Record<string, string> = {
    pending: '처리 대기',
    due: '처리 필요',
    overdue: '연체',
    paid: '수납 완료',
    waived: '면제',
    refunded: '환불 완료',
    refund_due: '환불 필요',
    disputed: '분쟁/보류',
  };
  return labels[status] ?? status;
}

function getSettlementChargeLabel(item: ActionItem): string {
  const charge = getPrimarySettlementCharge(item);
  if (charge?.description) {
    return charge.description;
  }
  switch (item.issueCode) {
    case 'payment.long_term_monthly_due':
    case 'payment.long_term_monthly_overdue':
      return '월 렌트료';
    case 'payment.accident_customer_deductible_due':
      return '고객부담금';
    case 'payment.deposit_refund_due':
      return '보증금';
    case 'payment.additional_fee_unpaid':
      return '추가요금';
    default:
      return charge?.chargeType || '정산 항목';
  }
}

function getSettlementAmount(item: ActionItem): number {
  const charge = getPrimarySettlementCharge(item);
  const fromCharge = Math.max(charge?.remainingAmount || charge?.amount || 0, 0);
  if (fromCharge > 0) {
    return fromCharge;
  }
  return Math.max(item.paymentInfo?.totalAmount || item.paymentInfo?.amount || item.paymentInfo?.principalAmount || 0, 0);
}

function getSettlementSummaryText(item: ActionItem): string {
  const label = getSettlementChargeLabel(item);
  const amount = getSettlementAmount(item).toLocaleString();
  switch (item.issueCode) {
    case 'payment.deposit_refund_due':
      return `반환할 ${label} ${amount}원이 남아 있습니다.`;
    case 'payment.long_term_monthly_due':
      return `${label} ${amount}원이 납부 예정입니다.`;
    case 'payment.long_term_monthly_overdue':
      return `${label} ${amount}원이 ${item.paymentInfo?.overdueDays ?? 0}일 연체되었습니다.`;
    case 'payment.accident_customer_deductible_due':
      return `${label} ${amount}원을 정리해야 합니다.`;
    case 'payment.additional_fee_unpaid':
      return `${label} ${amount}원이 미수 상태입니다.`;
    default:
      return `${label} ${amount}원이 미정리 상태입니다.`;
  }
}

function getSettlementMeta(item: ActionItem): string {
  const charge = getPrimarySettlementCharge(item);
  const statusLabel = item.paymentInfo?.statusLabel ?? getSettlementStatusLabel(charge?.status);
  const parts = [
    charge?.dueDate ? `기한 ${charge.dueDate}` : null,
    item.paymentInfo?.overdueDays ? `연체 ${item.paymentInfo.overdueDays}일` : null,
    statusLabel ? `상태 ${statusLabel}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function toIssueAssetRecord(row: unknown): IssueAssetRecord | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = pickString(row, ['id', 'vin']);
  const vehicleNumber = pickVehicleNumber(row);
  const version = toNumberValue(row.version);
  if (!id || !vehicleNumber || version === null) {
    return null;
  }
  return {
    id,
    version,
    vehicleNumber,
    insuranceExpiry: toDateInputValue(pickString(row, ['insuranceExpiry', 'insuranceExpiryDate'])),
    nextInspection: toDateInputValue(pickString(row, ['nextInspection', 'nextInspectionDate', 'inspectionDate', 'regularInspectionDate'])),
  };
}

function unwrapApiData(payload: unknown): unknown {
  if (isRecord(payload) && payload.status === 'success' && 'data' in payload) {
    return payload.data;
  }
  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data;
  }
  return payload;
}

function unwrapDetailRecord(payload: unknown): Record<string, unknown> {
  const source = unwrapApiData(payload);
  if (isRecord(source) && isRecord(source.item)) {
    return source.item;
  }
  if (isRecord(source) && isRecord(source.reservation)) {
    return source.reservation;
  }
  if (isRecord(source) && isRecord(source.asset)) {
    return source.asset;
  }
  return isRecord(source) ? source : {};
}

function formatCurrencyValue(value: unknown): string {
  const amount = toNumberValue(value) ?? 0;
  return `${Math.trunc(amount).toLocaleString()}원`;
}

function formatRelatedDate(value: unknown): string {
  const text = toStringValue(value);
  return text ? formatActionDate(text) : '-';
}

function getRelatedStatusLabel(value: unknown): string {
  const status = toStringValue(value);
  switch (status) {
    case 'paid':
      return '수납 완료';
    case 'waived':
      return '면제';
    case 'refunded':
      return '환불 완료';
    case 'refund_due':
      return '환불 필요';
    case 'overdue':
      return '연체';
    case 'partial':
      return '일부 정리';
    case 'pending':
      return '처리 대기';
    case 'submitted':
      return '청구 제출';
    case 'reported':
      return '접수됨';
    case 'reviewing':
      return '심사 중';
    case 'ready':
      return '자료 확보';
    case 'completed':
      return '완료';
    case 'customer_charge':
      return '고객부담 전환';
    case 'claim_preparing':
      return '청구 준비 중';
    case 'ready_to_claim':
      return '제출 가능';
    case 'recognized':
      return '보험금 인정';
    case 'partial_recognized':
      return '일부 인정';
    case 'intake':
      return '접수 단계';
    case 'intake_required':
      return '접수 정보 필요';
    case 'claiming':
      return '청구 진행';
    case 'closed':
      return '종결';
    case 'done':
    case 'returned':
      return '반납 완료';
    case 'not_returned':
      return '미반납';
    case 'approved':
      return '승인';
    case 'rejected':
      return '반려';
    default:
      return status ?? '-';
  }
}

function getAccidentClaimSubmissionNotice(item: ActionItem): string {
  const delayLabel = item.submissionDelayed
    ? `청구 제출 지연 ${item.delayBusinessDays ? `${item.delayBusinessDays}영업일` : '상태'}`
    : '보험청구 제출 준비';
  return `${delayLabel} · 청구 서류 확인 후 보험사에 청구를 제출하거나 보완 필요 항목을 메모하세요.`;
}

function getAccidentClaimDocumentSummary(draft: AccidentClaimDraft, selectedFile: File | null): string {
  if (selectedFile) {
    return `선택된 파일: ${selectedFile.name}`;
  }
  const savedCount = draft.documentDetails.length;
  if (savedCount > 0) {
    return `저장된 청구 서류 ${savedCount}건`;
  }
  return '선택된 파일 없음';
}

function getRelatedChargeTypeLabel(value: unknown): string {
  const chargeType = toStringValue(value);
  switch (chargeType) {
    case 'additional_fee':
      return '추가요금';
    case 'late_fee':
      return '지연료';
    case 'monthly_fee':
      return '월 렌트료';
    case 'deductible':
      return '고객부담금';
    case 'difference':
      return '대차료 차액';
    case 'refund':
      return '환불';
    case 'rental_fee':
      return '대여료';
    default:
      return chargeType ?? '청구 항목';
  }
}

function RelatedInfoRow({ label, value }: { label: string; value: unknown }) {
  const formatted = typeof value === 'number'
    ? value.toLocaleString()
    : toStringValue(value) ?? '-';
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">{formatted}</p>
    </div>
  );
}

function RelatedContextDrawer({
  kind,
  payload,
  isLoading,
  error,
  onClose,
}: {
  kind: RelatedContextPanelKind;
  payload: unknown;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [detailTab, setDetailTab] = useState<'reservation' | 'payment' | 'vehicle' | 'info' | 'history' | 'sensor'>(
    kind === 'asset' ? 'info' : 'reservation',
  );
  const title = {
    reservation: '예약 상세',
    asset: '차량 상세',
    billing: '청구 원장',
    claim: '보험청구 상세',
  }[kind];
  const row = unwrapDetailRecord(payload);
  const billingChargeItems = isRecord(payload) && Array.isArray(payload.chargeItems)
    ? payload.chargeItems.filter((item): item is ActionItemWorkChargeItem => isRecord(item))
    : [];
  const billingPaymentInfo = isRecord(payload) && isRecord(payload.paymentInfo) ? payload.paymentInfo : {};
  const reservationBillingSummary = isRecord(row.billingSummary) ? row.billingSummary : {};
  const reservationChargeItems = Array.isArray(row.chargeItemsPreview)
    ? row.chargeItemsPreview.filter(isRecord)
    : Array.isArray(reservationBillingSummary.chargeItems)
      ? reservationBillingSummary.chargeItems.filter(isRecord)
      : [];
  const reservationPaymentRecords = Array.isArray(reservationBillingSummary.paymentRecords)
    ? reservationBillingSummary.paymentRecords.filter(isRecord)
    : [];
  const reservationAccidentClaim = isRecord(row.accidentClaim) ? row.accidentClaim : null;
  const { handleBackdropMouseDown } = useModalDismiss({
    isOpen: true,
    onDismiss: onClose,
  });

  if (kind === 'reservation' || kind === 'asset') {
    const modalTitle = kind === 'reservation' ? '예약 상세 정보' : '차량 상세 정보';
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onMouseDown={handleBackdropMouseDown}>
        <div className="flex max-h-[85vh] w-[900px] max-w-[92vw] flex-col rounded-xl bg-white shadow-2xl">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#1e2939]">{modalTitle}</h3>
              <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label={`${modalTitle} 닫기`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {kind === 'reservation' ? (
              <div className="mt-4 flex gap-1 border-b border-gray-200">
                {[
                  { key: 'reservation', label: '예약 정보', icon: Calendar },
                  { key: 'payment', label: '결제 정보', icon: DollarSign },
                  { key: 'vehicle', label: '차량 정보', icon: Car },
                ].map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setDetailTab(entry.key as typeof detailTab)}
                      className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                        detailTab === entry.key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="mr-2 inline h-4 w-4" />
                      {entry.label}
                      {detailTab === entry.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex gap-1 border-b border-gray-200">
                {[
                  { key: 'info', label: '기본 정보', icon: Info },
                  { key: 'history', label: '예약 히스토리', icon: Clock },
                  { key: 'sensor', label: '차량 이상 히스토리', icon: Activity },
                ].map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setDetailTab(entry.key as typeof detailTab)}
                      className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                        detailTab === entry.key ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {entry.label}
                      {detailTab === entry.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                상세 데이터를 불러오는 중입니다.
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!isLoading && !error && kind === 'reservation' && detailTab === 'reservation' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <RelatedInfoRow label="예약번호" value={pickString(row, ['id', 'reservationId', 'rentalId'])} />
                  <RelatedInfoRow label="고객명" value={pickString(row, ['customerName', 'customer', 'name'])} />
                  <RelatedInfoRow label="연락처" value={pickString(row, ['phone', 'customerPhone'])} />
                  <RelatedInfoRow label="예약 유형" value={getRelatedStatusLabel(row.contractStatus ?? row.status ?? row.type)} />
                  <RelatedInfoRow label="업무 상태" value={pickString(row, ['workflowStatusLabel', 'workflowStatus'])} />
                  <RelatedInfoRow label="정산 상태" value={pickString(row, ['closeoutStatusLabel', 'closeoutStatus'])} />
                  <RelatedInfoRow label="차량번호" value={pickString(row, ['vehicleNumber', 'plate'])} />
                  <RelatedInfoRow label="대여 유형" value={pickString(row, ['rentalType'])} />
                  <RelatedInfoRow label="대여 시작일" value={formatRelatedDate(row.startAt ?? row.startDateFull ?? row.startDate ?? row.rentalStartAt)} />
                  <RelatedInfoRow label="대여 종료일" value={formatRelatedDate(row.endAt ?? row.endDateFull ?? row.endDate ?? row.rentalEndAt)} />
                </div>
                {Array.isArray(row.issues) && row.issues.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-gray-500">이슈</p>
                    <div className="flex flex-wrap gap-2">
                      {row.issues.map((issue, index) => (
                        <span key={`${String(issue)}-${index}`} className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                          {toStringValue(issue) ?? '-'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !error && kind === 'reservation' && detailTab === 'payment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <RelatedInfoRow label="대여 요금" value={formatCurrencyValue(row.amount)} />
                  <RelatedInfoRow label="선금" value={formatCurrencyValue(row.deposit)} />
                  <RelatedInfoRow label="결제 상태" value={getRelatedStatusLabel(row.paymentSummaryStatus ?? reservationBillingSummary.paymentSummaryStatus)} />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">청구/수납 요약</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <RelatedInfoRow label="총 청구" value={formatCurrencyValue(reservationBillingSummary.totalAmount)} />
                    <RelatedInfoRow label="수납 완료" value={formatCurrencyValue(reservationBillingSummary.paidAmount)} />
                    <RelatedInfoRow label="잔액" value={formatCurrencyValue(reservationBillingSummary.remainingAmount)} />
                    <RelatedInfoRow label="확인 필요" value={reservationBillingSummary.confirmationNeededCount ?? 0} />
                  </div>
                </div>
                {reservationChargeItems.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <div className="min-w-[680px]">
                      <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_0.9fr] bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                        <span>항목</span>
                        <span>청구처</span>
                        <span className="text-right">청구액</span>
                        <span className="text-right">잔액</span>
                        <span className="text-right">상태</span>
                      </div>
                      {reservationChargeItems.map((item, index) => (
                        <div key={pickString(item, ['id']) ?? index} className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_0.9fr] border-t border-gray-100 px-3 py-2 text-sm text-gray-800">
                          <span className="truncate font-medium">{getRelatedChargeTypeLabel(item.chargeType)}</span>
                          <span className="truncate text-gray-600">{pickString(item, ['payerType']) ?? '-'}</span>
                          <span className="text-right font-semibold">{formatCurrencyValue(item.amount)}</span>
                          <span className="text-right font-semibold text-red-600">{formatCurrencyValue(item.remainingAmount)}</span>
                          <span className="text-right text-gray-600">{getRelatedStatusLabel(item.status)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reservationPaymentRecords.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    수납 이력 {reservationPaymentRecords.length}건이 연결되어 있습니다.
                  </div>
                )}
                {reservationAccidentClaim && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <p className="text-xs font-semibold text-indigo-700">청구 요약</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <RelatedInfoRow label="접수번호" value={pickString(reservationAccidentClaim, ['claimNo'])} />
                      <RelatedInfoRow label="보험사" value={pickString(reservationAccidentClaim, ['insurerName'])} />
                      <RelatedInfoRow label="청구액" value={formatCurrencyValue(reservationAccidentClaim.billedAmount)} />
                      <RelatedInfoRow label="차액" value={formatCurrencyValue(reservationAccidentClaim.differenceAmount)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !error && kind === 'reservation' && detailTab === 'vehicle' && (
              <div className="grid grid-cols-2 gap-4">
                <RelatedInfoRow label="차량번호" value={pickString(row, ['vehicleNumber', 'plate'])} />
                <RelatedInfoRow label="차대번호" value={pickString(row, ['vin'])} />
                <RelatedInfoRow label="대여 시작일" value={formatRelatedDate(row.startAt ?? row.startDateFull ?? row.startDate)} />
                <RelatedInfoRow label="대여 종료일" value={formatRelatedDate(row.endAt ?? row.endDateFull ?? row.endDate)} />
              </div>
            )}

            {!isLoading && !error && kind === 'asset' && detailTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <RelatedInfoRow label="차량번호" value={pickString(row, ['vehicleNumber', 'plate'])} />
                  <RelatedInfoRow label="차종" value={pickString(row, ['model'])} />
                  <RelatedInfoRow label="연식" value={pickString(row, ['year'])} />
                  <RelatedInfoRow label="차대번호" value={pickString(row, ['vin'])} />
                  <RelatedInfoRow label="현재 상태" value={pickString(row, ['status', 'contractStatus'])} />
                  <RelatedInfoRow label="소유주" value={pickString(row, ['owner'])} />
                  <RelatedInfoRow label="보험만료일" value={pickString(row, ['insuranceExpiry', 'insuranceExpiryDate'])} />
                  <RelatedInfoRow label="다음 정기점검일" value={pickString(row, ['nextInspection', 'nextInspectionDate'])} />
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  문서 수정과 저장 기능은 차량 자산 상세 페이지와 동일한 controller 공통화 후 활성화됩니다.
                </div>
              </div>
            )}

            {!isLoading && !error && kind === 'asset' && detailTab === 'history' && (
              <div className="py-12 text-center text-gray-400">
                <Clock className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">이 차량의 활동 이력은 차량 자산 상세 controller 공통화 후 표시됩니다.</p>
              </div>
            )}

            {!isLoading && !error && kind === 'asset' && detailTab === 'sensor' && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
                <p className="font-bold text-purple-800">차량 이상 히스토리</p>
                <p className="mt-2 text-sm text-purple-700">단말/센서 상세 이력은 차량 자산 상세 controller 공통화 후 표시됩니다.</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-6">
            <button type="button" onClick={onClose} className="w-full rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200">
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30" onMouseDown={handleBackdropMouseDown}>
      <div className="h-full w-[460px] max-w-[92vw] overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h3 className="text-lg font-bold text-[#1e2939]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label={`${title} 닫기`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              상세 정보를 불러오는 중입니다.
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!isLoading && !error && kind === 'reservation' && (
            <div className="grid grid-cols-2 gap-4">
              <RelatedInfoRow label="고객명" value={pickString(row, ['customerName', 'customer', 'name'])} />
              <RelatedInfoRow label="차량번호" value={pickString(row, ['vehicleNumber', 'plate'])} />
              <RelatedInfoRow label="대여 시작" value={formatRelatedDate(row.startAt ?? row.startDate ?? row.rentalStartAt)} />
              <RelatedInfoRow label="대여 종료" value={formatRelatedDate(row.endAt ?? row.endDate ?? row.rentalEndAt)} />
              <RelatedInfoRow label="예약 상태" value={pickString(row, ['status', 'contractStatus', 'type'])} />
              <RelatedInfoRow label="업무 상태" value={pickString(row, ['workflowStatusLabel', 'workflowStatus'])} />
              <RelatedInfoRow label="정산 상태" value={pickString(row, ['closeoutStatusLabel', 'closeoutStatus'])} />
              <RelatedInfoRow label="대여 유형" value={pickString(row, ['rentalType'])} />
            </div>
          )}
          {!isLoading && !error && kind === 'asset' && (
            <div className="grid grid-cols-2 gap-4">
              <RelatedInfoRow label="차량번호" value={pickString(row, ['vehicleNumber', 'plate'])} />
              <RelatedInfoRow label="모델" value={pickString(row, ['model'])} />
              <RelatedInfoRow label="차고지" value={pickString(row, ['garage', 'location'])} />
              <RelatedInfoRow label="상태" value={pickString(row, ['status', 'contractStatus'])} />
              <RelatedInfoRow label="보험 만료일" value={pickString(row, ['insuranceExpiry', 'insuranceExpiryDate'])} />
              <RelatedInfoRow label="다음 점검일" value={pickString(row, ['nextInspection', 'nextInspectionDate'])} />
              <RelatedInfoRow label="차대번호" value={pickString(row, ['vin'])} />
              <RelatedInfoRow label="단말 상태" value={pickString(row, ['terminalStatus', 'terminalInstallationStatus', 'deviceStatus'])} />
            </div>
          )}
          {!isLoading && !error && kind === 'claim' && (
            <div className="grid grid-cols-2 gap-4">
              <RelatedInfoRow label="접수번호" value={pickString(row, ['claimNo', 'claimNumber'])} />
              <RelatedInfoRow label="보험사" value={pickString(row, ['insurerName', 'insuranceCompany'])} />
              <RelatedInfoRow label="정비공장" value={pickString(row, ['repairShopName', 'garageName'])} />
              <RelatedInfoRow label="청구 상태" value={getRelatedStatusLabel(row.claimStatus)} />
              <RelatedInfoRow label="승인 상태" value={getRelatedStatusLabel(row.approvalStatus)} />
              <RelatedInfoRow label="문서 상태" value={getRelatedStatusLabel(row.documentStatus)} />
              <RelatedInfoRow label="청구액" value={formatCurrencyValue(row.billedAmount)} />
              <RelatedInfoRow label="인정액" value={formatCurrencyValue(row.recognizedAmount)} />
              <RelatedInfoRow label="차액" value={formatCurrencyValue(row.differenceAmount)} />
              <RelatedInfoRow label="차액 부담" value={pickString(row, ['differencePayerType'])} />
            </div>
          )}
          {!isLoading && !error && kind === 'billing' && (
            <div className="space-y-4">
              {Object.keys(billingPaymentInfo).length > 0 && (
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <RelatedInfoRow label="총 금액" value={formatCurrencyValue(billingPaymentInfo.totalAmount ?? billingPaymentInfo.amount)} />
                  <RelatedInfoRow label="기존 미납" value={formatCurrencyValue(billingPaymentInfo.principalAmount)} />
                  <RelatedInfoRow label="추가 금액" value={formatCurrencyValue(billingPaymentInfo.additionalAmount)} />
                  <RelatedInfoRow label="상태" value={getRelatedStatusLabel(billingPaymentInfo.status ?? billingPaymentInfo.statusLabel)} />
                </div>
              )}
              {billingChargeItems.length > 0 ? (
                <div className="space-y-2">
                  {billingChargeItems.map((charge) => (
                    <div key={charge.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{charge.description || getRelatedChargeTypeLabel(charge.chargeType)}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {getRelatedStatusLabel(charge.status)}
                            {charge.dueDate ? ` · 기한 ${charge.dueDate}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrencyValue(charge.amount)}</p>
                          <p className="text-xs font-semibold text-red-600">잔액 {formatCurrencyValue(charge.remainingAmount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                  연결된 청구/환불 항목이 없습니다.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function toAccidentClaimDraft(payload: unknown): AccidentClaimDraft {
  const row = unwrapApiData(payload);
  const source = isRecord(row) ? row : {};
  const legacyApprovalDocument = pickString(source, ['approvalDocumentObjectName']);
  const approvalDocumentObjectNames = Array.isArray(source.approvalDocumentObjectNames)
    ? source.approvalDocumentObjectNames
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
    : (legacyApprovalDocument ? [legacyApprovalDocument] : []);
  return {
    claimNo: pickString(source, ['claimNo', 'claimNumber']) ?? '',
    insurerName: pickString(source, ['insurerName', 'insuranceCompany']) ?? '',
    repairShopName: pickString(source, ['repairShopName', 'garageName']) ?? '',
    repairCompletedAt: (pickString(source, ['repairCompletedAt']) ?? '').slice(0, 10),
    billingAccount: pickString(source, ['billingAccount']) ?? '',
    approvalStatus: pickString(source, ['approvalStatus']) ?? 'pending',
    approvalDocumentObjectName: legacyApprovalDocument ?? '',
    approvalDocumentObjectNames,
    approvalDocumentDetails: Array.isArray(source.approvalDocumentDetails)
      ? source.approvalDocumentDetails.filter((entry): entry is ActionDocumentDetail => isRecord(entry) && Boolean(pickString(entry, ['objectName'])))
      : [],
    approvalMemo: pickString(source, ['approvalMemo']) ?? '',
    billedAmount: String(Math.max(0, Math.trunc(toNumberValue(source.billedAmount) ?? 0)) || ''),
    recognizedAmount: String(Math.max(0, Math.trunc(toNumberValue(source.recognizedAmount) ?? 0)) || ''),
    differencePayerType: pickString(source, ['differencePayerType']) ?? 'customer',
    supplementMemo: pickString(source, ['supplementMemo']) ?? '',
    documentDetails: Array.isArray(source.documentDetails)
      ? source.documentDetails.filter((entry): entry is ActionDocumentDetail => isRecord(entry) && Boolean(pickString(entry, ['objectName'])))
      : [],
    documentStatus: pickString(source, ['documentStatus']) ?? '',
    claimStatus: pickString(source, ['claimStatus']) ?? '',
    submittedAt: pickString(source, ['submittedAt', 'lastSubmittedAt']) ?? '',
  };
}

function toRentalAccidentDraft(payload: unknown): RentalAccidentDraft {
  const row = unwrapApiData(payload);
  const reservation = isRecord(row) && isRecord(row.reservation)
    ? row.reservation
    : isRecord(row) && isRecord(row.item)
      ? row.item
      : row;
  const report = isRecord(reservation) && isRecord(reservation.accidentReport)
    ? reservation.accidentReport
    : {};
  const evidenceDocuments = isRecord(report.accidentEvidenceDocuments)
    ? Object.fromEntries(
      Object.entries(report.accidentEvidenceDocuments)
        .map(([key, value]) => [key, toStringValue(value) ?? ''])
        .filter(([, value]) => value),
    )
    : {};
  const evidenceDocumentDetails = isRecord(report.accidentEvidenceDocumentDetails)
    ? Object.fromEntries(
      Object.entries(report.accidentEvidenceDocumentDetails)
        .filter(([key, value]) => String(key).trim() && isRecord(value))
        .map(([key, value]) => [key, value as ActionDocumentDetail]),
    )
    : {};
  const initialBlackboxObjectName = pickString(report, ['blackboxGcsObjectName']) ?? '';
  const initialBlackboxFileName = pickString(report, ['blackboxFileName']) ?? '';
  if (initialBlackboxObjectName && !evidenceDocuments.blackbox) {
    evidenceDocuments.blackbox = initialBlackboxObjectName;
  }
  if (initialBlackboxObjectName && !evidenceDocumentDetails.blackbox) {
    evidenceDocumentDetails.blackbox = buildFallbackDocumentDetail(initialBlackboxObjectName, initialBlackboxFileName);
  }
  return {
    registrationDescription: pickString(report, ['description', 'actionItemMemo']) ?? '',
    accidentLocation: pickString(report, ['accidentLocation']) ?? '',
    opponentInfo: pickString(report, ['opponentInfo']) ?? '',
    insuranceClaimNo: pickString(report, ['insuranceClaimNo']) ?? '',
    evidenceStatus: pickString(report, ['evidenceStatus']) ?? 'pending',
    accidentEvidenceDocuments: evidenceDocuments,
    accidentEvidenceDocumentDetails: evidenceDocumentDetails,
    insuranceProcessStatus: pickString(report, ['insuranceProcessStatus']) ?? 'reported',
    customerChargeAmount: String(Math.max(0, Math.trunc(toNumberValue(report.customerChargeAmount) ?? 0)) || ''),
    customerChargeStatus: pickString(report, ['customerChargeStatus']) ?? 'none',
    memo: pickString(report, ['memo']) ?? '',
  };
}

function toAccidentReplacementDriverDraft(payload: unknown): AccidentReplacementDriverDraft {
  const row = unwrapApiData(payload);
  const reservation = isRecord(row) && isRecord(row.reservation)
    ? row.reservation
    : isRecord(row) && isRecord(row.item)
      ? row.item
      : row;
  const source = isRecord(reservation) ? reservation : {};
  const parties = isRecord(source.parties) ? source.parties : {};
  const driver = isRecord(parties.driver) ? parties.driver : {};
  return {
    customerName: pickString(driver, ['name']) ?? pickString(source, ['customerName', 'customer']) ?? '',
    phone: pickString(driver, ['phone']) ?? pickString(source, ['phone', 'customerPhone']) ?? '',
    licenseNumber: pickString(driver, ['licenseNumber']) ?? pickString(source, ['licenseNumber']) ?? '',
    address: pickString(driver, ['address']) ?? pickString(source, ['address']) ?? '',
    licenseDocumentObjectName: pickString(driver, ['licenseDocumentObjectName']) ?? pickString(source, ['licenseDocumentObjectName']) ?? '',
  };
}

function normalizeSeverity(rawValue: string | null): ActionItem['severity'] {
  if (!rawValue) {
    return 'Low';
  }

  const normalized = rawValue.toLowerCase().replace(/_/g, '-');
  if (normalized === 'high' || normalized === '상') {
    return 'High';
  }
  if (normalized === 'medium' || normalized === 'mid' || normalized === '중') {
    return 'Medium';
  }
  return 'Low';
}

function getDisplayedSeverity(item: ActionItem): ActionItem['severity'] | '-' {
  if (item.statusCode === 'resolved' || item.status === '완료') {
    return '-';
  }
  return item.severity;
}

function normalizeActionItemType(rawValue: string | null, hasPaymentInfo: boolean): string | null {
  return normalizeActionMainCategory(rawValue, hasPaymentInfo) ?? rawValue;
}

function normalizeStatusLabel(rawValue: string | null): string {
  if (!rawValue) {
    return '대기중';
  }
  if (rawValue.includes('연체')) {
    return rawValue;
  }

  const normalized = rawValue.toLowerCase().replace(/_/g, '-');
  if (normalized === 'pending' || normalized === 'open') {
    return '대기중';
  }
  if (normalized === 'in-progress' || normalized === 'in progress' || normalized === 'processing') {
    return '진행중';
  }
  if (normalized === 'resolved' || normalized === 'done' || normalized === 'closed') {
    return '완료';
  }
  if (rawValue === '대기' || rawValue === '대기중') {
    return '대기중';
  }
  if (rawValue === '진행중') {
    return '진행중';
  }
  if (rawValue === '완료') {
    return '완료';
  }

  return rawValue;
}

function normalizeStatusCode(rawValue: string | null): ActionStatusCode {
  if (!rawValue) {
    return 'pending';
  }

  if (rawValue.includes('완료')) {
    return 'resolved';
  }
  if (rawValue.includes('진행')) {
    return 'in-progress';
  }
  if (rawValue.includes('대기') || rawValue.includes('연체')) {
    return 'pending';
  }

  const normalized = rawValue.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '');
  if (normalized === 'resolved' || normalized === 'done' || normalized === 'closed') {
    return 'resolved';
  }
  if (normalized === 'in-progress' || normalized === 'inprogress' || normalized === 'processing') {
    return 'in-progress';
  }
  if (normalized === 'pending' || normalized === 'open') {
    return 'pending';
  }

  return 'pending';
}

function normalizeReservationContractStatus(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'reservation' || normalized === 'reserved' || normalized === '예약' || normalized === '예약중') {
    return '예약중';
  }
  if (normalized === 'rental' || normalized === 'in_use' || normalized === '대여중') {
    return '대여중';
  }
  if (normalized === 'return' || normalized === 'returned' || normalized === '반납' || normalized === '반납완료' || normalized === '완료') {
    return '완료';
  }

  return rawValue.trim();
}

function getListStatusQuery(statusFilter: ActionStatusFilter, includeCompleted: boolean): string | undefined {
  if (includeCompleted && statusFilter === 'all') {
    return 'done';
  }
  if (statusFilter === 'pending') {
    return 'open';
  }
  if (statusFilter === 'in-progress') {
    return 'in_progress';
  }
  if (statusFilter === 'resolved') {
    return 'done';
  }
  return includeCompleted ? undefined : ACTIVE_ACTION_STATUS_QUERY;
}

function matchesVisibleStatusFilters(
  nextStatusCode: ActionStatusCode,
  statusFilter: ActionStatusFilter,
  includeCompleted: boolean,
): boolean {
  if (statusFilter === 'all') {
    return includeCompleted ? nextStatusCode === 'resolved' : nextStatusCode !== 'resolved';
  }
  return statusFilter === nextStatusCode;
}

function toStatusLabel(statusCode: ActionStatusCode): string {
  if (statusCode === 'resolved') {
    return '완료';
  }
  if (statusCode === 'in-progress') {
    return '진행중';
  }
  return '대기중';
}

function toStatusPatchValue(statusCode: ActionStatusCode): string {
  return statusCode;
}

function normalizeMemoStatus(rawValue: string | null): MemoLog['status'] {
  const normalizedStatusCode = normalizeStatusCode(rawValue);
  if (normalizedStatusCode === 'resolved') {
    return 'resolved';
  }
  if (normalizedStatusCode === 'in-progress') {
    return 'in-progress';
  }
  return 'pending';
}

function toActionWriteError(kind: ActionWriteKind, error: unknown): ActionWriteErrorState {
  if (error instanceof ApiError) {
    const fields = error.fields?.map((field) => ({
      name: typeof field.label === 'string'
        ? field.label
        : typeof field.name === 'string'
          ? field.name
          : undefined,
      reason: typeof field.reason === 'string' ? field.reason : undefined,
    }));
    if (error.status === 400) {
      if (kind === 'assignee') {
        return {
          kind,
          message: '담당자 값이 올바르지 않습니다. 회사 계정을 다시 선택해 주세요.',
          retryable: false,
          fields,
        };
      }
      if (kind === 'memo') {
        return {
          kind,
          message: '메모 형식이 올바르지 않거나 허용 길이를 초과했습니다. 입력값을 확인해 주세요.',
          retryable: false,
          fields,
        };
      }
      return {
        kind,
        message: '허용되지 않은 상태 값입니다. 상태 값을 다시 선택해 주세요.',
        retryable: false,
        fields,
      };
    }

    if (error.status === 401) {
      return {
        kind,
        message: '세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.',
        retryable: false,
        fields,
      };
    }

    if (error.status === 403) {
      return {
        kind,
        message: '권한이 없어 요청을 처리할 수 없습니다.',
        retryable: false,
        fields,
      };
    }

    if (error.status === 404) {
      return {
        kind,
        message: '대상 항목을 찾을 수 없습니다. 목록을 새로고침한 뒤 재시도해 주세요.',
        retryable: false,
        fields,
      };
    }

    if (error.status === 409) {
      if (error.code === 'LEDGER_AUTHORITATIVE') {
        return {
          kind,
          message: error.message || '신규 청구 원장이 기준인 계약입니다. 정산 항목에서 처리하세요.',
          retryable: false,
          fields,
        };
      }
      if (error.code === 'ACTION_ITEM_RESOLUTION_REQUIRED') {
        return {
          kind,
          message: error.message || '완료 조건이 아직 충족되지 않았습니다.',
          retryable: false,
          fields,
        };
      }
      return {
        kind,
        message: '다른 사용자가 먼저 수정했습니다. 최신 데이터로 재시도해 주세요.',
        retryable: false,
        fields,
      };
    }

    if (error.status !== undefined && error.status >= 500) {
      return {
        kind,
        message: '서버 오류가 발생했습니다. 재시도해 주세요.',
        retryable: true,
        fields,
      };
    }

    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return {
        kind,
        message: '네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 재시도해 주세요.',
        retryable: true,
        fields,
      };
    }

    if (error.code === 'ABORTED') {
      return {
        kind,
        message: '요청이 중단되었습니다. 재시도해 주세요.',
        retryable: true,
        fields,
      };
    }

    return {
      kind,
      message: error.message || '요청 처리 중 오류가 발생했습니다.',
      retryable: false,
      fields,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      kind,
      message: error.message,
      retryable: false,
    };
  }

  return {
    kind,
    message: '요청 처리 중 오류가 발생했습니다.',
    retryable: false,
  };
}

function toMemoLogs(value: unknown): MemoLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const content = pickString(entry, ['content', 'memo', 'note']);
      if (!content) {
        return null;
      }

      const statusValue = pickString(entry, ['status']);
      const timestamp = pickString(entry, ['timestamp', 'createdAt', 'changedAt', 'updatedAt']) ?? new Date().toISOString();
      return {
        id: pickString(entry, ['id', 'memoId']) ?? `memo-${index + 1}`,
        content,
        timestamp,
        author: pickString(entry, ['author', 'changedByName', 'createdByName', 'updatedByName', 'createdBy', 'changedBy', 'updatedBy']) ?? '-',
        status: normalizeMemoStatus(statusValue),
        statusLabel: pickString(entry, ['statusLabel']) ?? normalizeStatusLabel(statusValue),
        sortTimestamp: memoTimestampValue(timestamp),
        sortTimestampRaw: timestamp,
        sortSequence: index,
      };
    })
    .filter((entry): entry is MemoLog => entry !== null);
}

function memoTimestampValue(timestamp: string): number {
  const normalized = timestamp.trim();
  if (!normalized) {
    return 0;
  }

  const isoMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:\d{2})?$/,
  );
  if (isoMatch) {
    const [
      ,
      yearText,
      monthText,
      dayText,
      hourText,
      minuteText,
      secondText = '0',
      fractionalText = '',
      timezoneText = 'Z',
    ] = isoMatch;

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const microseconds = Number(fractionalText.padEnd(6, '0').slice(0, 6));

    let offsetMinutes = 0;
    if (timezoneText !== 'Z') {
      const sign = timezoneText.startsWith('-') ? -1 : 1;
      const [offsetHourText, offsetMinuteText] = timezoneText.slice(1).split(':');
      offsetMinutes = sign * ((Number(offsetHourText) * 60) + Number(offsetMinuteText));
    }

    const utcMilliseconds = Date.UTC(year, month - 1, day, hour, minute, second, 0) - (offsetMinutes * 60_000);
    return (utcMilliseconds * 1000) + microseconds;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed * 1000 : 0;
}

function sortMemoLogsLatestFirst(memos: MemoLog[]): MemoLog[] {
  return [...memos].sort((left, right) => {
    if (right.sortTimestamp !== left.sortTimestamp) {
      return right.sortTimestamp - left.sortTimestamp;
    }
    if (right.sortTimestampRaw !== left.sortTimestampRaw) {
      return right.sortTimestampRaw.localeCompare(left.sortTimestampRaw);
    }
    return right.sortSequence - left.sortSequence;
  });
}

function toHistoryLogs(source: Record<string, unknown>): MemoLog[] {
  if (Array.isArray(source.history)) {
    return toMemoLogs(source.history);
  }
  if (Array.isArray(source.memos)) {
    return toMemoLogs(source.memos);
  }
  if (Array.isArray(source.memoHistory)) {
    return sortMemoLogsLatestFirst(toMemoLogs(source.memoHistory));
  }
  return [];
}

function toPaymentInfo(source: Record<string, unknown>): ActionItem['paymentInfo'] | undefined {
  const paymentSource = isRecord(source.paymentInfo)
    ? source.paymentInfo
    : isRecord(source.payment)
      ? source.payment
      : source;

  const paymentId = pickString(paymentSource, ['paymentId', 'id']) ?? pickString(source, ['paymentId']);
  const reservationId = pickString(paymentSource, ['reservationId', 'rentalId']) ?? pickString(source, ['reservationId', 'rentalId']);
  const principalAmount = toNumberValue(paymentSource.principalAmount) ?? toNumberValue(paymentSource.amount) ?? 0;
  const additionalAmount = toNumberValue(paymentSource.additionalAmount) ?? 0;
  const totalAmount = toNumberValue(paymentSource.amount) ?? (principalAmount + additionalAmount);
  const dueDate = pickString(paymentSource, ['dueDate', 'paymentDueDate']);
  const overdueDays = toNumberValue(paymentSource.overdueDays) ?? 0;
  const rawStatus = pickString(paymentSource, ['status', 'paymentStatus']);
  const normalizedStatus = rawStatus ? toCanonicalPaymentStatus(rawStatus) : null;
  const statusLabel = normalizedStatus ? paymentStatusToLabel(normalizedStatus) : null;
  const updatedAt = pickString(paymentSource, ['updatedAt', 'statusUpdatedAt', 'paidAt', 'createdAt']);

  if (
    principalAmount === 0
    && additionalAmount === 0
    && dueDate === null
    && overdueDays === 0
    && !statusLabel
    && !paymentId
    && !reservationId
  ) {
    return undefined;
  }

  return {
    paymentId: paymentId ?? undefined,
    reservationId: reservationId ?? undefined,
    principalAmount,
    additionalAmount,
    amount: totalAmount,
    overdueDays,
    totalAmount,
    dueDate: dueDate ?? '-',
    paymentType: normalizePaymentType(pickString(paymentSource, ['paymentType', 'type', 'method', 'paymentMethod'])),
    status: normalizedStatus ?? undefined,
    statusLabel: statusLabel ?? undefined,
    updatedAt: updatedAt ?? undefined,
  };
}

function toActionItem(row: unknown, index: number, fallbackId?: string): ActionItem | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = pickString(row, ['id', 'actionId', 'actionItemId', 'paymentId']) ?? fallbackId ?? `action-${index + 1}`;
  const paymentInfo = toPaymentInfo(row);
  const workContext = toWorkContext(row);
  const reservationId = pickString(row, ['reservationId', 'rentalId']) ?? paymentInfo?.reservationId;
  const paymentId = pickString(row, ['paymentId']) ?? paymentInfo?.paymentId;
  const type = normalizeActionItemType(
    pickString(row, ['type', 'category', 'issueType', 'issue', 'title']),
    Boolean(paymentInfo),
  );
  const subCategory = normalizeActionSubCategory(
    pickString(row, ['category', 'type', 'issueType', 'issue', 'title']),
    pickString(row, ['subCategory', 'detailType']),
    pickString(row, ['reasonType']),
  );
  const vehicleNumber = pickVehicleNumber(row);

  if (!type || !vehicleNumber) {
    return null;
  }

  const memos = toHistoryLogs(row);

  const statusRawValue = pickString(row, ['status', 'statusLabel']);

  return {
    id,
    type,
    subCategory: subCategory ?? undefined,
    reasonType: pickString(row, ['reasonType']) ?? undefined,
    issueCode: canonicalActionIssueCode(pickString(row, ['issueCode'])),
    submissionDelayed: row.submissionDelayed === true,
    delayBusinessDays: toNumberValue(row.delayBusinessDays) ?? undefined,
    claimReadyAt: pickString(row, ['claimReadyAt']) ?? undefined,
    returnFollowupKind: pickString(row, ['returnFollowupKind']) ?? undefined,
    settlementNeedsPaymentCheck: row.settlementNeedsPaymentCheck === true,
    settlementNeedsDifference: row.settlementNeedsDifference === true,
    settlementPaymentCheckStatus: pickString(row, ['settlementPaymentCheckStatus']) as SettlementPaymentCheckStatus | undefined,
    settlementPaymentCheckMessage: pickString(row, ['settlementPaymentCheckMessage']) ?? undefined,
    settlementDifferenceStatus: pickString(row, ['settlementDifferenceStatus']) as SettlementDifferenceStatus | undefined,
    settlementDifferenceMessage: pickString(row, ['settlementDifferenceMessage']) ?? undefined,
    resolutionPolicy: pickString(row, ['resolutionPolicy']) ?? undefined,
    availableActions: Array.isArray(row.availableActions)
      ? row.availableActions.map((value) => toStringValue(value)).filter((value): value is string => Boolean(value))
      : undefined,
    relatedChargeItemId: pickString(row, ['relatedChargeItemId']) ?? undefined,
    vehicleNumber,
    customerName: pickPartyDisplayName(row) ?? pickString(row, ['customerName', 'customer', 'customerDisplayName']) ?? '-',
    date: pickString(row, ['date', 'dueDate', 'occurredAt', 'createdAt']) ?? '-',
    severity: normalizeSeverity(pickString(row, ['severity', 'priority'])),
    status: normalizeStatusLabel(statusRawValue),
    statusCode: normalizeStatusCode(statusRawValue),
    assignee: pickString(row, ['assignee', 'assigneeName', 'owner', 'assignedTo']) ?? '-',
    assigneeId: pickString(row, ['assigneeId']) ?? undefined,
    reservationId: reservationId ?? undefined,
    paymentId: paymentId ?? undefined,
    description: pickString(row, ['description', 'detail']),
    memos: memos.length > 0 ? memos : undefined,
    workContext,
    paymentInfo,
  };
}

function getActionItemPaymentMutationId(item: ActionItem): string | null {
  const directPaymentId = (item.paymentId ?? item.paymentInfo?.paymentId ?? '').trim();
  if (directPaymentId) {
    return directPaymentId;
  }
  const reservationId = (item.reservationId ?? item.paymentInfo?.reservationId ?? '').trim();
  if (!reservationId) {
    return null;
  }
  return `AUTO-PAY-${reservationId}`;
}

function getActionItemReservationId(item: ActionItem): string | null {
  const reservationId = (item.reservationId ?? item.paymentInfo?.reservationId ?? '').trim();
  return reservationId || null;
}

function getActionItemPaymentAmount(item: ActionItem): number {
  const amount = Number(item.paymentInfo?.totalAmount ?? item.paymentInfo?.amount ?? item.paymentInfo?.principalAmount ?? 0);
  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

function toTotalCount(payload: unknown, fallback: number): number {
  if (!isRecord(payload)) {
    return fallback;
  }

  const direct = toNumberValue(payload.total)
    ?? toNumberValue(payload.totalCount)
    ?? toNumberValue(payload.count)
    ?? toNumberValue(payload.size);
  if (direct !== null) {
    return direct;
  }

  if (isRecord(payload.meta)) {
    const metaCount = toNumberValue(payload.meta.total)
      ?? toNumberValue(payload.meta.totalCount)
      ?? toNumberValue(payload.meta.count)
      ?? toNumberValue(payload.meta.size);
    if (metaCount !== null) {
      return metaCount;
    }
  }

  return fallback;
}

function toActionItemCollection(payload: unknown): { items: ActionItem[]; total: number } {
  const rows = getCollectionFromPayload(payload, LIST_COLLECTION_KEYS);
  if (!rows) {
    return { items: [], total: toTotalCount(payload, 0) };
  }

  const uniqueIds = new Set<string>();
  const items: ActionItem[] = [];

  rows.forEach((row, index) => {
    const actionItem = toActionItem(row, index);
    if (!actionItem) {
      return;
    }
    if (uniqueIds.has(actionItem.id)) {
      return;
    }
    uniqueIds.add(actionItem.id);
    items.push(actionItem);
  });

  return {
    items,
    total: toTotalCount(payload, items.length),
  };
}

function toActionItemDetail(payload: unknown, fallbackItem: ActionItem): ActionItem {
  if (isRecord(payload)) {
    const detailCandidate = payload.item
      ?? payload.actionRequired
      ?? payload.actionItem
      ?? payload.detail
      ?? payload.data
      ?? payload;

    const detailItem = toActionItem(detailCandidate, 0, fallbackItem.id);
    if (detailItem) {
      return {
        ...fallbackItem,
        ...detailItem,
        paymentInfo: detailItem.paymentInfo ?? fallbackItem.paymentInfo,
        workContext: detailItem.workContext ?? fallbackItem.workContext,
        memos: detailItem.memos ?? fallbackItem.memos,
      };
    }
  }

  const detailItem = toActionItem(payload, 0, fallbackItem.id);
  if (detailItem) {
    return {
      ...fallbackItem,
      ...detailItem,
      paymentInfo: detailItem.paymentInfo ?? fallbackItem.paymentInfo,
      workContext: detailItem.workContext ?? fallbackItem.workContext,
      memos: detailItem.memos ?? fallbackItem.memos,
    };
  }

  return fallbackItem;
}

export default function ActionRequired() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canPerformAction, canAccessRoute } = useAuthorization();
  const canWriteActionRequired = canPerformAction(ACTION_PERMISSIONS.actionRequiredWrite);
  const canWritePayments = canPerformAction(ACTION_PERMISSIONS.paymentsWrite);
  const canViewAssets = canAccessRoute(ROUTE_PERMISSIONS.assets);
  const canViewReservations = canAccessRoute(ROUTE_PERMISSIONS.reservations);

  const [selectedFilters, setSelectedFilters] = useState<ActionIssueFilter[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ActionStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<ActionPriorityFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const selectedItemCapabilities = getActionItemCapabilities(selectedItem, canWritePayments, canWriteActionRequired);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentMemo, setCurrentMemo] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentAssigneeId, setCurrentAssigneeId] = useState('');
  const [sourceActionItems, setSourceActionItems] = useState<ActionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [writeError, setWriteError] = useState<ActionWriteErrorState | null>(null);
  const [writeNotice, setWriteNotice] = useState<string | null>(null);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [isMemoSaving, setIsMemoSaving] = useState(false);
  const [isResolveSaving, setIsResolveSaving] = useState(false);
  const [isAssigneeSaving, setIsAssigneeSaving] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [lateReturnResolveDialog, setLateReturnResolveDialog] = useState<LateReturnResolveDialogState>(null);
  const [paymentIssueResolveDialog, setPaymentIssueResolveDialog] = useState<PaymentIssueResolveDialogState>(null);
  const [pendingPaymentConfirmation, setPendingPaymentConfirmation] = useState<PendingPaymentConfirmation | null>(null);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState('');
  const [paymentTypeDraft, setPaymentTypeDraft] = useState<'카드' | '현금' | '계좌이체'>('카드');
  const [paymentEvidenceFile, setPaymentEvidenceFile] = useState<File | null>(null);
  const [refundAmountDraft, setRefundAmountDraft] = useState('');
  const [refundMethodDraft, setRefundMethodDraft] = useState('계좌이체');
  const [refundCompletedAtDraft, setRefundCompletedAtDraft] = useState(toDateInputValue(new Date().toISOString()));
  const [refundMemoDraft, setRefundMemoDraft] = useState('');
  const [refundEvidenceFile, setRefundEvidenceFile] = useState<File | null>(null);
  const [isPaymentAmountSaving, setIsPaymentAmountSaving] = useState(false);
  const [isPaymentTypeSaving, setIsPaymentTypeSaving] = useState(false);
  const [isPaymentInfoRefreshing, setIsPaymentInfoRefreshing] = useState(false);
  const [isDomainActionSaving, setIsDomainActionSaving] = useState(false);
  const [isWorkActionSaving, setIsWorkActionSaving] = useState(false);
  const [relatedContextKind, setRelatedContextKind] = useState<RelatedContextPanelKind | null>(null);
  const [relatedContextPayload, setRelatedContextPayload] = useState<unknown>(null);
  const [relatedContextError, setRelatedContextError] = useState<string | null>(null);
  const [isRelatedContextLoading, setIsRelatedContextLoading] = useState(false);

  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailNotFound, setIsDetailNotFound] = useState(false);
  const [issueAsset, setIssueAsset] = useState<IssueAssetRecord | null>(null);
  const [issueAssetDate, setIssueAssetDate] = useState('');
  const [issueAssetFile, setIssueAssetFile] = useState<File | null>(null);
  const [issueAssetError, setIssueAssetError] = useState<string | null>(null);
  const [issueAssetNotice, setIssueAssetNotice] = useState<string | null>(null);
  const [isIssueAssetLoading, setIsIssueAssetLoading] = useState(false);
  const [isIssueAssetSaving, setIsIssueAssetSaving] = useState(false);
  const [issueAssetPrompt, setIssueAssetPrompt] = useState<null | {
    mode: 'invalid' | 'completed' | 'blocked';
    kind: IssueAssetKind;
    message: string;
    payload?: { version: number; insuranceExpiry?: string | null; nextInspection?: string | null };
  }>(null);
  const [accidentClaimDraft, setAccidentClaimDraft] = useState<AccidentClaimDraft>({
    claimNo: '',
    insurerName: '',
    repairShopName: '',
    repairCompletedAt: '',
    billingAccount: '',
    approvalStatus: 'pending',
    approvalDocumentObjectName: '',
    approvalDocumentObjectNames: [],
    approvalDocumentDetails: [],
    approvalMemo: '',
    billedAmount: '',
    recognizedAmount: '',
    differencePayerType: 'customer',
    supplementMemo: '',
    documentDetails: [],
    documentStatus: '',
    claimStatus: '',
    submittedAt: '',
  });
  const [isAccidentClaimLoading, setIsAccidentClaimLoading] = useState(false);
  const [isAccidentClaimSaving, setIsAccidentClaimSaving] = useState(false);
  const [accidentClaimError, setAccidentClaimError] = useState<string | null>(null);
  const [accidentClaimNotice, setAccidentClaimNotice] = useState<string | null>(null);
  const [accidentClaimDocumentFile, setAccidentClaimDocumentFile] = useState<File | null>(null);
  const [accidentApprovalDocumentFiles, setAccidentApprovalDocumentFiles] = useState<File[]>([]);
  const [accidentApprovalRejectConfirmOpen, setAccidentApprovalRejectConfirmOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<ActionDocumentDetail | null>(null);
  const [rentalAccidentDraft, setRentalAccidentDraft] = useState<RentalAccidentDraft>({
    registrationDescription: '',
    accidentLocation: '',
    opponentInfo: '',
    insuranceClaimNo: '',
    evidenceStatus: 'pending',
    accidentEvidenceDocuments: {},
    accidentEvidenceDocumentDetails: {},
    insuranceProcessStatus: 'reported',
    customerChargeAmount: '',
    customerChargeStatus: 'none',
    memo: '',
  });
  const [rentalAccidentEvidenceFiles, setRentalAccidentEvidenceFiles] = useState<RentalAccidentEvidenceFiles>({});
  const [isRentalAccidentLoading, setIsRentalAccidentLoading] = useState(false);
  const [isRentalAccidentSaving, setIsRentalAccidentSaving] = useState(false);
  const [rentalAccidentError, setRentalAccidentError] = useState<string | null>(null);
  const [rentalAccidentNotice, setRentalAccidentNotice] = useState<string | null>(null);
  const [accidentReplacementDriverDraft, setAccidentReplacementDriverDraft] = useState<AccidentReplacementDriverDraft>({
    customerName: '',
    phone: '',
    licenseNumber: '',
    address: '',
    licenseDocumentObjectName: '',
  });
  const [accidentReplacementLicenseFile, setAccidentReplacementLicenseFile] = useState<File | null>(null);
  const [isAccidentReplacementDriverLoading, setIsAccidentReplacementDriverLoading] = useState(false);
  const [isAccidentReplacementDriverSaving, setIsAccidentReplacementDriverSaving] = useState(false);
  const [accidentReplacementDriverError, setAccidentReplacementDriverError] = useState<string | null>(null);
  const [accidentReplacementDriverNotice, setAccidentReplacementDriverNotice] = useState<string | null>(null);

  const detailRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);

  const isWriteSaving = isStatusSaving || isMemoSaving || isResolveSaving || isAssigneeSaving || isAccidentClaimSaving || isRentalAccidentSaving || isAccidentReplacementDriverSaving || isDomainActionSaving || isWorkActionSaving;
  const selectedItemDescription = selectedItem ? getIssueAssetDescription(selectedItem, issueAsset) : null;

  const requestActionItems = useCallback((signal: AbortSignal) => getActionRequiredListAll({
    pageSize: 100,
    status: getListStatusQuery(statusFilter, includeCompleted),
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    assignee: assigneeFilter === 'all' ? undefined : assigneeFilter,
    signal,
  }), [assigneeFilter, includeCompleted, priorityFilter, statusFilter]);

  const handleActionItemsSuccess = useCallback((payload: unknown) => {
    const { items, total } = toActionItemCollection(payload);
    setSourceActionItems(items);
    setTotalItems(total);
  }, []);

  const isActionItemsPayloadEmpty = useCallback((payload: unknown) => {
    const rows = getCollectionFromPayload(payload, LIST_COLLECTION_KEYS);
    if (rows) {
      return rows.length === 0;
    }
    return isPayloadEmpty(payload, LIST_COLLECTION_KEYS);
  }, []);

  const {
    isLoading: isItemsLoading,
    error: itemsError,
    errorKind: itemsErrorKind,
    isEmpty: isActionApiEmpty,
    run: hydrateActionItems,
  } = usePageEndpointState<unknown>({
    request: requestActionItems,
    onSuccess: handleActionItemsSuccess,
    isEmpty: isActionItemsPayloadEmpty,
  });

  useEffect(() => {
    void hydrateActionItems();
  }, [hydrateActionItems]);

  useEffect(() => () => {
    detailControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listSettingsMembers('approved', { signal: controller.signal })
      .then((payload) => {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const nextOptions = items
          .map((member: SettingsMember) => {
            const userId = (member.userId ?? '').trim();
            const name = (member.name ?? member.email ?? userId).trim();
            if (!userId || !name) {
              return null;
            }
            return { userId, name };
          })
          .filter((option): option is AssigneeOption => option !== null)
          .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
        setAssigneeOptions(nextOptions);
      })
      .catch(() => {
        setAssigneeOptions([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setLateReturnResolveDialog(null);
      setCurrentAssigneeId('');
    } else {
      setCurrentAssigneeId(selectedItem.assigneeId ?? '');
    }
    setRelatedContextKind(null);
    setRelatedContextPayload(null);
    setRelatedContextError(null);
    setIsRelatedContextLoading(false);
  }, [selectedItem?.id, selectedItem?.assigneeId]);

  useEffect(() => {
    const issueAssetKind = getIssueAssetKind(selectedItem);
    if (!selectedItem || !issueAssetKind) {
      setIssueAsset(null);
      setIssueAssetDate('');
      setIssueAssetFile(null);
      setIssueAssetError(null);
      setIssueAssetNotice(null);
      setIssueAssetPrompt(null);
      setIsIssueAssetLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsIssueAssetLoading(true);
    setIssueAsset(null);
    setIssueAssetFile(null);
    setIssueAssetError(null);
    setIssueAssetNotice(null);
    void getAssetsList({
      page: 1,
      size: 20,
      q: selectedItem.vehicleNumber,
      signal: controller.signal,
    })
      .then((payload) => {
        const rows = getCollectionFromPayload(payload, ['items', 'rows', 'list']) ?? [];
        const matchedAsset = rows
          .map((row) => toIssueAssetRecord(row))
          .find((row) => row && row.vehicleNumber === selectedItem.vehicleNumber) ?? null;
        setIssueAsset(matchedAsset);
        if (!matchedAsset) {
          setIssueAssetError('연결된 차량 자산을 찾을 수 없습니다.');
          return;
        }
        setIssueAssetDate(toDateInputValue(issueAssetKind === 'insurance' ? matchedAsset.insuranceExpiry : matchedAsset.nextInspection));
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError) {
          setIssueAssetError(error.message || '차량 자산 정보를 불러오지 못했습니다.');
          return;
        }
        setIssueAssetError('차량 자산 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsIssueAssetLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedItem]);

  useEffect(() => {
    if (selectedItem?.type !== '대차/보험청구' || !selectedItem.reservationId) {
      setAccidentClaimDraft({
        claimNo: '',
        insurerName: '',
        repairShopName: '',
        repairCompletedAt: '',
        billingAccount: '',
        approvalStatus: 'pending',
        approvalDocumentObjectName: '',
        approvalDocumentObjectNames: [],
        approvalDocumentDetails: [],
        approvalMemo: '',
        billedAmount: '',
        recognizedAmount: '',
        differencePayerType: 'customer',
        supplementMemo: '',
        documentDetails: [],
        documentStatus: '',
        claimStatus: '',
        submittedAt: '',
      });
      setAccidentClaimError(null);
      setAccidentClaimNotice(null);
      setAccidentClaimDocumentFile(null);
      setAccidentApprovalDocumentFiles([]);
      setAccidentApprovalRejectConfirmOpen(false);
      setIsAccidentClaimLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsAccidentClaimLoading(true);
    setAccidentClaimError(null);
    setAccidentClaimNotice(null);
    setAccidentApprovalDocumentFiles([]);
    setAccidentApprovalRejectConfirmOpen(false);
    void getAccidentClaim(selectedItem.reservationId, { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setAccidentClaimDraft(toAccidentClaimDraft(payload));
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.code === 'NOT_FOUND') {
          return;
        }
        setAccidentClaimError(error instanceof ApiError ? error.message : '보험청구 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsAccidentClaimLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItemCapabilities.canUseRentalAccidentActions || !selectedItem?.reservationId) {
      setRentalAccidentDraft({
        registrationDescription: '',
        accidentLocation: '',
        opponentInfo: '',
        insuranceClaimNo: '',
        evidenceStatus: 'pending',
        accidentEvidenceDocuments: {},
        accidentEvidenceDocumentDetails: {},
        insuranceProcessStatus: 'reported',
        customerChargeAmount: '',
        customerChargeStatus: 'none',
        memo: '',
      });
      setRentalAccidentEvidenceFiles({});
      setRentalAccidentError(null);
      setRentalAccidentNotice(null);
      setIsRentalAccidentLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsRentalAccidentLoading(true);
    setRentalAccidentError(null);
    setRentalAccidentNotice(null);
    void getReservationDetail(selectedItem.reservationId, { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setRentalAccidentDraft(toRentalAccidentDraft(payload));
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setRentalAccidentError(error instanceof ApiError ? error.message : '사고 후속 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsRentalAccidentLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedItem, selectedItemCapabilities.canUseRentalAccidentActions]);

  useEffect(() => {
    if (!selectedItemCapabilities.canUseAccidentReplacementDriverActions || !selectedItem?.reservationId) {
      setAccidentReplacementDriverDraft({
        customerName: '',
        phone: '',
        licenseNumber: '',
        address: '',
        licenseDocumentObjectName: '',
      });
      setAccidentReplacementLicenseFile(null);
      setAccidentReplacementDriverError(null);
      setAccidentReplacementDriverNotice(null);
      setIsAccidentReplacementDriverLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsAccidentReplacementDriverLoading(true);
    setAccidentReplacementDriverError(null);
    setAccidentReplacementDriverNotice(null);
    void getReservationDetail(selectedItem.reservationId, { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setAccidentReplacementDriverDraft(toAccidentReplacementDriverDraft(payload));
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setAccidentReplacementDriverError(error instanceof ApiError ? error.message : '운전자 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsAccidentReplacementDriverLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedItem, selectedItemCapabilities.canUseAccidentReplacementDriverActions]);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const searchParam = searchParams.get('search');
    const reservationParam = searchParams.get('reservationId');

    const normalizedFilterParam = normalizeActionMainCategory(filterParam);

    if (normalizedFilterParam && ISSUE_FILTER_CHIPS.includes(normalizedFilterParam)) {
      setSelectedFilters([normalizedFilterParam]);
      setSelectedSubCategory('all');
      setPage(1);
    }

    if (reservationParam || searchParam) {
      setSearchQuery(reservationParam || searchParam || '');
      setPage(1);
    }
  }, [searchParams]);

  const handleActionItemsRetry = useCallback(() => {
    void hydrateActionItems();
  }, [hydrateActionItems]);

  const resetActionFilters = useCallback(() => {
    setSelectedFilters([]);
    setSelectedSubCategory('all');
    setIncludeCompleted(false);
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setPage(1);
  }, []);

  const handleActionErrorAction = useCallback(() => {
    handlePageErrorAction(itemsErrorKind, navigate);
  }, [itemsErrorKind, navigate]);

  const clearWriteFeedback = useCallback(() => {
    setWriteError(null);
    setWriteNotice(null);
    retryActionRef.current = null;
  }, []);

  const restoreOptimisticActionSnapshot = useCallback((snapshot: OptimisticActionSnapshot) => {
    setSelectedItem(snapshot.selectedItem);
    setSourceActionItems(snapshot.sourceActionItems);
    setTotalItems(snapshot.totalItems);
  }, []);

  const handleWriteRetry = useCallback(() => {
    if (isWriteSaving) {
      return;
    }
    const retryAction = retryActionRef.current;
    if (!retryAction) {
      return;
    }
    void retryAction();
  }, [isWriteSaving]);

  const hydrateActionDetail = useCallback(async (actionId: string, fallbackItem: ActionItem) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;

    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;

    setIsDetailLoading(true);
    setDetailError(null);
    setIsDetailNotFound(false);

    try {
      const payload = await getActionRequiredDetail(actionId, { signal: controller.signal });
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setSelectedItem(toActionItemDetail(payload, fallbackItem));
    } catch (error) {
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setSelectedItem(fallbackItem);
        return;
      }

      setDetailError(error instanceof Error ? error.message : '상세 정보를 불러오는 중 오류가 발생했습니다.');
      setSelectedItem(fallbackItem);
    } finally {
      if (detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  }, []);

  const handleRefreshPaymentInfo = useCallback(async () => {
    if (!isPaymentActionItem(selectedItem) || isPaymentInfoRefreshing) {
      return;
    }
    setIsPaymentInfoRefreshing(true);
    setWriteError(null);
    setWriteNotice(null);
    try {
      await hydrateActionItems();
      await hydrateActionDetail(selectedItem.id, selectedItem);
      setWriteNotice('결제 정보를 새로고침했습니다.');
    } catch {
      setWriteError({
        kind: 'memo',
        message: '결제 정보 새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        retryable: true,
      });
    } finally {
      setIsPaymentInfoRefreshing(false);
    }
  }, [hydrateActionDetail, hydrateActionItems, isPaymentInfoRefreshing, selectedItem]);

  const handleOpenDetail = useCallback((item: ActionItem) => {
    setSelectedItem(item);
    setCurrentMemo('');
    setCurrentStatus('');
    setCurrentAssigneeId(item.assigneeId ?? '');
    clearWriteFeedback();
    void hydrateActionDetail(item.id, item);
  }, [clearWriteFeedback, hydrateActionDetail]);

  const handleCloseDetail = useCallback(() => {
    if (isWriteSaving) {
      return;
    }
    detailControllerRef.current?.abort();
    setSelectedItem(null);
    setCurrentMemo('');
    setCurrentStatus('');
    setCurrentAssigneeId('');
    setIsDetailLoading(false);
    setDetailError(null);
    setIsDetailNotFound(false);
    clearWriteFeedback();
  }, [clearWriteFeedback, isWriteSaving]);

  const allItems: ActionItem[] = useMemo(() => sourceActionItems, [sourceActionItems]);

  useEffect(() => {
    setSelectedItem((previousItem) => {
      if (!previousItem) {
        return previousItem;
      }

      const nextItem = allItems.find((item) => item.id === previousItem.id);
      if (!nextItem) {
        return previousItem;
      }

      const previousPaymentUpdatedAt = previousItem.paymentInfo?.updatedAt ?? null;
      const nextPaymentUpdatedAt = nextItem.paymentInfo?.updatedAt ?? null;
      const hasPaymentChanged = previousPaymentUpdatedAt !== nextPaymentUpdatedAt;
      const hasCoreChanged = previousItem.severity !== nextItem.severity
        || previousItem.status !== nextItem.status
        || previousItem.statusCode !== nextItem.statusCode
        || previousItem.assignee !== nextItem.assignee
        || previousItem.assigneeId !== nextItem.assigneeId
        || previousItem.date !== nextItem.date
        || previousItem.description !== nextItem.description;

      if (!hasPaymentChanged && !hasCoreChanged) {
        return previousItem;
      }

      return {
        ...previousItem,
        ...nextItem,
        reservationId: previousItem.reservationId ?? nextItem.reservationId,
        paymentId: previousItem.paymentId ?? nextItem.paymentId,
        paymentInfo: nextItem.paymentInfo
          ? {
            ...(previousItem.paymentInfo ?? {}),
            ...nextItem.paymentInfo,
          }
          : previousItem.paymentInfo,
      };
    });
  }, [allItems]);

  const isSelectedPaymentIssue = isPaymentActionItem(selectedItem);
  const rentalAccidentIssueMode = getRentalAccidentIssueMode(selectedItem);
  const shouldShowRentalAccidentCustomerCharge = rentalAccidentIssueMode === 'insurance' && rentalAccidentDraft.insuranceProcessStatus === 'customer_charge';
  const accidentClaimIssueMode = getAccidentClaimIssueMode(selectedItem);
  const accidentClaimDifferenceAmount = getAccidentClaimDifferenceAmount(accidentClaimDraft);
  const returnFollowupSummary = selectedItem && isReturnFollowupActionItem(selectedItem)
    ? getRepairDoneNotReturnedSummary(selectedItem)
    : null;
  const returnFollowupIsRepairDone = isRepairDoneNotReturnedActionItem(selectedItem);

  useEffect(() => {
    if (!isPaymentActionItem(selectedItem)) {
      setPaymentAmountDraft('');
      setPaymentTypeDraft('카드');
      setPaymentEvidenceFile(null);
      setRefundAmountDraft('');
      setRefundMethodDraft('계좌이체');
      setRefundCompletedAtDraft(toDateInputValue(new Date().toISOString()));
      setRefundMemoDraft('');
      setRefundEvidenceFile(null);
      return;
    }
    const amount = selectedItem.paymentInfo?.additionalAmount ?? 0;
    setPaymentAmountDraft(String(Math.max(0, Math.trunc(amount))));
    setPaymentTypeDraft(normalizePaymentType(selectedItem.paymentInfo?.paymentType ?? null));
    setPaymentEvidenceFile(null);
    const refundCharge = toWorkChargeItems(selectedItem.workContext).find((charge) => isRefundChargeItem(charge));
    const refundAmount = refundCharge?.remainingAmount || refundCharge?.amount || selectedItem.paymentInfo?.totalAmount || selectedItem.paymentInfo?.amount || 0;
    setRefundAmountDraft(String(Math.max(0, Math.trunc(refundAmount))));
    setRefundMethodDraft('계좌이체');
    setRefundCompletedAtDraft(toDateInputValue(new Date().toISOString()));
    setRefundMemoDraft('');
    setRefundEvidenceFile(null);
  }, [selectedItem]);

  const isPaymentIssueResolved = isSelectedPaymentIssue
    && selectedItem?.statusCode === 'resolved';
  const canEditPaymentIssueFields = canWritePayments && !isPaymentIssueResolved;

  const closeRelatedContext = useCallback(() => {
    setRelatedContextKind(null);
    setRelatedContextPayload(null);
    setRelatedContextError(null);
    setIsRelatedContextLoading(false);
  }, []);

  const openRelatedContext = useCallback(async (kind: RelatedContextPanelKind) => {
    if (!selectedItem) {
      return;
    }
    setRelatedContextKind(kind);
    setRelatedContextPayload(null);
    setRelatedContextError(null);

    if (kind === 'billing') {
      setRelatedContextPayload({
        chargeItems: toWorkChargeItems(selectedItem.workContext),
        paymentInfo: selectedItem.paymentInfo ?? null,
      });
      return;
    }

    setIsRelatedContextLoading(true);
    try {
      if (kind === 'reservation') {
        if (!selectedItem.reservationId) {
          throw new Error('연결된 예약 정보를 찾을 수 없습니다.');
        }
        const payload = await getReservationDetail(selectedItem.reservationId);
        setRelatedContextPayload(payload);
        return;
      }

      if (kind === 'asset') {
        let assetId = issueAsset?.id ?? '';
        if (!assetId) {
          const listPayload = await getAssetsList({
            page: 1,
            size: 20,
            q: selectedItem.vehicleNumber,
          });
          const rows = getCollectionFromPayload(listPayload, ['items', 'rows', 'list']) ?? [];
          const matchedAsset = rows
            .filter(isRecord)
            .find((row) => pickVehicleNumber(row) === selectedItem.vehicleNumber);
          assetId = pickString(matchedAsset ?? {}, ['id', 'vin']) ?? '';
          if (!assetId && matchedAsset) {
            setRelatedContextPayload(matchedAsset);
            return;
          }
        }
        if (!assetId) {
          throw new Error('연결된 차량 자산을 찾을 수 없습니다.');
        }
        const payload = await getAssetDetail(assetId);
        setRelatedContextPayload(payload);
        return;
      }

      if (kind === 'claim') {
        if (!selectedItem.reservationId) {
          throw new Error('연결된 예약 정보를 찾을 수 없습니다.');
        }
        const payload = await getAccidentClaim(selectedItem.reservationId);
        setRelatedContextPayload(payload);
      }
    } catch (error) {
      setRelatedContextError(error instanceof ApiError || error instanceof Error
        ? error.message
        : '상세 정보를 불러오지 못했습니다.');
    } finally {
      setIsRelatedContextLoading(false);
    }
  }, [issueAsset, selectedItem]);

  const toggleFilter = (filter: ActionIssueFilter) => {
    setPage(1);
    setSelectedSubCategory('all');
    setSelectedFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((entry) => entry !== filter)
        : [...prev, filter],
    );
  };
  const activeSingleCategory = selectedFilters.length === 1 ? selectedFilters[0] : null;
  const visibleSubCategoryOptions = activeSingleCategory
    ? ACTION_SUBCATEGORIES_BY_CATEGORY[activeSingleCategory] ?? []
    : [];

  const filteredItems = allItems.filter((item) => {
    const matchesFilter = selectedFilters.length === 0 || selectedFilters.includes(item.type);
    const matchesSubCategory = selectedSubCategory === 'all' || item.subCategory === selectedSubCategory;
    const matchesSearch = searchQuery === ''
      || item.vehicleNumber.includes(searchQuery)
      || item.customerName.includes(searchQuery)
      || (item.reservationId ?? '').includes(searchQuery);
    return matchesFilter && matchesSubCategory && matchesSearch;
  });

  const isUnpaidFilterActive = selectedFilters.includes('정산/수납');
  const totalFilteredItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredItems / pageSize));
  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High':
        return 'bg-red-100 text-red-700';
      case 'Medium':
        return 'bg-orange-100 text-orange-700';
      case 'Low':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPaymentStatusBadgeColor = (paymentStatusLabel: string | undefined): string => {
    if (!paymentStatusLabel) {
      return 'bg-gray-100 text-gray-600';
    }
    if (paymentStatusLabel === '미납') {
      return 'bg-red-100 text-red-700';
    }
    if (paymentStatusLabel === '부분납부') {
      return 'bg-amber-100 text-amber-700';
    }
    if (paymentStatusLabel === '완료') {
      return 'bg-green-100 text-green-700';
    }
    if (paymentStatusLabel === '대기') {
      return 'bg-blue-100 text-blue-700';
    }
    if (paymentStatusLabel === '결제정보 없음') {
      return 'bg-gray-100 text-gray-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = [...filteredItems].sort((left, right) => {
    if (!sortField) return 0;
    const leftValue = left[sortField];
    const rightValue = right[sortField];
    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return sortDirection === 'asc'
        ? leftValue.localeCompare(rightValue, 'ko')
        : rightValue.localeCompare(leftValue, 'ko');
    }
    return 0;
  });
  const pagedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const applyOptimisticActionPatch = (
    actionId: string,
    patch: Partial<ActionItem>,
    shouldRemoveFromList: boolean,
  ) => {
    setSelectedItem((prev) => {
      if (!prev || prev.id !== actionId) {
        return prev;
      }
      return {
        ...prev,
        ...patch,
      };
    });

    setSourceActionItems((prev) => {
      if (shouldRemoveFromList) {
        return prev.filter((item) => item.id !== actionId);
      }
      return prev.map((item) => (item.id === actionId ? { ...item, ...patch } : item));
    });

    if (shouldRemoveFromList) {
      setTotalItems((prev) => Math.max(0, prev - 1));
    }
  };

  async function runStatusUpdate(
    actionId: string,
    nextStatusCode: ActionStatusCode,
    kind: 'status' | 'resolve',
  ): Promise<void> {
    if (!canWriteActionRequired) {
      setWriteError({
        kind,
        message: '권한이 없어 상태를 변경할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    if (isWriteSaving) {
      return;
    }

    const targetItem = selectedItem?.id === actionId
      ? selectedItem
      : sourceActionItems.find((item) => item.id === actionId);
    if (!targetItem) {
      return;
    }

    const previousSelectedItem = targetItem;
    const previousCurrentStatus = currentStatus;
    const optimisticSnapshot: OptimisticActionSnapshot = {
      selectedItem,
      sourceActionItems,
      totalItems,
    };

    clearWriteFeedback();

    const nextStatusLabel = toStatusLabel(nextStatusCode);
    const shouldRemoveFromList = !matchesVisibleStatusFilters(nextStatusCode, statusFilter, includeCompleted);
    const selectedAssignee = assigneeOptions.find((option) => option.userId === currentAssigneeId);
    const existingAssignee = targetItem.assignee && targetItem.assignee !== '-' ? targetItem.assignee : undefined;
    const optimisticAssignee = selectedAssignee?.name ?? existingAssignee;
    const shouldAutoAssignActor = !currentAssigneeId && (!targetItem.assignee || targetItem.assignee === '-');
    const fallbackActorAssignee = shouldAutoAssignActor ? (user?.name ?? user?.email ?? user?.userId ?? undefined) : undefined;
    const fallbackActorAssigneeId = shouldAutoAssignActor ? (user?.userId ?? user?.email ?? undefined) : undefined;
    applyOptimisticActionPatch(
      actionId,
      {
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        ...(optimisticAssignee ? { assignee: optimisticAssignee, assigneeId: currentAssigneeId } : {}),
        ...(fallbackActorAssignee ? { assignee: fallbackActorAssignee, assigneeId: fallbackActorAssigneeId } : {}),
      },
      shouldRemoveFromList,
    );
    setCurrentStatus(nextStatusLabel);

    if (kind === 'resolve') {
      setIsResolveSaving(true);
    } else {
      setIsStatusSaving(true);
    }

    try {
      await patchActionRequiredStatus(actionId, {
        status: toStatusPatchValue(nextStatusCode),
      });
      setCurrentStatus('');
      setWriteNotice(
        shouldRemoveFromList
          ? '상태 변경으로 현재 필터 결과에서 제외되었습니다.'
          : kind === 'resolve'
            ? '이슈를 해결 완료로 저장했습니다.'
            : '상태를 저장했습니다.',
      );
      retryActionRef.current = null;

      const fallbackItem: ActionItem = {
        ...targetItem,
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        ...(optimisticAssignee ? { assignee: optimisticAssignee, assigneeId: currentAssigneeId } : {}),
        ...(fallbackActorAssignee ? { assignee: fallbackActorAssignee, assigneeId: fallbackActorAssigneeId } : {}),
      };
      void hydrateActionItems();
      void hydrateActionDetail(actionId, fallbackItem);
    } catch (error) {
      setCurrentStatus(previousCurrentStatus);
      restoreOptimisticActionSnapshot(optimisticSnapshot);

      const mappedError = toActionWriteError(kind, error);
      setWriteError(mappedError);

      if (mappedError.retryable) {
        retryActionRef.current = () => runStatusUpdate(actionId, nextStatusCode, kind);
      } else {
        retryActionRef.current = null;
      }

      void hydrateActionItems();
      void hydrateActionDetail(actionId, previousSelectedItem);
    } finally {
      if (kind === 'resolve') {
        setIsResolveSaving(false);
      } else {
        setIsStatusSaving(false);
      }
    }
  }

  async function uploadPaymentEvidenceFile(reservationId: string, file: File) {
    const contentType = file.type || 'application/octet-stream';
    const signedUpload = await signAssetUpload({
      fileName: file.name,
      contentType,
      folder: `rentals/${reservationId}/payments`,
      fileSize: file.size,
    });
    await uploadFileToSignedUrl(signedUpload.uploadUrl, file, signedUpload.contentType || contentType);
    return {
      objectName: signedUpload.objectName,
      fileName: file.name,
      contentType: signedUpload.contentType || contentType,
      attachedAt: new Date().toISOString(),
    };
  }

  const openPaymentIssueConfirmation = useCallback((item: ActionItem, nextStatus: 'paid' | 'canceled') => {
    const amount = getActionItemPaymentAmount(item);
    setPaymentIssueResolveDialog(null);
    setPendingPaymentConfirmation({
      kind: 'payment-issue',
      item,
      nextStatus,
      title: nextStatus === 'paid' ? '결제 완료 처리하시겠습니까?' : '결제 면제 처리하시겠습니까?',
      description: nextStatus === 'paid'
        ? `${formatCurrencyValue(amount)}을 수납 완료로 기록합니다. 처리 후 이슈 완료를 함께 시도합니다.`
        : `${formatCurrencyValue(amount)}을 면제 처리합니다. 처리 후 이슈 완료를 함께 시도합니다.`,
      confirmLabel: nextStatus === 'paid' ? '결제 완료 처리' : '결제 면제 처리',
    });
  }, []);

  const openWorkChargeSettlementConfirmation = useCallback((
    item: ActionItem,
    charge: ActionItemWorkChargeItem,
    mode: 'paid' | 'waived' | 'refunded',
  ) => {
    const fallbackAmount = Math.max(charge.remainingAmount || charge.amount || 0, 0);
    const refundAmount = toPaymentAmountFromInput(refundAmountDraft) || fallbackAmount;
    const amount = mode === 'refunded' ? refundAmount : fallbackAmount;
    const title = mode === 'refunded'
      ? '환불 완료 처리하시겠습니까?'
      : mode === 'waived'
        ? '청구 항목을 면제 처리하시겠습니까?'
        : '청구 항목을 수납 완료 처리하시겠습니까?';
    const confirmLabel = mode === 'refunded'
      ? '환불 완료 처리'
      : mode === 'waived'
        ? '면제 처리'
        : '수납 완료 처리';
    const description = mode === 'waived'
      ? `${charge.description || getSettlementChargeLabel(item)} 항목을 면제 처리합니다. 처리 후 이슈 완료를 함께 시도합니다.`
      : `${charge.description || getSettlementChargeLabel(item)} ${formatCurrencyValue(amount)}을 ${mode === 'refunded' ? '환불 완료' : '수납 완료'}로 기록합니다. 처리 후 이슈 완료를 함께 시도합니다.`;

    setPendingPaymentConfirmation({
      kind: 'work-charge',
      item,
      charge,
      mode,
      title,
      description,
      confirmLabel,
    });
  }, [refundAmountDraft]);

  async function runPaymentIssueResolution(
    item: ActionItem,
    nextStatus: 'paid' | 'canceled',
  ): Promise<void> {
    if (!canWritePayments) {
      setWriteError({
        kind: 'resolve',
        message: '권한이 없어 결제 상태를 변경할 수 없습니다.',
        retryable: false,
      });
      return;
    }
    const paymentId = getActionItemPaymentMutationId(item);
    const reservationId = getActionItemReservationId(item);
    const hasLedgerChargeContext = toWorkChargeItems(item.workContext).length > 0;
    if (!paymentId && !item.relatedChargeItemId && hasLedgerChargeContext) {
      setWriteError({
        kind: 'resolve',
        message: '청구 항목 기반 이슈입니다. 연결된 청구 항목을 확인한 뒤 청구 원장에서 처리해 주세요.',
        retryable: false,
      });
      return;
    }
    if (!paymentId && !item.relatedChargeItemId) {
      setWriteError({
        kind: 'resolve',
        message: '결제 정보를 찾을 수 없어 상태를 변경할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    setIsResolveSaving(true);
    setWriteError(null);
    setWriteNotice(null);
    try {
      if (item.relatedChargeItemId && reservationId) {
        if (nextStatus === 'paid') {
          const amount = getActionItemPaymentAmount(item);
          const evidenceRefs = paymentEvidenceFile
            ? [await uploadPaymentEvidenceFile(reservationId, paymentEvidenceFile)]
            : undefined;
          await createReservationPaymentRecord(reservationId, {
            amount,
            method: paymentTypeDraft,
            payerType: 'customer',
            confirmationStatus: 'confirmed',
            allocations: [{ chargeItemId: item.relatedChargeItemId, amount }],
            evidenceRefs,
            memo: 'Action Required에서 수납 완료 처리',
          });
          setPaymentEvidenceFile(null);
        } else {
          await patchChargeItem(item.relatedChargeItemId, {
            status: 'waived',
            memo: 'Action Required에서 면제 처리',
          });
        }
        await patchActionRequiredStatus(item.id, {
          status: 'resolved',
        });
      } else if (hasLedgerChargeContext) {
        setWriteError({
          kind: 'resolve',
          message: '청구 항목 기반 이슈입니다. 연결된 청구 항목을 확인한 뒤 청구 원장에서 처리해 주세요.',
          retryable: false,
        });
        retryActionRef.current = null;
        return;
      } else if (paymentId) {
        await patchPaymentStatus(paymentId, {
          status: nextStatus,
          reservationId,
        });
      }
      invalidatePaymentStatusCache({
        reservationId,
        paymentId,
      });
      setPaymentIssueResolveDialog(null);
      setCurrentStatus('');
      setWriteNotice(nextStatus === 'paid' ? '결제를 완료 처리했습니다.' : '결제를 면제 처리했습니다.');
      retryActionRef.current = null;
      await hydrateActionItems();
      void hydrateActionDetail(item.id, item);
    } catch (error) {
      const mappedError = toActionWriteError('resolve', error);
      setWriteError(mappedError);
      if (mappedError.retryable) {
        retryActionRef.current = () => runPaymentIssueResolution(item, nextStatus);
      } else {
        retryActionRef.current = null;
      }
    } finally {
      setIsResolveSaving(false);
    }
  }

  async function runPaymentAdditionalAmountSave(item: ActionItem): Promise<void> {
    if (!canWritePayments) {
      setWriteError({
        kind: 'memo',
        message: '권한이 없어 추가 결제 금액을 저장할 수 없습니다.',
        retryable: false,
      });
      return;
    }
    if (isPaymentAmountSaving) {
      return;
    }

    const paymentId = getActionItemPaymentMutationId(item);
    const reservationId = getActionItemReservationId(item);
    if (!paymentId && !reservationId) {
      setWriteError({
        kind: 'memo',
        message: '결제 정보를 찾을 수 없어 금액을 저장할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    const amount = toPaymentAmountFromInput(paymentAmountDraft);
    setIsPaymentAmountSaving(true);
    setWriteError(null);
    setWriteNotice(null);
    try {
      if (reservationId && item.relatedChargeItemId) {
        await createReservationChargeItem(reservationId, {
          amount,
          chargeType: 'additional_fee',
          payerType: 'customer',
          status: 'overdue',
          memo: 'Action Required에서 추가 결제 금액 입력',
          adjustmentReason: 'manual-additional-payment',
        });
      } else if (paymentId) {
        await patchPaymentStatus(paymentId, {
          status: 'overdue',
          reservationId,
          additionalAmount: amount,
          force: true,
          forceReason: 'manual-additional-payment',
        });
      }
      invalidatePaymentStatusCache({
        reservationId,
        paymentId,
      });
      setWriteNotice('추가 결제 금액을 저장했습니다.');
      await hydrateActionItems();
      void hydrateActionDetail(item.id, item);
    } catch (error) {
      const mappedError = toActionWriteError('memo', error);
      setWriteError(mappedError);
    } finally {
      setIsPaymentAmountSaving(false);
    }
  }

  async function runPaymentTypeSave(item: ActionItem): Promise<void> {
    if (!canWritePayments) {
      setWriteError({
        kind: 'memo',
        message: '권한이 없어 결제 유형을 저장할 수 없습니다.',
        retryable: false,
      });
      return;
    }
    if (isPaymentTypeSaving) {
      return;
    }
    if (item.relatedChargeItemId) {
      setWriteError({
        kind: 'memo',
        message: '청구 항목 기반 이슈는 완료 처리 시 선택한 결제 유형으로 수납 기록을 생성합니다.',
        retryable: false,
      });
      return;
    }
    if (toWorkChargeItems(item.workContext).length > 0) {
      setWriteError({
        kind: 'memo',
        message: '청구 항목 기반 이슈입니다. 결제 유형 변경은 수납 처리 시 청구 원장에 반영해 주세요.',
        retryable: false,
      });
      return;
    }

    const paymentId = getActionItemPaymentMutationId(item);
    if (!paymentId) {
      setWriteError({
        kind: 'memo',
        message: '결제 정보를 찾을 수 없어 유형을 저장할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    const normalizedStatus = toCanonicalPaymentStatus(item.paymentInfo?.status ?? item.status);
    const status = normalizedStatus === 'paid'
      ? 'paid'
      : normalizedStatus === 'canceled'
        ? 'canceled'
        : normalizedStatus === 'partial'
          ? 'partial'
          : normalizedStatus === 'unpaid'
            ? 'overdue'
            : 'pending';

    setIsPaymentTypeSaving(true);
    setWriteError(null);
    setWriteNotice(null);
    try {
      await patchPaymentStatus(paymentId, {
        status,
        reservationId: item.reservationId ?? item.paymentInfo?.reservationId,
        method: paymentTypeDraft,
      });
      invalidatePaymentStatusCache({
        reservationId: item.reservationId ?? item.paymentInfo?.reservationId ?? null,
        paymentId,
      });
      setWriteNotice('결제 유형을 저장했습니다.');
      await hydrateActionItems();
      void hydrateActionDetail(item.id, item);
    } catch (error) {
      const mappedError = toActionWriteError('memo', error);
      setWriteError(mappedError);
    } finally {
      setIsPaymentTypeSaving(false);
    }
  }

  async function runAssigneeUpdate(actionId: string, nextAssigneeId: string): Promise<void> {
    if (!canWriteActionRequired) {
      setWriteError({
        kind: 'assignee',
        message: '권한이 없어 담당자를 변경할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    if (isWriteSaving) {
      return;
    }

    const targetItem = selectedItem?.id === actionId
      ? selectedItem
      : sourceActionItems.find((item) => item.id === actionId);
    if (!targetItem) {
      return;
    }

    const previousSelectedItem = targetItem;
    const previousCurrentAssigneeId = currentAssigneeId;
    const optimisticSnapshot: OptimisticActionSnapshot = {
      selectedItem,
      sourceActionItems,
      totalItems,
    };

    clearWriteFeedback();

    const nextAssignee = assigneeOptions.find((option) => option.userId === nextAssigneeId);
    applyOptimisticActionPatch(
      actionId,
      {
        assignee: nextAssignee?.name ?? '-',
        assigneeId: nextAssigneeId || undefined,
      },
      false,
    );
    setCurrentAssigneeId(nextAssigneeId);
    setIsAssigneeSaving(true);

    try {
      await patchActionRequiredStatus(actionId, {
        status: toStatusPatchValue(targetItem.statusCode),
        assignee: nextAssigneeId,
      });
      setWriteNotice(nextAssigneeId ? '담당자를 저장했습니다.' : '담당자를 해제했습니다.');
      retryActionRef.current = null;

      const fallbackItem: ActionItem = {
        ...targetItem,
        assignee: nextAssignee?.name ?? '-',
        assigneeId: nextAssigneeId || undefined,
      };
      void hydrateActionItems();
      void hydrateActionDetail(actionId, fallbackItem);
    } catch (error) {
      setCurrentAssigneeId(previousCurrentAssigneeId);
      restoreOptimisticActionSnapshot(optimisticSnapshot);

      const mappedError = toActionWriteError('assignee', error);
      setWriteError(mappedError);

      if (mappedError.retryable) {
        retryActionRef.current = () => runAssigneeUpdate(actionId, nextAssigneeId);
      } else {
        retryActionRef.current = null;
      }

      void hydrateActionItems();
      void hydrateActionDetail(actionId, previousSelectedItem);
    } finally {
      setIsAssigneeSaving(false);
    }
  }

  async function runMemoWrite(
    actionId: string,
    memoContent: string,
    nextStatusCode: ActionStatusCode,
  ): Promise<void> {
    if (!canWriteActionRequired) {
      setWriteError({
        kind: 'memo',
        message: '권한이 없어 메모를 저장할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    if (isWriteSaving) {
      return;
    }

    const targetItem = selectedItem?.id === actionId
      ? selectedItem
      : sourceActionItems.find((item) => item.id === actionId);
    if (!targetItem) {
      return;
    }

    const trimmedMemo = memoContent.trim();
    if (!trimmedMemo) {
      return;
    }

    const previousSelectedItem = targetItem;
    const previousCurrentStatus = currentStatus;
    const previousCurrentMemo = currentMemo;
    const optimisticSnapshot: OptimisticActionSnapshot = {
      selectedItem,
      sourceActionItems,
      totalItems,
    };

    clearWriteFeedback();

    const nextStatusLabel = toStatusLabel(nextStatusCode);
    const shouldRemoveFromList = !matchesVisibleStatusFilters(nextStatusCode, statusFilter, includeCompleted);
    const createdAt = new Date().toISOString();
    const createdMemo: MemoLog = {
      id: `memo-${Date.now()}`,
      content: trimmedMemo,
      timestamp: createdAt,
      author: user?.name ?? user?.userId ?? '-',
      status: normalizeMemoStatus(nextStatusLabel),
      statusLabel: nextStatusLabel,
      sortTimestamp: memoTimestampValue(createdAt),
      sortTimestampRaw: createdAt,
      sortSequence: Number.MAX_SAFE_INTEGER,
    };

    const selectedAssignee = assigneeOptions.find((option) => option.userId === currentAssigneeId);
    applyOptimisticActionPatch(
      actionId,
      {
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        memos: [createdMemo, ...(targetItem.memos ?? [])],
        ...(selectedAssignee ? { assignee: selectedAssignee.name, assigneeId: currentAssigneeId } : {}),
      },
      shouldRemoveFromList,
    );
    setCurrentStatus(nextStatusLabel);
    setIsMemoSaving(true);
    try {
      if (targetItem.statusCode !== nextStatusCode) {
        await patchActionRequiredStatus(actionId, {
          status: toStatusPatchValue(nextStatusCode),
        });
      }
      await patchActionRequiredMemo(actionId, { memo: trimmedMemo });

      setCurrentMemo('');
      setCurrentStatus('');
      setWriteNotice(
        shouldRemoveFromList
          ? '메모와 상태가 저장되어 현재 필터 결과에서 제외되었습니다.'
          : '메모를 저장했습니다.',
      );
      retryActionRef.current = null;

      const fallbackItem: ActionItem = {
        ...targetItem,
        status: nextStatusLabel,
        statusCode: nextStatusCode,
        memos: [createdMemo, ...(targetItem.memos ?? [])],
        ...(selectedAssignee ? { assignee: selectedAssignee.name, assigneeId: currentAssigneeId } : {}),
      };
      void hydrateActionItems();
      void hydrateActionDetail(actionId, fallbackItem);
    } catch (error) {
      setCurrentStatus(previousCurrentStatus);
      setCurrentMemo(previousCurrentMemo);
      restoreOptimisticActionSnapshot(optimisticSnapshot);

      const mappedError = toActionWriteError('memo', error);
      setWriteError(mappedError);

      if (mappedError.retryable) {
        retryActionRef.current = () => runMemoWrite(actionId, memoContent, nextStatusCode);
      } else {
        retryActionRef.current = null;
      }

      void hydrateActionItems();
      void hydrateActionDetail(actionId, previousSelectedItem);
    } finally {
      setIsMemoSaving(false);
    }
  }

  const handleStatusSave = () => {
    if (!selectedItem) {
      return;
    }
    const nextStatusCode = normalizeStatusCode(currentStatus || selectedItem.status);
    if (nextStatusCode === selectedItem.statusCode) {
      setWriteError(null);
      setWriteNotice('변경된 상태가 없습니다.');
      retryActionRef.current = null;
      return;
    }
    const issueAssetKind = getIssueAssetKind(selectedItem);
    if (issueAssetKind && nextStatusCode === 'resolved') {
      const blockedMessage = getIssueResolveBlockMessage(selectedItem, issueAsset);
      if (blockedMessage) {
        setCurrentStatus('');
        setIssueAssetPrompt({
          mode: 'blocked',
          kind: issueAssetKind,
          message: blockedMessage,
        });
        return;
      }
    }
    if (handlePaymentIssueStatusIntent(selectedItem, nextStatusCode)) {
      return;
    }
    if (handleLateReturnStatusIntent(selectedItem, nextStatusCode)) {
      return;
    }
    void runStatusUpdate(selectedItem.id, nextStatusCode, 'status');
  };

  const handleMemoAdd = () => {
    if (!selectedItem) {
      return;
    }
    const memoContent = currentMemo.trim();
    if (!memoContent) {
      return;
    }
    const nextStatusCode = normalizeStatusCode(currentStatus || selectedItem.status);
    if (isPaymentActionItem(selectedItem) && nextStatusCode === 'resolved') {
      setPaymentIssueResolveDialog('choose-payment-resolution');
      return;
    }
    void runMemoWrite(selectedItem.id, memoContent, nextStatusCode);
  };

  const handleResolveIssue = () => {
    if (!selectedItem || isWriteSaving) {
      return;
    }

    if (isPaymentActionItem(selectedItem)) {
      setPaymentIssueResolveDialog('choose-payment-resolution');
      return;
    }

    const issueAssetKind = getIssueAssetKind(selectedItem);
    if (issueAssetKind) {
      const blockedMessage = getIssueResolveBlockMessage(selectedItem, issueAsset);
      if (blockedMessage) {
        setIssueAssetPrompt({
          mode: 'blocked',
          kind: issueAssetKind,
          message: blockedMessage,
        });
        return;
      }
    }

    if (isLateReturnActionItem(selectedItem)) {
      setLateReturnResolveDialog('confirm-returned');
      return;
    }

    void runStatusUpdate(selectedItem.id, 'resolved', 'resolve');
  };

  const handleLateReturnStatusIntent = (item: ActionItem, nextStatusCode: ActionStatusCode) => {
    if (nextStatusCode === 'resolved' && isLateReturnActionItem(item)) {
      setLateReturnResolveDialog('confirm-returned');
      return true;
    }
    return false;
  };

  const handlePaymentIssueStatusIntent = (item: ActionItem, nextStatusCode: ActionStatusCode) => {
    if (nextStatusCode === 'resolved' && isPaymentActionItem(item)) {
      setPaymentIssueResolveDialog('choose-payment-resolution');
      return true;
    }
    return false;
  };

  const handleLateReturnResolveConfirm = useCallback(async () => {
    if (!isLateReturnActionItem(selectedItem) || isWriteSaving) {
      return;
    }
    if (!canWriteActionRequired) {
      setWriteError({
        kind: 'resolve',
        message: '권한이 없어 이슈를 해결 처리할 수 없습니다.',
        retryable: false,
      });
      return;
    }
    if (!selectedItem.reservationId) {
      setLateReturnResolveDialog(null);
      setWriteError({
        kind: 'resolve',
        message: '연결된 예약 정보를 찾을 수 없어 차량 반납을 함께 처리할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    const targetItem = selectedItem;
    setIsResolveSaving(true);
    setWriteError(null);
    setWriteNotice(null);

    try {
      const reservationPayload = await getReservationDetail(targetItem.reservationId);
      const reservationSource = isRecord(reservationPayload)
        ? (reservationPayload.data ?? reservationPayload.reservation ?? reservationPayload.item ?? reservationPayload)
        : reservationPayload;
      const reservationStatus = isRecord(reservationSource)
        ? normalizeReservationContractStatus(pickString(reservationSource, ['contractStatus', 'status', 'type']))
        : null;

      if (reservationStatus !== '완료') {
        await returnReservation(targetItem.reservationId, {
          returnedAt: new Date().toISOString(),
        });
      }

      await patchActionRequiredStatus(targetItem.id, {
        status: toStatusPatchValue('resolved'),
      });

      setLateReturnResolveDialog(null);
      setCurrentStatus('');
      setWriteNotice('이슈를 완료 처리하고 차량도 반납 처리했습니다.');
      retryActionRef.current = null;

      const fallbackItem: ActionItem = {
        ...targetItem,
        status: '완료',
        statusCode: 'resolved',
      };
      await hydrateActionItems();
      void hydrateActionDetail(targetItem.id, fallbackItem);
    } catch (error) {
      const mappedError = toActionWriteError('resolve', error);
      setWriteError(mappedError);
      if (mappedError.retryable) {
        retryActionRef.current = () => handleLateReturnResolveConfirm();
      } else {
        retryActionRef.current = null;
      }
    } finally {
      setIsResolveSaving(false);
    }
  }, [canWriteActionRequired, hydrateActionDetail, hydrateActionItems, isWriteSaving, selectedItem]);

  const executeIssueAssetSave = useCallback(async (
    payload: {
      version: number;
      insuranceExpiry?: string | null;
      nextInspection?: string | null;
      insuranceDocObjectName?: string | null;
      inspectionDocObjectName?: string | null;
    },
    kind: IssueAssetKind,
  ) => {
    if (!issueAsset) {
      return;
    }

    setIsIssueAssetSaving(true);
    setIssueAssetError(null);
    setIssueAssetNotice(null);

    try {
      const previousInsuranceExpiry = issueAsset.insuranceExpiry || '-';
      const previousInspectionDate = issueAsset.nextInspection || '-';
      let uploadedFileName: string | null = null;
      if (issueAssetFile) {
        const contentType = resolveActionRequiredDocumentContentType(issueAssetFile);
        const signedUpload = await signAssetUpload({
          fileName: issueAssetFile.name,
          folder: `assets/${issueAsset.id}/${kind}`,
          contentType,
          fileSize: issueAssetFile.size,
        });
        await uploadFileToSignedUrl(signedUpload.uploadUrl, issueAssetFile, signedUpload.contentType || contentType);
        uploadedFileName = issueAssetFile.name;
        if (kind === 'insurance') {
          payload.insuranceDocObjectName = signedUpload.objectName;
        } else {
          payload.inspectionDocObjectName = signedUpload.objectName;
        }
      }
      await patchAsset(issueAsset.id, payload);
      if (uploadedFileName && selectedItem?.id) {
        try {
          await patchActionRequiredMemo(selectedItem.id, {
            memo: `${kind === 'insurance' ? '보험 가입 증서' : '자동차종합검사표'} 업로드: ${uploadedFileName}`,
          });
        } catch {
          // Keep asset update successful even when memo logging fails.
        }
      }
      if (kind === 'insurance' && selectedItem?.id && payload.insuranceExpiry) {
        const nextInsuranceExpiry = payload.insuranceExpiry || '-';
        if (previousInsuranceExpiry !== nextInsuranceExpiry) {
          try {
            await patchActionRequiredMemo(selectedItem.id, {
              memo: `보험만료일 업데이트: ${previousInsuranceExpiry} -> ${nextInsuranceExpiry}`,
            });
          } catch {
            // Keep asset update successful even when memo logging fails.
          }
        }
      }
      if (kind === 'inspection' && selectedItem?.id && payload.nextInspection) {
        const nextInspectionDate = payload.nextInspection || '-';
        if (previousInspectionDate !== nextInspectionDate) {
          try {
            await patchActionRequiredMemo(selectedItem.id, {
              memo: `정기점검일 업데이트: ${previousInspectionDate} -> ${nextInspectionDate}`,
            });
          } catch {
            // Keep asset update successful even when memo logging fails.
          }
        }
      }
      setIssueAsset((previousIssueAsset) => {
        if (!previousIssueAsset) {
          return previousIssueAsset;
        }
        return {
          ...previousIssueAsset,
          insuranceExpiry: payload.insuranceExpiry ?? previousIssueAsset.insuranceExpiry,
          nextInspection: payload.nextInspection ?? previousIssueAsset.nextInspection,
          version: previousIssueAsset.version + 1,
        };
      });
      const nextInsuranceExpiry = payload.insuranceExpiry ?? issueAsset.insuranceExpiry;
      const nextInspectionDate = payload.nextInspection ?? issueAsset.nextInspection;
      const shouldReopenInsuranceIssue = Boolean(
        selectedItem
        && kind === 'insurance'
        && selectedItem.statusCode === 'resolved'
        && !isInsuranceIssueResolved(nextInsuranceExpiry),
      );
      const shouldReopenInspectionIssue = Boolean(
        selectedItem
        && kind === 'inspection'
        && selectedItem.statusCode === 'resolved'
        && !isInspectionIssueResolved(nextInspectionDate),
      );
      if (shouldReopenInsuranceIssue && selectedItem) {
        await patchActionRequiredStatus(selectedItem.id, {
          status: toStatusPatchValue('pending'),
        });
      }
      if (shouldReopenInspectionIssue && selectedItem) {
        await patchActionRequiredStatus(selectedItem.id, {
          status: toStatusPatchValue('pending'),
        });
      }

      let autoResolveMessage: string | null = null;
      if (
        selectedItem
        && selectedItem.statusCode !== 'resolved'
        && kind === 'insurance'
        && isInsuranceIssueResolved(nextInsuranceExpiry)
      ) {
        autoResolveMessage = '보험 만료 임박 이슈가 해소되었습니다.';
      }
      if (
        selectedItem
        && selectedItem.statusCode !== 'resolved'
        && kind === 'inspection'
        && isInspectionIssueResolved(nextInspectionDate)
      ) {
        autoResolveMessage = '정기점검 만료 임박 이슈가 해소되었습니다.';
      }
      if (autoResolveMessage && selectedItem) {
        await patchActionRequiredStatus(selectedItem.id, {
          status: toStatusPatchValue('resolved'),
        });
        setIssueAssetPrompt({
          mode: 'completed',
          kind,
          message: autoResolveMessage,
        });
      }
      await hydrateActionItems();
      if (selectedItem) {
        void hydrateActionDetail(selectedItem.id, selectedItem);
      }
      setIssueAssetNotice(
        shouldReopenInsuranceIssue || shouldReopenInspectionIssue
          ? '차량 정보가 저장되었습니다. 이슈 상태와 심각도를 다시 반영했습니다.'
          : '차량 정보가 저장되었습니다.'
      );
      setIssueAssetFile(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setIssueAssetError(error.message || '차량 정보 저장에 실패했습니다.');
        return;
      }
      setIssueAssetError('차량 정보 저장에 실패했습니다.');
    } finally {
      setIsIssueAssetSaving(false);
    }
  }, [hydrateActionDetail, hydrateActionItems, issueAsset, issueAssetFile, selectedItem]);

  const handleIssueAssetSave = useCallback(() => {
    const kind = getIssueAssetKind(selectedItem);
    if (!selectedItem || !kind) {
      return;
    }
    if (!issueAsset) {
      setIssueAssetError('연결된 차량 자산을 찾을 수 없습니다.');
      return;
    }

    const nextDate = issueAssetDate.trim();
    if (!nextDate) {
      setIssueAssetError(kind === 'insurance' ? '보험 만료일을 입력해 주세요.' : '다음 정기점검일을 입력해 주세요.');
      return;
    }

    const previousDate = kind === 'insurance' ? issueAsset.insuranceExpiry : issueAsset.nextInspection;
    const payload = kind === 'insurance'
      ? { version: issueAsset.version, insuranceExpiry: nextDate }
      : { version: issueAsset.version, nextInspection: nextDate };

    if (!isStrictlyLaterDate(nextDate, previousDate)) {
      setIssueAssetPrompt({
        mode: 'invalid',
        kind,
        message: kind === 'insurance' ? '보험 만료일자가 유효하지 않습니다.' : '정기점검 일자가 유효하지 않습니다.',
        payload,
      });
      return;
    }

    void executeIssueAssetSave(payload, kind);
  }, [executeIssueAssetSave, issueAsset, issueAssetDate, selectedItem]);

  const tryResolveCurrentActionItem = useCallback(async (
    item: ActionItem,
    options: {
      notice: string;
      errorSetter?: (message: string) => void;
    },
  ): Promise<boolean> => {
    const { notice, errorSetter } = options;
    if (item.statusCode === 'resolved') {
      return true;
    }
    try {
      await patchActionRequiredStatus(item.id, {
        status: toStatusPatchValue('resolved'),
      });
      setWriteNotice(notice);
      return true;
    } catch (error) {
      const mappedError = toActionWriteError('resolve', error);
      const detailText = mappedError.fields && mappedError.fields.length > 0
        ? ` (${mappedError.fields.map((field) => [field.name, field.reason].filter(Boolean).join(': ')).filter(Boolean).join(', ')})`
        : '';
      if (errorSetter) {
        errorSetter(`${mappedError.message}${detailText}`);
      } else {
        setWriteError(mappedError);
      }
      return false;
    }
  }, []);

  const runOperationalDomainAction = useCallback(async (item: ActionItem, action: string, label: string) => {
    if (!selectedItemCapabilities.canUseOperationalDomainActions || isDomainActionSaving) {
      return;
    }
    setIsDomainActionSaving(true);
    setWriteError(null);
    setWriteNotice(null);
    try {
      await runActionRequiredDomainAction(item.id, {
        action,
        memo: label,
      });
      setWriteNotice(`${label} 액션을 저장했습니다.`);
      await hydrateActionItems();
      void hydrateActionDetail(item.id, item);
    } catch (error) {
      setWriteError(toActionWriteError('resolve', error));
    } finally {
      setIsDomainActionSaving(false);
    }
  }, [hydrateActionDetail, hydrateActionItems, isDomainActionSaving, selectedItemCapabilities.canUseOperationalDomainActions]);

  const runWorkChargeSettlement = useCallback(async (
    item: ActionItem,
    charge: ActionItemWorkChargeItem,
    mode: 'paid' | 'waived' | 'refunded',
  ) => {
    if (!canWritePayments) {
      setWriteError({
        kind: 'resolve',
        message: '권한이 없어 청구/환불 항목을 변경할 수 없습니다.',
        retryable: false,
      });
      return;
    }
    const reservationId = getActionItemReservationId(item);
    if (!reservationId || !charge.id) {
      setWriteError({
        kind: 'resolve',
        message: '연결된 예약 또는 청구 항목을 찾을 수 없습니다.',
        retryable: false,
      });
      return;
    }
    const fallbackAmount = Math.max(charge.remainingAmount || charge.amount || 0, 0);
    const refundAmount = toPaymentAmountFromInput(refundAmountDraft) || fallbackAmount;
    const amount = mode === 'refunded' ? refundAmount : fallbackAmount;
    if (amount <= 0 && mode !== 'waived') {
      setWriteError({
        kind: 'resolve',
        message: '처리할 금액을 확인할 수 없습니다.',
        retryable: false,
      });
      return;
    }

    setIsWorkActionSaving(true);
    setWriteError(null);
    setWriteNotice(null);
    try {
      if (mode === 'paid') {
        const evidenceRefs = paymentEvidenceFile
          ? [await uploadPaymentEvidenceFile(reservationId, paymentEvidenceFile)]
          : undefined;
        await createReservationPaymentRecord(reservationId, {
          amount,
          method: paymentTypeDraft,
          payerType: charge.payerType || 'customer',
          confirmationStatus: 'confirmed',
          allocations: [{ chargeItemId: charge.id, amount }],
          evidenceRefs,
          memo: 'Action Required에서 청구 항목 수납 완료 처리',
        });
        setPaymentEvidenceFile(null);
      } else if (mode === 'refunded') {
        const evidenceRefs = refundEvidenceFile
          ? [await uploadPaymentEvidenceFile(reservationId, refundEvidenceFile)]
          : undefined;
        await patchChargeItem(charge.id, {
          status: 'refunded',
          paidAmount: amount,
          refundCompletedAt: refundCompletedAtDraft || toDateInputValue(new Date().toISOString()),
          refundMethod: refundMethodDraft.trim() || '계좌이체',
          evidenceRefs,
          memo: refundMemoDraft.trim() || 'Action Required에서 환불 완료 처리',
        });
        setRefundEvidenceFile(null);
      } else {
        await patchChargeItem(charge.id, {
          status: 'waived',
          memo: 'Action Required에서 면제 처리',
        });
      }
      await tryResolveCurrentActionItem(item, {
        notice: mode === 'refunded'
          ? '환불 항목을 완료 처리하고 이슈 완료를 시도했습니다.'
          : '청구 항목을 정리하고 이슈 완료를 시도했습니다.',
      });
      await hydrateActionItems();
      void hydrateActionDetail(item.id, item);
    } catch (error) {
      setWriteError(toActionWriteError('resolve', error));
    } finally {
      setIsWorkActionSaving(false);
    }
  }, [
    canWritePayments,
    hydrateActionDetail,
    hydrateActionItems,
    paymentEvidenceFile,
    paymentTypeDraft,
    refundAmountDraft,
    refundCompletedAtDraft,
    refundEvidenceFile,
    refundMemoDraft,
    refundMethodDraft,
    tryResolveCurrentActionItem,
  ]);

  const confirmPendingPaymentAction = useCallback(() => {
    const pending = pendingPaymentConfirmation;
    if (!pending) {
      return;
    }
    setPendingPaymentConfirmation(null);
    if (pending.kind === 'payment-issue') {
      void runPaymentIssueResolution(pending.item, pending.nextStatus);
      return;
    }
    void runWorkChargeSettlement(pending.item, pending.charge, pending.mode);
  }, [pendingPaymentConfirmation, runPaymentIssueResolution, runWorkChargeSettlement]);

  const uploadAccidentClaimFiles = useCallback(async (
    reservationId: string,
    files: File[],
    folderName: string,
  ): Promise<string[]> => {
    const objectNames: string[] = [];
    for (const file of files) {
      const contentType = resolveActionRequiredDocumentContentType(file);
      const signedUpload = await signAssetUpload({
        fileName: file.name,
        folder: `accident-claims/${reservationId}/${folderName}`,
        contentType,
        fileSize: file.size,
      });
      await uploadFileToSignedUrl(signedUpload.uploadUrl, file, signedUpload.contentType || contentType);
      objectNames.push(signedUpload.objectName);
    }
    return objectNames;
  }, []);

  const runAccidentClaimAction = useCallback(async (action: 'save-info' | 'submit' | 'recognize') => {
    if (!selectedItem?.reservationId) {
      setAccidentClaimError('연결된 예약건을 찾을 수 없습니다.');
      return;
    }
    if (!selectedItemCapabilities.canUseAccidentClaimActions) {
      setAccidentClaimError('보험청구 정보를 변경할 권한이 없습니다.');
      return;
    }

    const reservationId = selectedItem.reservationId;
    const billedAmount = toPaymentAmountFromInput(accidentClaimDraft.billedAmount);
    const recognizedAmount = toPaymentAmountFromInput(accidentClaimDraft.recognizedAmount);
    setIsAccidentClaimSaving(true);
    setAccidentClaimError(null);
    setAccidentClaimNotice(null);
    try {
      if (action === 'save-info') {
        const uploadedApprovalDocuments = selectedItem.reasonType === 'accident_replacement_approval_required'
          ? await uploadAccidentClaimFiles(reservationId, accidentApprovalDocumentFiles, 'approval-documents')
          : [];
        const approvalDocumentObjectNames = [
          ...accidentClaimDraft.approvalDocumentObjectNames,
          ...uploadedApprovalDocuments,
        ].filter((value, index, values) => value && values.indexOf(value) === index);
        if (
          selectedItem.reasonType === 'accident_replacement_approval_required'
          && accidentClaimDraft.approvalStatus === 'rejected'
        ) {
          await rejectActionRequiredAccidentApproval(selectedItem.id, {
            approvalMemo: accidentClaimDraft.approvalMemo.trim(),
            approvalDocumentObjectNames,
            cancelReason: '대차 승인 반려',
          });
          setAccidentApprovalDocumentFiles([]);
          setAccidentClaimNotice('대차 승인 반려로 예약을 취소하고 관련 이슈를 정리했습니다.');
          await hydrateActionItems();
          void hydrateActionDetail(selectedItem.id, selectedItem);
          return;
        }
        await patchAccidentClaim(reservationId, {
          claimNo: accidentClaimDraft.claimNo.trim(),
          insurerName: accidentClaimDraft.insurerName.trim(),
          repairShopName: accidentClaimDraft.repairShopName.trim(),
          repairCompletedAt: accidentClaimDraft.repairCompletedAt || undefined,
          billingAccount: accidentClaimDraft.billingAccount.trim(),
          ...(selectedItem.reasonType === 'accident_replacement_approval_required'
            ? {
                approvalRequired: true,
                approvalStatus: accidentClaimDraft.approvalStatus,
                approvalDocumentObjectName: approvalDocumentObjectNames[0] ?? '',
                approvalDocumentObjectNames,
                approvalMemo: accidentClaimDraft.approvalMemo.trim(),
              }
            : {}),
          supplementMemo: accidentClaimDraft.supplementMemo.trim(),
          billedAmount,
          memo: 'Action Required에서 사고대차 접수 정보를 저장',
        });
        setAccidentApprovalDocumentFiles([]);
        setAccidentClaimNotice('사고대차 접수 정보를 저장했습니다.');
      } else if (action === 'submit') {
        const documentObjectNames = accidentClaimDocumentFile
          ? await uploadAccidentClaimFiles(reservationId, [accidentClaimDocumentFile], 'documents')
          : [];
        await submitAccidentClaim(reservationId, {
          billedAmount,
          billingAccount: accidentClaimDraft.billingAccount.trim(),
          supplementMemo: accidentClaimDraft.supplementMemo.trim(),
          ...(documentObjectNames.length > 0 ? { documentObjectNames } : {}),
          submittedAt: new Date().toISOString(),
          memo: 'Action Required에서 보험청구 제출 처리',
        });
        setAccidentClaimDocumentFile(null);
        setAccidentClaimNotice('보험청구 제출 처리했습니다.');
      } else {
        if (recognizedAmount <= 0) {
          setAccidentClaimError('보험 인정금액을 입력해 주세요.');
          return;
        }
        await recognizeAccidentClaim(reservationId, {
          recognizedAmount,
          differencePayerType: accidentClaimDraft.differencePayerType,
          billingAccount: accidentClaimDraft.billingAccount.trim(),
          supplementMemo: accidentClaimDraft.supplementMemo.trim(),
          memo: 'Action Required에서 보험금 입금 확인',
        });
        setAccidentClaimNotice('보험금 입금 정보를 저장했습니다.');
      }
      await tryResolveCurrentActionItem(selectedItem, {
        notice: '보험청구 정보를 저장하고 이슈 완료를 시도했습니다.',
        errorSetter: setAccidentClaimError,
      });
      await hydrateActionItems();
      void hydrateActionDetail(selectedItem.id, selectedItem);
    } catch (error) {
      setAccidentClaimError(error instanceof ApiError ? error.message : '보험청구 정보 저장에 실패했습니다.');
    } finally {
      setIsAccidentClaimSaving(false);
    }
  }, [accidentApprovalDocumentFiles, accidentClaimDocumentFile, accidentClaimDraft, hydrateActionDetail, hydrateActionItems, selectedItem, selectedItemCapabilities.canUseAccidentClaimActions, tryResolveCurrentActionItem, uploadAccidentClaimFiles]);

  const handleWorkContextAction = useCallback((actionKey: string, chargeItem?: ActionItemWorkChargeItem) => {
    if (!selectedItem) {
      return;
    }
    if (chargeItem) {
      if (actionKey === 'refund_complete') {
        openWorkChargeSettlementConfirmation(selectedItem, chargeItem, 'refunded');
        return;
      }
      if (actionKey === 'charge_paid') {
        openWorkChargeSettlementConfirmation(selectedItem, chargeItem, 'paid');
        return;
      }
      if (actionKey === 'charge_waive') {
        openWorkChargeSettlementConfirmation(selectedItem, chargeItem, 'waived');
        return;
      }
    }

    if (actionKey === 'payment_record_create') {
      openPaymentIssueConfirmation(selectedItem, 'paid');
      return;
    }
    if (actionKey === 'payment_waive') {
      openPaymentIssueConfirmation(selectedItem, 'canceled');
      return;
    }
    if (actionKey === 'refund_complete') {
      const refundCharge = toWorkChargeItems(selectedItem.workContext).find((charge) => isRefundChargeItem(charge) && !isWorkChargeSettled(charge));
      if (refundCharge) {
        openWorkChargeSettlementConfirmation(selectedItem, refundCharge, 'refunded');
      }
      return;
    }
    if (actionKey === 'closeout_settle') {
      const nextCharge = toWorkChargeItems(selectedItem.workContext).find((charge) => !isWorkChargeSettled(charge));
      if (nextCharge) {
        openWorkChargeSettlementConfirmation(selectedItem, nextCharge, isRefundChargeItem(nextCharge) ? 'refunded' : 'paid');
      }
      return;
    }
    if (actionKey === 'return_reservation') {
      handleLateReturnStatusIntent(selectedItem, 'resolved');
      return;
    }
    if (actionKey === 'status_update') {
      void runStatusUpdate(selectedItem.id, 'resolved', 'status');
      return;
    }
    if (actionKey === 'accident_claim_submit') {
      void runAccidentClaimAction('submit');
      return;
    }
    if (actionKey === 'accident_claim_recognize') {
      void runAccidentClaimAction('recognize');
      return;
    }
    const domainEntry = (OPERATIONAL_DOMAIN_ACTIONS[selectedItem.issueCode ?? ''] ?? []).find((entry) => entry.action === actionKey);
    if (domainEntry) {
      void runOperationalDomainAction(selectedItem, domainEntry.action, domainEntry.label);
    }
  }, [
    openPaymentIssueConfirmation,
    openWorkChargeSettlementConfirmation,
    runAccidentClaimAction,
    runOperationalDomainAction,
    selectedItem,
  ]);

  const runRentalAccidentFollowupSave = useCallback(async () => {
    if (!selectedItem?.reservationId) {
      setRentalAccidentError('연결된 예약건을 찾을 수 없습니다.');
      return;
    }
    if (!selectedItemCapabilities.canUseRentalAccidentActions) {
      setRentalAccidentError('사고 후속 정보를 변경할 권한이 없습니다.');
      return;
    }

    setIsRentalAccidentSaving(true);
    setRentalAccidentError(null);
    setRentalAccidentNotice(null);
    try {
      const accidentEvidenceDocuments = { ...rentalAccidentDraft.accidentEvidenceDocuments };
      for (const slot of RENTAL_ACCIDENT_EVIDENCE_SLOTS) {
        const file = rentalAccidentEvidenceFiles[slot.key];
        if (!file) {
          continue;
        }
        const contentType = resolveActionRequiredDocumentContentType(file);
        const signedUpload = await signAssetUpload({
          fileName: file.name,
          folder: `rental-accidents/${selectedItem.reservationId}/evidence/${slot.key}`,
          contentType,
          fileSize: file.size,
        });
        await uploadFileToSignedUrl(signedUpload.uploadUrl, file, signedUpload.contentType || contentType);
        accidentEvidenceDocuments[slot.key] = signedUpload.objectName;
      }
      await patchReservationAccidentFollowup(selectedItem.reservationId, {
        actionItemId: selectedItem.id,
        accidentLocation: rentalAccidentDraft.accidentLocation.trim(),
        opponentInfo: rentalAccidentDraft.opponentInfo.trim(),
        insuranceClaimNo: rentalAccidentDraft.insuranceClaimNo.trim(),
        evidenceStatus: rentalAccidentDraft.evidenceStatus,
        accidentEvidenceDocuments,
        insuranceProcessStatus: rentalAccidentDraft.insuranceProcessStatus,
        customerChargeAmount: toPaymentAmountFromInput(rentalAccidentDraft.customerChargeAmount),
        customerChargeStatus: rentalAccidentDraft.customerChargeStatus,
        memo: rentalAccidentDraft.memo.trim(),
      });
      setRentalAccidentDraft((prev) => ({ ...prev, accidentEvidenceDocuments }));
      setRentalAccidentEvidenceFiles({});
      setRentalAccidentNotice(isRentalAccidentIssueCompleteForMode(rentalAccidentIssueMode, rentalAccidentDraft)
        ? '사고 후속 정보를 저장하고 현재 단계 이력을 완료 처리했습니다.'
        : '사고 후속 정보를 저장했습니다.');
      await hydrateActionItems();
      void hydrateActionDetail(selectedItem.id, selectedItem);
    } catch (error) {
      setRentalAccidentError(error instanceof ApiError ? error.message : '사고 후속 정보 저장에 실패했습니다.');
    } finally {
      setIsRentalAccidentSaving(false);
    }
  }, [hydrateActionDetail, hydrateActionItems, rentalAccidentDraft, rentalAccidentEvidenceFiles, rentalAccidentIssueMode, selectedItem, selectedItemCapabilities.canUseRentalAccidentActions]);

  const runAccidentReplacementDriverSave = useCallback(async () => {
    if (!selectedItem?.reservationId) {
      setAccidentReplacementDriverError('연결된 예약건을 찾을 수 없습니다.');
      return;
    }
    if (!selectedItemCapabilities.canUseAccidentReplacementDriverActions) {
      setAccidentReplacementDriverError('운전자 정보를 변경할 권한이 없습니다.');
      return;
    }

    setIsAccidentReplacementDriverSaving(true);
    setAccidentReplacementDriverError(null);
    setAccidentReplacementDriverNotice(null);
    try {
      let licenseDocumentObjectName = accidentReplacementDriverDraft.licenseDocumentObjectName;
      if (accidentReplacementLicenseFile) {
        const contentType = resolveActionRequiredDocumentContentType(accidentReplacementLicenseFile);
        const signedUpload = await signAssetUpload({
          fileName: accidentReplacementLicenseFile.name,
          folder: `reservations/${selectedItem.reservationId}/documents`,
          contentType,
          fileSize: accidentReplacementLicenseFile.size,
        });
        await uploadFileToSignedUrl(signedUpload.uploadUrl, accidentReplacementLicenseFile, signedUpload.contentType || contentType);
        licenseDocumentObjectName = signedUpload.objectName;
      }

      await patchReservation(selectedItem.reservationId, {
        customerName: accidentReplacementDriverDraft.customerName.trim(),
        phone: accidentReplacementDriverDraft.phone.trim(),
        licenseNumber: accidentReplacementDriverDraft.licenseNumber.trim(),
        address: accidentReplacementDriverDraft.address.trim(),
        licenseDocumentObjectName,
        parties: {
          driver: {
            name: accidentReplacementDriverDraft.customerName.trim(),
            phone: accidentReplacementDriverDraft.phone.trim(),
            licenseNumber: accidentReplacementDriverDraft.licenseNumber.trim(),
            address: accidentReplacementDriverDraft.address.trim(),
            licenseDocumentObjectName,
          },
        },
        memo: 'Action Required에서 사고대차 운전자 정보를 저장',
      });
      setAccidentReplacementDriverDraft((prev) => ({ ...prev, licenseDocumentObjectName }));
      setAccidentReplacementLicenseFile(null);
      setAccidentReplacementDriverNotice('사고대차 운전자 정보를 저장했습니다.');
      await hydrateActionItems();
      void hydrateActionDetail(selectedItem.id, selectedItem);
    } catch (error) {
      setAccidentReplacementDriverError(error instanceof ApiError ? error.message : '운전자 정보 저장에 실패했습니다.');
    } finally {
      setIsAccidentReplacementDriverSaving(false);
    }
  }, [
    accidentReplacementDriverDraft,
    accidentReplacementLicenseFile,
    hydrateActionDetail,
    hydrateActionItems,
    selectedItem,
    selectedItemCapabilities.canUseAccidentReplacementDriverActions,
  ]);
  const isActionDetailDismissBlocked = (
    isWriteSaving
    || relatedContextKind !== null
    || Boolean(issueAssetPrompt)
    || lateReturnResolveDialog !== null
    || Boolean(pendingPaymentConfirmation)
    || paymentIssueResolveDialog !== null
    || accidentApprovalRejectConfirmOpen
    || Boolean(previewDocument)
  );
  const { handleBackdropMouseDown: handleActionDetailBackdropMouseDown } = useModalDismiss({
    isOpen: Boolean(selectedItem),
    onDismiss: handleCloseDetail,
    disabled: isActionDetailDismissBlocked,
  });
  const { handleBackdropMouseDown: handleIssueAssetPromptBackdropMouseDown } = useModalDismiss({
    isOpen: Boolean(issueAssetPrompt),
    onDismiss: () => setIssueAssetPrompt(null),
  });
  const { handleBackdropMouseDown: handleLateReturnResolveBackdropMouseDown } = useModalDismiss({
    isOpen: lateReturnResolveDialog !== null,
    onDismiss: () => setLateReturnResolveDialog(null),
    disabled: isResolveSaving,
  });
  const { handleBackdropMouseDown: handlePendingPaymentConfirmationBackdropMouseDown } = useModalDismiss({
    isOpen: Boolean(pendingPaymentConfirmation),
    onDismiss: () => setPendingPaymentConfirmation(null),
    disabled: isWriteSaving,
  });
  const { handleBackdropMouseDown: handlePaymentResolutionBackdropMouseDown } = useModalDismiss({
    isOpen: paymentIssueResolveDialog === 'choose-payment-resolution',
    onDismiss: () => setPaymentIssueResolveDialog(null),
    disabled: isResolveSaving,
  });
  const { handleBackdropMouseDown: handleAccidentRejectBackdropMouseDown } = useModalDismiss({
    isOpen: accidentApprovalRejectConfirmOpen,
    onDismiss: () => setAccidentApprovalRejectConfirmOpen(false),
    disabled: isAccidentClaimSaving,
  });
  const { handleBackdropMouseDown: handlePreviewDocumentBackdropMouseDown } = useModalDismiss({
    isOpen: Boolean(previewDocument),
    onDismiss: () => setPreviewDocument(null),
  });

  return (
    <Layout title="조치 필요 항목">
      <div className="p-6">
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="action-required-search-query"
                name="searchQuery"
                type="text"
                aria-label="차량번호 또는 고객명 검색"
                placeholder="차량번호 또는 고객명 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
          </div>

          <div className="flex flex-wrap gap-2">
            {ISSUE_FILTER_CHIPS.map((chip) => {
              const isSelected = selectedFilters.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleFilter(chip)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {chip}
                  {isSelected && <X className="inline-block ml-1 w-3 h-3" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setIncludeCompleted((prev) => !prev);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                includeCompleted
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              완료
              {includeCompleted && <X className="inline-block ml-1 w-3 h-3" />}
            </button>
          </div>

          {activeSingleCategory && visibleSubCategoryOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-600">상세 유형:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubCategory('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedSubCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {visibleSubCategoryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSelectedSubCategory(option);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedSubCategory === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <div>
              총 <span className="font-bold text-blue-600">{totalFilteredItems}</span>건의 조치 필요 항목
            </div>
          </div>

        </div>

        <PageStateBoundary
          isLoading={isItemsLoading}
          error={itemsError}
          isEmpty={!isItemsLoading && !itemsError && (isActionApiEmpty || totalFilteredItems === 0)}
          errorDescription="조치 필요 항목 목록을 불러오는 중 문제가 발생했습니다."
          emptyTitle="조건에 맞는 조치 항목이 없습니다"
          emptyDescription="필터나 검색어를 조정해 다시 확인해 주세요."
          onRetry={handleActionItemsRetry}
          errorActionLabel={getPageErrorActionLabel(itemsErrorKind)}
          onErrorAction={handleActionErrorAction}
          emptyActionLabel="필터 초기화"
          onEmptyAction={resetActionFilters}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                      유형
                      {sortField === 'type' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      상세 유형
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('vehicleNumber')}>
                      차량번호
                      {sortField === 'vehicleNumber' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('customerName')}>
                      고객명
                      {sortField === 'customerName' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>
                      발생일
                      {sortField === 'date' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    {isUnpaidFilterActive && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        미납금액
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('severity')}>
                      심각도
                      {sortField === 'severity' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                      상태
                      {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('assignee')}>
                      담당자
                      {sortField === 'assignee' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pagedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.subCategory ?? '-'}</td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assets?vehicle=${encodeURIComponent(item.vehicleNumber)}`);
                        }}
                      >
                        {item.vehicleNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatActionDateOnly(item.date)}</td>
                      {isUnpaidFilterActive && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {item.paymentInfo ? (
                            <span className="font-bold text-red-600">
                              {item.paymentInfo.totalAmount.toLocaleString()}원
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getDisplayedSeverity(item) === '-' ? (
                          <span className="text-sm text-gray-400">-</span>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.assignee}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleOpenDetail(item)}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(hasPrevPage || hasNextPage) && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                <p className="text-sm text-gray-600">
                  {`총 ${totalFilteredItems}건 · ${page} / ${totalPages} 페이지`}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={!hasPrevPage || isItemsLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={!hasNextPage || isItemsLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </PageStateBoundary>

        {selectedItem && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onMouseDown={handleActionDetailBackdropMouseDown}>
            <div className="h-full w-96 overflow-y-auto bg-white shadow-2xl">
              <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#1e2939]">상세 정보</h2>
                <button
                  onClick={handleCloseDetail}
                  disabled={isWriteSaving}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isDetailLoading && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  상세 데이터를 불러오는 중입니다.
                </div>
              )}

              {detailError && (
                <div className={`mb-4 p-3 rounded-lg text-sm border flex items-start gap-2 ${
                  isDetailNotFound
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {writeNotice && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {writeNotice}
                </div>
              )}

              {writeError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-2">
                      <p>{writeError.message}</p>
                      {writeError.fields && writeError.fields.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 text-xs">
                          {writeError.fields.map((field, index) => (
                            <li key={`${field.name ?? 'field'}-${index}`}>
                              {[field.name, field.reason].filter(Boolean).join(': ')}
                            </li>
                          ))}
                        </ul>
                      )}
                      {writeError.retryable && (
                        <button
                          type="button"
                          onClick={handleWriteRetry}
                          disabled={isWriteSaving}
                          className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          재시도
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">유형</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.type}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">상세 유형</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.subCategory ?? '-'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500">차량번호</label>
                    <p className="mt-1 text-sm font-bold text-gray-900">{selectedItem.vehicleNumber}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">고객명</label>
                    <p className="mt-1 text-sm font-bold text-gray-900">{selectedItem.customerName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">발생일</label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatActionDateOnly(selectedItem.date)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">심각도</label>
                    <p className="mt-1">
                      {getDisplayedSeverity(selectedItem) === '-' ? (
                        <span className="text-sm text-gray-400">-</span>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedItem.severity)}`}>
                          {selectedItem.severity}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {selectedItemDescription && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">상세 설명</label>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{selectedItemDescription}</p>
                  </div>
                )}

                {selectedItem.workContext
                  && !isPaymentActionItem(selectedItem)
                  && !isReturnFollowupActionItem(selectedItem)
                  && !isRentalAccidentActionItem(selectedItem)
                  && !isCompactAccidentClaimActionItem(selectedItem) && (
                  <div className="border-t border-gray-200 pt-4">
                    <WorkContextPanel
                      workContext={selectedItem.workContext}
                      onAction={handleWorkContextAction}
                      isSaving={isWriteSaving}
                    />
                  </div>
                )}

                {returnFollowupSummary && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="mb-3 block text-sm font-semibold text-gray-600">차량 반납/회수 확인</label>
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="rounded-lg bg-white px-4 py-3">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                            {returnFollowupIsRepairDone ? '수리완료 후 미반납' : '반납 지연'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-500">현재 필요한 조치</p>
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {returnFollowupIsRepairDone
                            ? '수리가 완료된 대차 차량의 실제 반납 여부를 확인합니다.'
                            : '대여 기간이 지난 차량의 실제 반납 여부를 확인합니다.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500">{returnFollowupIsRepairDone ? '수리완료일' : '반납 예정일'}</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {formatActionDateOnly(returnFollowupSummary.repairCompletedAt)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500">정비소</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {returnFollowupSummary.repairShopName}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500">반납 상태</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {getRelatedStatusLabel(returnFollowupSummary.returnStatus)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500">고객/차량</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {selectedItem.customerName} · {selectedItem.vehicleNumber}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLateReturnStatusIntent(selectedItem, 'resolved')}
                        disabled={isResolveSaving || isWriteSaving || !canWriteActionRequired}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isResolveSaving ? '처리 중...' : '반납 완료 처리'}
                      </button>
                    </div>
                  </div>
                )}

                {getIssueAssetKind(selectedItem) && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="mb-3 block text-sm font-semibold text-gray-600">
                      {getIssueAssetKind(selectedItem) === 'insurance' ? '보험 정보 업데이트' : '정기점검 정보 업데이트'}
                    </label>
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {isIssueAssetLoading && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          차량 자산 정보를 불러오는 중입니다.
                        </div>
                      )}
                      <FilePickerCard
                        label={getIssueAssetKind(selectedItem) === 'insurance' ? '보험 가입 증서' : '자동차종합검사표'}
                        buttonLabel={getIssueAssetKind(selectedItem) === 'insurance' ? '보험 가입 증서 선택' : '자동차종합검사표 선택'}
                        selectedFileNames={issueAssetFile ? [issueAssetFile.name] : []}
                        accept="image/*,application/pdf"
                        disabled={isIssueAssetSaving || isIssueAssetLoading}
                        onChange={(files) => setIssueAssetFile(files[0] ?? null)}
                      />
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                          {getIssueAssetKind(selectedItem) === 'insurance' ? '보험 만료일' : '다음 정기점검일'}
                        </label>
                        <DateTextPicker
                          value={issueAssetDate}
                          ariaLabel={getIssueAssetKind(selectedItem) === 'insurance' ? '보험 만료일' : '다음 정기점검일'}
                          onChange={(value) => {
                            setIssueAssetDate(value);
                            setIssueAssetError(null);
                            setIssueAssetNotice(null);
                          }}
                          disabled={isIssueAssetSaving || isIssueAssetLoading || !issueAsset}
                        />
                      </div>
                      {issueAssetError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {issueAssetError}
                        </div>
                      )}
                      {issueAssetNotice && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                          {issueAssetNotice}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleIssueAssetSave}
                        disabled={isIssueAssetSaving || isIssueAssetLoading || !issueAsset}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isIssueAssetSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedItemCapabilities.canUseOperationalDomainActions && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="mb-3 block text-sm font-semibold text-gray-600">도메인 조치</label>
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {groupOperationalDomainActions(OPERATIONAL_DOMAIN_ACTIONS[selectedItem.issueCode ?? ''] ?? []).map(([groupLabel, actions]) => (
                        <div key={groupLabel} className="space-y-2">
                          <p className={`text-xs font-semibold ${groupLabel === '위험 조치' ? 'text-red-700' : 'text-gray-600'}`}>
                            {groupLabel}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {actions.map((entry) => (
                              <button
                                key={entry.action}
                                type="button"
                                onClick={() => void runOperationalDomainAction(selectedItem, entry.action, entry.label)}
                                disabled={isDomainActionSaving || isWriteSaving}
                                className={getOperationalDomainActionButtonClassName(entry.tone)}
                              >
                                {isDomainActionSaving ? '저장 중...' : entry.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItemCapabilities.canUseRentalAccidentActions && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="mb-3 block text-sm font-semibold text-gray-600">
                      {getRentalAccidentPanelTitle(rentalAccidentIssueMode)}
                    </label>
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {isRentalAccidentLoading && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          사고 후속 정보를 불러오는 중입니다.
                        </div>
                      )}
                      <div className="rounded-lg bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500">현재 필요한 조치</p>
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {getRentalAccidentSummaryText(rentalAccidentIssueMode)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-orange-100 bg-orange-50 p-3 text-xs">
                        <div>
                          <p className="font-semibold text-orange-700">사고자료 상태</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">{getRelatedStatusLabel(rentalAccidentDraft.evidenceStatus)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-orange-700">보험처리 상태</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">{getRelatedStatusLabel(rentalAccidentDraft.insuranceProcessStatus)}</p>
                        </div>
                      </div>

                      {(rentalAccidentIssueMode === 'intake' || rentalAccidentIssueMode === 'insurance') && (
                        <div className="grid gap-2">
                          {rentalAccidentIssueMode === 'intake' && (
                            <>
                              {rentalAccidentDraft.registrationDescription && (
                                <div className="rounded-lg border border-orange-100 bg-white px-3 py-2">
                                  <p className="text-xs font-semibold text-orange-700">최초 사고 등록 메모</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                                    {rentalAccidentDraft.registrationDescription}
                                  </p>
                                </div>
                              )}
                              <input
                                type="text"
                                value={rentalAccidentDraft.accidentLocation}
                                onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, accidentLocation: event.target.value }))}
                                placeholder="사고 장소"
                                disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                              <input
                                type="text"
                                value={rentalAccidentDraft.opponentInfo}
                                onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, opponentInfo: event.target.value }))}
                                placeholder="상대방 정보"
                                disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </>
                          )}
                          <input
                            type="text"
                            value={rentalAccidentDraft.insuranceClaimNo}
                            onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, insuranceClaimNo: event.target.value }))}
                            placeholder="보험접수번호"
                            disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          {rentalAccidentIssueMode === 'insurance' && (
                            <select
                              value={rentalAccidentDraft.insuranceProcessStatus}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, insuranceProcessStatus: event.target.value }))}
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              <option value="reported">접수</option>
                              <option value="reviewing">심사중</option>
                              <option value="completed">처리완료</option>
                              <option value="customer_charge">고객부담 전환</option>
                            </select>
                          )}
                        </div>
                      )}

                      {rentalAccidentIssueMode === 'evidence' && (
                        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                          <select
                            value={rentalAccidentDraft.evidenceStatus}
                            onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, evidenceStatus: event.target.value }))}
                            disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="pending">자료 대기</option>
                            <option value="ready">자료 확보</option>
                            <option value="completed">확인 완료</option>
                            <option value="waived">자료 생략</option>
                          </select>
                          {RENTAL_ACCIDENT_EVIDENCE_SLOTS.map((slot) => {
                            const savedObjectName = rentalAccidentDraft.accidentEvidenceDocuments[slot.key];
                            const savedDetail = rentalAccidentDraft.accidentEvidenceDocumentDetails[slot.key];
                            const selectedFile = rentalAccidentEvidenceFiles[slot.key];
                            return (
                              <div key={slot.key}>
                                <FilePickerCard
                                  label={slot.label}
                                  buttonLabel={`${slot.label} 선택`}
                                  selectedFileNames={selectedFile ? [selectedFile.name] : []}
                                  savedLabel="업로드 문서 열기"
                                  savedDocuments={savedObjectName && savedDetail ? [savedDetail] : []}
                                  accept="image/*,application/pdf"
                                  disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                                  onChange={(files) => {
                                    const file = files[0] ?? null;
                                    setRentalAccidentEvidenceFiles((prev) => ({ ...prev, [slot.key]: file }));
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {rentalAccidentIssueMode !== 'evidence' && (
                        <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-gray-600">사고 증빙 자료</summary>
                          <div className="mt-3 space-y-2">
                            <select
                              value={rentalAccidentDraft.evidenceStatus}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, evidenceStatus: event.target.value }))}
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              <option value="pending">자료 대기</option>
                              <option value="ready">자료 확보</option>
                              <option value="completed">확인 완료</option>
                              <option value="waived">자료 생략</option>
                            </select>
                            {RENTAL_ACCIDENT_EVIDENCE_SLOTS.map((slot) => {
                              const savedObjectName = rentalAccidentDraft.accidentEvidenceDocuments[slot.key];
                              const savedDetail = rentalAccidentDraft.accidentEvidenceDocumentDetails[slot.key];
                              const selectedFile = rentalAccidentEvidenceFiles[slot.key];
                              return (
                                <div key={slot.key}>
                                  <FilePickerCard
                                    label={slot.label}
                                    buttonLabel={`${slot.label} 선택`}
                                    selectedFileNames={selectedFile ? [selectedFile.name] : []}
                                    savedLabel="업로드 문서 열기"
                                    savedDocuments={savedObjectName && savedDetail ? [savedDetail] : []}
                                    accept="image/*,application/pdf"
                                    disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                                    onChange={(files) => {
                                      const file = files[0] ?? null;
                                      setRentalAccidentEvidenceFiles((prev) => ({ ...prev, [slot.key]: file }));
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      {rentalAccidentIssueMode === 'evidence' && (
                        <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-gray-600">보험처리 정보</summary>
                          <div className="mt-3 grid gap-2">
                            <input
                              type="text"
                              value={rentalAccidentDraft.insuranceClaimNo}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, insuranceClaimNo: event.target.value }))}
                              placeholder="보험접수번호"
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <select
                              value={rentalAccidentDraft.insuranceProcessStatus}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, insuranceProcessStatus: event.target.value }))}
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              <option value="reported">접수</option>
                              <option value="reviewing">심사중</option>
                              <option value="completed">처리완료</option>
                              <option value="customer_charge">고객부담 전환</option>
                            </select>
                          </div>
                        </details>
                      )}

                      {rentalAccidentIssueMode !== 'intake' && (
                        <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-gray-600">사고 기본 정보</summary>
                          <div className="mt-3 grid gap-2">
                            <input
                              type="text"
                              value={rentalAccidentDraft.accidentLocation}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, accidentLocation: event.target.value }))}
                              placeholder="사고 장소"
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              value={rentalAccidentDraft.opponentInfo}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, opponentInfo: event.target.value }))}
                              placeholder="상대방 정보"
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </details>
                      )}

                      {shouldShowRentalAccidentCustomerCharge ? (
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-amber-200 bg-white p-3">
                          <input
                            type="text"
                            value={rentalAccidentDraft.customerChargeAmount}
                            onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, customerChargeAmount: event.target.value.replace(/[^\d]/g, '') }))}
                            placeholder="고객부담금"
                            inputMode="numeric"
                            disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
                          />
                          <select
                            value={rentalAccidentDraft.customerChargeStatus}
                            onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, customerChargeStatus: event.target.value }))}
                            disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                            className="rounded-lg border border-amber-200 px-3 py-2 text-sm"
                          >
                            <option value="none">없음</option>
                            <option value="pending">수납 예정</option>
                            <option value="due">수납 필요</option>
                            <option value="overdue">연체</option>
                            <option value="waived">면제</option>
                            <option value="paid">수납 완료</option>
                          </select>
                        </div>
                      ) : (
                        <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-gray-600">고객부담금</summary>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={rentalAccidentDraft.customerChargeAmount}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, customerChargeAmount: event.target.value.replace(/[^\d]/g, '') }))}
                              placeholder="고객부담금"
                              inputMode="numeric"
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <select
                              value={rentalAccidentDraft.customerChargeStatus}
                              onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, customerChargeStatus: event.target.value }))}
                              disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              <option value="none">없음</option>
                              <option value="pending">수납 예정</option>
                              <option value="due">수납 필요</option>
                              <option value="overdue">연체</option>
                              <option value="waived">면제</option>
                              <option value="paid">수납 완료</option>
                            </select>
                          </div>
                        </details>
                      )}

                      {rentalAccidentIssueMode !== 'insurance' && (
                        <textarea
                          rows={2}
                          value={rentalAccidentDraft.memo}
                          onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, memo: event.target.value }))}
                          placeholder="처리 메모"
                          disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}
                      {rentalAccidentIssueMode === 'insurance' && (
                        <textarea
                          rows={2}
                          value={rentalAccidentDraft.memo}
                          onChange={(event) => setRentalAccidentDraft((prev) => ({ ...prev, memo: event.target.value }))}
                          placeholder="보험처리 메모"
                          disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}
                      {rentalAccidentError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {rentalAccidentError}
                        </div>
                      )}
                      {rentalAccidentNotice && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                          {rentalAccidentNotice}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void runRentalAccidentFollowupSave()}
                        disabled={isRentalAccidentSaving || isRentalAccidentLoading}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getRentalAccidentSaveButtonLabel(rentalAccidentIssueMode)}
                      </button>
                    </div>
                  </div>
                )}

                {(selectedItemCapabilities.canUseAccidentClaimActions || selectedItemCapabilities.canUseAccidentReplacementDriverActions) && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="mb-3 block text-sm font-semibold text-gray-600">
                      {getAccidentClaimPanelTitle(selectedItem, selectedItemCapabilities.canUseAccidentReplacementDriverActions)}
                    </label>
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                      {selectedItemCapabilities.canUseAccidentReplacementDriverActions && (
                        <div className="space-y-3 rounded-lg border border-blue-100 bg-white p-3">
                          <label className="block text-sm font-semibold text-gray-600">입력 정보</label>
                          <p className="text-xs text-gray-500">운전자명, 연락처, 주소, 면허번호와 면허증 파일을 한 번에 보완하세요.</p>
                          {isAccidentReplacementDriverLoading && (
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              운전자 정보를 불러오는 중입니다.
                            </div>
                          )}
                          <div className="grid gap-2 md:grid-cols-2">
                            <input
                              type="text"
                              value={accidentReplacementDriverDraft.customerName}
                              onChange={(event) => setAccidentReplacementDriverDraft((prev) => ({ ...prev, customerName: event.target.value }))}
                              placeholder="실제 운전자명"
                              disabled={isAccidentReplacementDriverSaving || isAccidentReplacementDriverLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="tel"
                              value={accidentReplacementDriverDraft.phone}
                              onChange={(event) => setAccidentReplacementDriverDraft((prev) => ({ ...prev, phone: event.target.value }))}
                              placeholder="010-0000-0000"
                              disabled={isAccidentReplacementDriverSaving || isAccidentReplacementDriverLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              value={accidentReplacementDriverDraft.licenseNumber}
                              onChange={(event) => setAccidentReplacementDriverDraft((prev) => ({ ...prev, licenseNumber: event.target.value }))}
                              placeholder="면허번호 11-123456-78"
                              disabled={isAccidentReplacementDriverSaving || isAccidentReplacementDriverLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              value={accidentReplacementDriverDraft.address}
                              onChange={(event) => setAccidentReplacementDriverDraft((prev) => ({ ...prev, address: event.target.value }))}
                              placeholder="운전자 주소"
                              disabled={isAccidentReplacementDriverSaving || isAccidentReplacementDriverLoading}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <FilePickerCard
                            label="운전면허증 파일"
                            buttonLabel="운전면허증 파일 선택"
                            selectedFileNames={accidentReplacementLicenseFile ? [accidentReplacementLicenseFile.name] : []}
                            disabled={isAccidentReplacementDriverSaving || isAccidentReplacementDriverLoading}
                            accept="image/*,application/pdf"
                            onChange={(files) => setAccidentReplacementLicenseFile(files[0] ?? null)}
                          />
                          {(accidentReplacementLicenseFile || accidentReplacementDriverDraft.licenseDocumentObjectName) && (
                            <p className="text-xs text-green-700">
                              {accidentReplacementLicenseFile?.name ?? '운전면허증 문서가 연결되어 있습니다.'}
                            </p>
                          )}
                          {accidentReplacementDriverError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {accidentReplacementDriverError}
                            </div>
                          )}
                          {accidentReplacementDriverNotice && (
                            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                              {accidentReplacementDriverNotice}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => void runAccidentReplacementDriverSave()}
                            disabled={isAccidentReplacementDriverSaving || isAccidentReplacementDriverLoading}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            운전자/면허 정보 저장
                          </button>
                        </div>
                      )}
                      {isAccidentClaimLoading && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          보험청구 정보를 불러오는 중입니다.
                        </div>
                      )}
                      {isCompactAccidentClaimActionItem(selectedItem) && (
                        <div className="rounded-lg bg-gray-50 px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500">현재 필요한 조치</p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {getAccidentClaimSummaryText(accidentClaimIssueMode)}
                          </p>
                        </div>
                      )}
                      {selectedItem.reasonType === 'accident_replacement_info_missing' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={accidentClaimDraft.claimNo}
                            onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, claimNo: event.target.value }))}
                            placeholder="사고접수번호"
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            value={accidentClaimDraft.insurerName}
                            onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, insurerName: event.target.value }))}
                            placeholder="보험사"
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            value={accidentClaimDraft.repairShopName}
                            onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, repairShopName: event.target.value }))}
                            placeholder="정비소"
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <summary className="cursor-pointer text-xs font-semibold text-gray-600">추가 접수 정보</summary>
                            <div className="mt-3 grid gap-2">
                              <input
                                type="date"
                                value={accidentClaimDraft.repairCompletedAt}
                                onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, repairCompletedAt: event.target.value }))}
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                aria-label="수리완료일"
                              />
                              <input
                                type="text"
                                value={accidentClaimDraft.billingAccount}
                                onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, billingAccount: event.target.value }))}
                                placeholder="보험사 청구 계정"
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                          </details>
                        </div>
                      )}
                      {selectedItem.reasonType === 'accident_replacement_approval_required' && (
                        <div className="space-y-3">
                          <select
                            value={accidentClaimDraft.approvalStatus}
                            onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, approvalStatus: event.target.value }))}
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="pending">승인 대기</option>
                            <option value="approved">승인 완료</option>
                            <option value="rejected">승인 반려</option>
                          </select>
                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
                            승인 근거는 대차 요청/수락 문서, 문자, 이메일, 카카오톡, 팩스 등을 첨부하세요. 전화 승인만 받은 경우 승인 확인 메모에 통화 일시와 담당자를 남기고 추후 문서를 첨부하는 것이 안전합니다.
                          </div>
                          <FilePickerCard
                            label="승인 근거 문서"
                            buttonLabel="승인 근거 문서 선택"
                            selectedFileNames={accidentApprovalDocumentFiles.map((file) => file.name)}
                            savedLabel="승인 근거 문서 보기"
                            savedDocuments={accidentClaimDraft.approvalDocumentDetails}
                            accept="image/*,application/pdf"
                            multiple
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            onChange={setAccidentApprovalDocumentFiles}
                            onPreview={setPreviewDocument}
                          />
                          <textarea
                            rows={2}
                            value={accidentClaimDraft.approvalMemo}
                            onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, approvalMemo: event.target.value }))}
                            placeholder="승인 확인 메모"
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      {(accidentClaimIssueMode === 'submission'
                        || accidentClaimIssueMode === 'settlement'
                        || selectedItem.reasonType === 'accident_claim_payment_check'
                        || selectedItem.reasonType === 'accident_claim_difference') && (
                        <div className="space-y-3">
                          {accidentClaimIssueMode === 'submission' && (
                            <div className="space-y-3">
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold leading-relaxed text-amber-800">
                                {getAccidentClaimSubmissionNotice(selectedItem)}
                              </div>
                              <FilePickerCard
                                label="청구 서류"
                                buttonLabel="청구 서류 선택"
                                selectedFileNames={accidentClaimDocumentFile ? [accidentClaimDocumentFile.name] : []}
                                savedLabel="청구 서류 열기"
                                savedDocuments={accidentClaimDraft.documentDetails}
                                accept="image/*,application/pdf"
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                onChange={(files) => setAccidentClaimDocumentFile(files[0] ?? null)}
                              />
                              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
                                {getAccidentClaimDocumentSummary(accidentClaimDraft, accidentClaimDocumentFile)}
                              </p>
                            </div>
                          )}
                          {accidentClaimIssueMode === 'submission' && (
                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs">
                              <div className="mb-3">
                                <p className="font-semibold text-blue-700">청구 상태</p>
                                <p className="mt-1 text-base font-bold text-gray-900">{getRelatedStatusLabel(accidentClaimDraft.claimStatus)}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="font-semibold text-blue-700">문서 상태</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">{getRelatedStatusLabel(accidentClaimDraft.documentStatus)}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-blue-700">최근 제출일</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">
                                    {accidentClaimDraft.submittedAt ? formatActionDateOnly(accidentClaimDraft.submittedAt) : '미제출'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          {accidentClaimIssueMode === 'payment' && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs">
                                <div>
                                  <p className="font-semibold text-emerald-700">청구액</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">{toPaymentAmountFromInput(accidentClaimDraft.billedAmount).toLocaleString()}원</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-emerald-700">인정액</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">{toPaymentAmountFromInput(accidentClaimDraft.recognizedAmount).toLocaleString()}원</p>
                                </div>
                              </div>
                              <RecognizedAmountInput
                                value={accidentClaimDraft.recognizedAmount}
                                onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, recognizedAmount: value }))}
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                              />
                            </div>
                          )}
                          {accidentClaimIssueMode === 'settlement' && (
                            <div className="space-y-3">
                              <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <p className="text-xs font-semibold text-gray-600">정산 체크리스트</p>
                                <SettlementChecklistRow
                                  title="보험금 입금 확인"
                                  statusLabel={getSettlementPaymentCheckLabel(normalizeSettlementPaymentCheckStatus(selectedItem))}
                                  statusClassName={getSettlementStatusClassName(normalizeSettlementPaymentCheckStatus(selectedItem))}
                                  message={getSettlementPaymentCheckMessage(selectedItem, normalizeSettlementPaymentCheckStatus(selectedItem))}
                                />
                                <SettlementChecklistRow
                                  title="대차료 차액 정리"
                                  statusLabel={getSettlementDifferenceLabel(normalizeSettlementDifferenceStatus(selectedItem))}
                                  statusClassName={getSettlementStatusClassName(normalizeSettlementDifferenceStatus(selectedItem))}
                                  message={getSettlementDifferenceMessage(selectedItem, normalizeSettlementDifferenceStatus(selectedItem))}
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs">
                                <div>
                                  <p className="font-semibold text-emerald-700">청구액</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">{toPaymentAmountFromInput(accidentClaimDraft.billedAmount).toLocaleString()}원</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-emerald-700">인정액</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">{toPaymentAmountFromInput(accidentClaimDraft.recognizedAmount).toLocaleString()}원</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-emerald-700">차액</p>
                                  <p className="mt-1 text-sm font-bold text-gray-900">{accidentClaimDifferenceAmount.toLocaleString()}원</p>
                                </div>
                              </div>
                              <RecognizedAmountInput
                                value={accidentClaimDraft.recognizedAmount}
                                onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, recognizedAmount: value }))}
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                              />
                              {toPaymentAmountFromInput(accidentClaimDraft.recognizedAmount) <= 0 ? (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                  보험 인정금액 입력 후 차액 처리 방식을 선택할 수 있습니다.
                                </div>
                              ) : accidentClaimDifferenceAmount <= 0 ? (
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                  차액 없음
                                </div>
                              ) : (
                                <DifferencePayerRadioCards
                                  value={accidentClaimDraft.differencePayerType}
                                  onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, differencePayerType: value }))}
                                  disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                />
                              )}
                              <textarea
                                rows={2}
                                value={accidentClaimDraft.supplementMemo}
                                onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, supplementMemo: event.target.value }))}
                                placeholder="차액/분쟁 메모"
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                          )}
                          {accidentClaimIssueMode === 'difference' && (
                            <div className="space-y-2">
                              <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                                <p className="text-xs font-semibold text-orange-700">정리할 차액</p>
                                <p className="mt-1 text-base font-bold text-gray-900">{accidentClaimDifferenceAmount.toLocaleString()}원</p>
                              </div>
                              <DifferencePayerRadioCards
                                value={accidentClaimDraft.differencePayerType}
                                onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, differencePayerType: value }))}
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                              />
                              <textarea
                                rows={2}
                                value={accidentClaimDraft.supplementMemo}
                                onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, supplementMemo: event.target.value }))}
                                placeholder="차액/분쟁 메모"
                                disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                          )}
                          {accidentClaimIssueMode !== 'difference' && accidentClaimIssueMode !== 'settlement' && (
                            <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <summary className="cursor-pointer text-xs font-semibold text-gray-600">청구금액 및 차액 정보</summary>
                              <div className="mt-3 grid gap-2">
                                <input
                                  type="text"
                                  value={accidentClaimDraft.billedAmount}
                                  onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, billedAmount: event.target.value.replace(/[^\d]/g, '') }))}
                                  placeholder="청구금액"
                                  inputMode="numeric"
                                  disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                                {accidentClaimIssueMode !== 'payment' && (
                                  <RecognizedAmountInput
                                    value={accidentClaimDraft.recognizedAmount}
                                    onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, recognizedAmount: value }))}
                                    disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                  />
                                )}
                                <DifferencePayerRadioCards
                                  value={accidentClaimDraft.differencePayerType}
                                  onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, differencePayerType: value }))}
                                  disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                />
                                <textarea
                                  rows={2}
                                  value={accidentClaimDraft.supplementMemo}
                                  onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, supplementMemo: event.target.value }))}
                                  placeholder="차액/분쟁 메모"
                                  disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                            </details>
                          )}
                          {accidentClaimIssueMode === 'difference' && (
                            <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <summary className="cursor-pointer text-xs font-semibold text-gray-600">청구액/인정액 수정</summary>
                              <div className="mt-3 grid gap-2">
                                <input
                                  type="text"
                                  value={accidentClaimDraft.billedAmount}
                                  onChange={(event) => setAccidentClaimDraft((prev) => ({ ...prev, billedAmount: event.target.value.replace(/[^\d]/g, '') }))}
                                  placeholder="청구금액"
                                  inputMode="numeric"
                                  disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                                <RecognizedAmountInput
                                  value={accidentClaimDraft.recognizedAmount}
                                  onChange={(value) => setAccidentClaimDraft((prev) => ({ ...prev, recognizedAmount: value }))}
                                  disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                                />
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                      {accidentClaimError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {accidentClaimError}
                        </div>
                      )}
                      {accidentClaimNotice && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                          {accidentClaimNotice}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.reasonType === 'accident_replacement_info_missing' && (
                          <button
                            type="button"
                            onClick={() => void runAccidentClaimAction('save-info')}
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            접수 정보 저장
                          </button>
                        )}
                        {selectedItem.reasonType === 'accident_replacement_approval_required' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (accidentClaimDraft.approvalStatus === 'rejected') {
                                setAccidentApprovalRejectConfirmOpen(true);
                                return;
                              }
                              void runAccidentClaimAction('save-info');
                            }}
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            승인 상태 저장
                          </button>
                        )}
                        {accidentClaimIssueMode === 'submission' && (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => void runAccidentClaimAction('submit')}
                              disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              보험사에 청구 제출 처리
                            </button>
                            <p className="text-xs text-gray-500">제출하면 청구 상태가 진행 중으로 변경됩니다.</p>
                          </div>
                        )}
                        {(selectedItem.reasonType === 'accident_claim_payment_check'
                          || selectedItem.reasonType === 'accident_claim_difference'
                          || accidentClaimIssueMode === 'settlement') && (
                          <button
                            type="button"
                            onClick={() => void runAccidentClaimAction('recognize')}
                            disabled={isAccidentClaimSaving || isAccidentClaimLoading}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            보험금 입금 확인
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isPaymentActionItem(selectedItem) && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <label className="text-sm font-semibold text-gray-600">
                        {selectedItem.workContext?.module === 'payment_deposit_refund' ? '보증금 반환' : '정산 처리'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          void handleRefreshPaymentInfo();
                        }}
                        disabled={isPaymentInfoRefreshing || isWriteSaving}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPaymentInfoRefreshing ? '새로고침 중...' : '결제정보 새로고침'}
                      </button>
                    </div>
                    <div className={`rounded-lg p-4 space-y-3 ${
                      selectedItem.workContext?.module === 'payment_deposit_refund'
                        ? 'border border-emerald-200 bg-emerald-50'
                        : 'border border-red-200 bg-red-50'
                    }`}>
                      <div className="rounded-lg bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500">현재 필요한 조치</p>
                        <p className="mt-1 text-base font-bold text-gray-900">{getSettlementSummaryText(selectedItem)}</p>
                        {getSettlementMeta(selectedItem) && (
                          <p className="mt-1 text-xs text-gray-500">{getSettlementMeta(selectedItem)}</p>
                        )}
                      </div>
                      {selectedItem.workContext?.module === 'payment_deposit_refund' && (
                        <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
                          <p className="text-xs font-semibold text-emerald-700">보증금 환불 완료 입력</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              value={refundAmountDraft}
                              onChange={(event) => setRefundAmountDraft(event.target.value.replace(/[^\d]/g, ''))}
                              placeholder="환불금액"
                              inputMode="numeric"
                              disabled={isWriteSaving}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                            />
                            <select
                              value={refundMethodDraft}
                              onChange={(event) => setRefundMethodDraft(event.target.value)}
                              disabled={isWriteSaving}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                            >
                              <option value="계좌이체">계좌이체</option>
                              <option value="카드취소">카드취소</option>
                              <option value="현금">현금</option>
                            </select>
                            <DateTextPicker
                              value={refundCompletedAtDraft}
                              ariaLabel="환불 완료일"
                              onChange={setRefundCompletedAtDraft}
                              disabled={isWriteSaving}
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={refundMemoDraft}
                            onChange={(event) => setRefundMemoDraft(event.target.value)}
                            placeholder="환불 메모"
                            disabled={isWriteSaving}
                            className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                          />
                          <label className="inline-flex cursor-pointer items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr-only"
                              onChange={(event) => setRefundEvidenceFile(event.target.files?.[0] ?? null)}
                              disabled={isWriteSaving}
                            />
                            {refundEvidenceFile ? `환불 증빙: ${refundEvidenceFile.name}` : '환불 증빙 선택 첨부'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const refundCharge = getPrimarySettlementCharge(selectedItem);
                              if (refundCharge) {
                                openWorkChargeSettlementConfirmation(selectedItem, refundCharge, 'refunded');
                              }
                            }}
                            disabled={isWriteSaving || !canWritePayments || !getPrimarySettlementCharge(selectedItem)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            환불 완료 처리
                          </button>
                        </div>
                      )}
                      {canEditPaymentIssueFields && selectedItem.workContext?.module !== 'payment_deposit_refund' && (
                        <div className="space-y-3 rounded-lg border border-red-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-gray-600">결제 유형</span>
                            {selectedItemCapabilities.canEditStandalonePaymentType ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={paymentTypeDraft}
                                  onChange={(event) => setPaymentTypeDraft(normalizePaymentType(event.target.value))}
                                  className="rounded-md border border-red-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                  aria-label="결제 유형"
                                  disabled={isPaymentTypeSaving || isWriteSaving}
                                >
                                  <option value="카드">카드</option>
                                  <option value="현금">현금</option>
                                  <option value="계좌이체">계좌이체</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void runPaymentTypeSave(selectedItem);
                                  }}
                                  disabled={isPaymentTypeSaving || isWriteSaving}
                                  className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isPaymentTypeSaving ? '저장 중...' : '저장'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-gray-900">{selectedItem.paymentInfo.paymentType}</span>
                            )}
                          </div>
                          <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr-only"
                              onChange={(event) => {
                                setPaymentEvidenceFile(event.target.files?.[0] ?? null);
                              }}
                              disabled={isWriteSaving}
                            />
                            {paymentEvidenceFile ? `선택 증빙: ${paymentEvidenceFile.name}` : '수납 증빙 선택 첨부'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              openPaymentIssueConfirmation(selectedItem, 'paid');
                            }}
                            disabled={isWriteSaving}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            결제 완료 처리
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openPaymentIssueConfirmation(selectedItem, 'canceled');
                            }}
                            disabled={isWriteSaving}
                            className="rounded-lg bg-slate-600 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            결제 면제 처리
                          </button>
                          <span className="text-xs text-gray-500">
                            증빙은 선택 사항이며 없어도 완료할 수 있습니다.
                          </span>
                        </div>
                      )}
                      {canEditPaymentIssueFields && selectedItem.workContext?.module !== 'payment_deposit_refund' && !selectedItem.relatedChargeItemId && (
                        <details className="rounded-lg border border-red-200 bg-white px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-gray-600">추가 결제 금액 직접 수정</summary>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={paymentAmountDraft}
                              onChange={(event) => setPaymentAmountDraft(event.target.value.replace(/[^\d]/g, ''))}
                              className="w-32 rounded-lg border border-red-300 bg-white px-2 py-1 text-right text-sm font-semibold text-red-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                              inputMode="numeric"
                              aria-label="추가 결제 금액"
                              disabled={isPaymentAmountSaving || isWriteSaving}
                            />
                            <span className="text-xs font-semibold text-red-700">원</span>
                            <button
                              type="button"
                              onClick={() => {
                                void runPaymentAdditionalAmountSave(selectedItem);
                              }}
                              disabled={isPaymentAmountSaving || isWriteSaving}
                              className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPaymentAmountSaving ? '저장 중...' : '저장'}
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-600">담당자</label>
                  <div className="mt-1">
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentAssigneeId}
                      onChange={(e) => {
                        const nextAssigneeId = e.target.value;
                        setCurrentAssigneeId(nextAssigneeId);
                        if (!canWriteActionRequired || isWriteSaving || !selectedItem) {
                          return;
                        }
                        if ((selectedItem.assigneeId ?? '') === nextAssigneeId) {
                          return;
                        }
                        void runAssigneeUpdate(selectedItem.id, nextAssigneeId);
                      }}
                      disabled={!canWriteActionRequired || isWriteSaving}
                    >
                      <option value="">담당자 선택</option>
                      {assigneeOptions.map((option) => (
                        <option key={option.userId} value={option.userId}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">상태 변경</label>
                  <div className="flex gap-2 mt-1">
                    <select
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentStatus || selectedItem.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        if (!canWriteActionRequired || isWriteSaving || !selectedItem) {
                          setCurrentStatus(nextStatus);
                          return;
                        }
                        const nextStatusCode = normalizeStatusCode(nextStatus);
                        if (nextStatusCode === selectedItem.statusCode) {
                          setCurrentStatus(nextStatus);
                          return;
                        }
                        const issueAssetKind = getIssueAssetKind(selectedItem);
                        if (issueAssetKind && nextStatusCode === 'resolved') {
                          const blockedMessage = getIssueResolveBlockMessage(selectedItem, issueAsset);
                          if (blockedMessage) {
                            setCurrentStatus('');
                            setIssueAssetPrompt({
                              mode: 'blocked',
                              kind: issueAssetKind,
                              message: blockedMessage,
                            });
                            return;
                          }
                        }
                        if (handlePaymentIssueStatusIntent(selectedItem, nextStatusCode)) {
                          setCurrentStatus('');
                          return;
                        }
                        if (handleLateReturnStatusIntent(selectedItem, nextStatusCode)) {
                          setCurrentStatus('');
                          return;
                        }
                        setCurrentStatus(nextStatus);
                        void runStatusUpdate(selectedItem.id, nextStatusCode, 'status');
                      }}
                      disabled={!canWriteActionRequired || isWriteSaving}
                    >
                      {!STATUS_OPTIONS.includes(selectedItem.status as typeof STATUS_OPTIONS[number]) && (
                        <option value={selectedItem.status}>{selectedItem.status}</option>
                      )}
                      {STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">처리 메모</label>
                  <textarea
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="처리 내용을 입력하세요..."
                    value={currentMemo}
                    onChange={(e) => setCurrentMemo(e.target.value)}
                    disabled={!canWriteActionRequired || isWriteSaving}
                  />
                  <button
                    className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    onClick={handleMemoAdd}
                    disabled={!canWriteActionRequired || !currentMemo.trim() || isWriteSaving}
                  >
                    {isMemoSaving ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        저장중
                      </span>
                    ) : (
                      '메모 저장'
                    )}
                  </button>
                </div>

                {selectedItem.memos && selectedItem.memos.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">메모 이력</label>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedItem.memos.map((memo) => (
                        <div key={memo.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {formatActionDate(memo.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-semibold text-blue-700">{memo.author}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              memo.status === 'resolved'
                                ? 'bg-green-100 text-green-700'
                                : memo.status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}>
                              {memo.statusLabel}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{memo.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <label className="mb-3 block text-sm font-semibold text-gray-600">관련 데이터</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void openRelatedContext('reservation')}
                      disabled={!canViewReservations || !selectedItem.reservationId}
                    >
                      예약 상세 열기
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void openRelatedContext('asset')}
                      disabled={!canViewAssets || !selectedItem.vehicleNumber}
                    >
                      차량 상세 열기
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void openRelatedContext('billing')}
                      disabled={!selectedItem.paymentInfo && toWorkChargeItems(selectedItem.workContext).length === 0}
                    >
                      청구 원장 열기
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void openRelatedContext('claim')}
                      disabled={!selectedItem.reservationId || !(selectedItem.type === '대차/보험청구' || selectedItem.workContext?.module.startsWith('accident_claim'))}
                    >
                      보험청구 상세 열기
                    </button>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  {selectedItem.status !== '완료' && (
                    <button
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleResolveIssue}
                      disabled={!canWriteActionRequired || isWriteSaving}
                    >
                      {isResolveSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          해결 처리 중
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          이슈 해결 완료
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {relatedContextKind && (
          <RelatedContextDrawer
            key={relatedContextKind}
            kind={relatedContextKind}
            payload={relatedContextPayload}
            isLoading={isRelatedContextLoading}
            error={relatedContextError}
            onClose={closeRelatedContext}
          />
        )}

        {issueAssetPrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onMouseDown={handleIssueAssetPromptBackdropMouseDown}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <p className="text-base font-semibold text-[#1e2939]">{issueAssetPrompt.message}</p>
              <div className="mt-6 flex justify-end gap-3">
                {issueAssetPrompt.mode === 'invalid' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIssueAssetPrompt(null)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pendingPayload = issueAssetPrompt.payload;
                        const kind = issueAssetPrompt.kind;
                        setIssueAssetPrompt(null);
                        if (pendingPayload) {
                          void executeIssueAssetSave(pendingPayload, kind);
                        }
                      }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      강제 저장
                    </button>
                  </>
                ) : issueAssetPrompt.mode === 'blocked' ? (
                  <button
                    type="button"
                    onClick={() => setIssueAssetPrompt(null)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    닫기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIssueAssetPrompt(null)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    닫기
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {lateReturnResolveDialog === 'confirm-returned' && selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onMouseDown={handleLateReturnResolveBackdropMouseDown}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-[#1e2939]">
                {isRepairDoneNotReturnedActionItem(selectedItem) ? '수리완료 후 대차 차량이 반납되었습니까?' : '해당 차량이 반납되었습니까?'}
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                예를 누르면 이슈카드를 완료 상태로 바꾸고 차량도 함께 반납 처리합니다.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleLateReturnResolveConfirm}
                  disabled={isResolveSaving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolveSaving ? '처리 중...' : '예'}
                </button>
                <button
                  type="button"
                  onClick={() => setLateReturnResolveDialog('return-required')}
                  disabled={isResolveSaving}
                  className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}

        {lateReturnResolveDialog === 'return-required' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onMouseDown={handleLateReturnResolveBackdropMouseDown}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-[#1e2939]">차량이 반납된 다음 완료 처리해주세요</h2>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setLateReturnResolveDialog(null)}
                  className="w-full rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingPaymentConfirmation && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={handlePendingPaymentConfirmationBackdropMouseDown}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-action-confirmation-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2 id="payment-action-confirmation-title" className="text-lg font-bold text-[#1e2939]">{pendingPaymentConfirmation.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{pendingPaymentConfirmation.description}</p>
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                이 작업은 결제/청구 상태를 변경합니다.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={confirmPendingPaymentAction}
                  disabled={isWriteSaving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isWriteSaving ? '처리 중...' : pendingPaymentConfirmation.confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPaymentConfirmation(null)}
                  disabled={isWriteSaving}
                  className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {paymentIssueResolveDialog === 'choose-payment-resolution' && isPaymentActionItem(selectedItem) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onMouseDown={handlePaymentResolutionBackdropMouseDown}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-[#1e2939]">정산/수납 항목 완료 처리 방법 선택</h2>
              <p className="mt-3 text-sm text-gray-600">
                이슈를 바로 완료로 바꾸는 대신 결제 완료 또는 면제 처리로 완료해 주세요.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedItem) {
                      return;
                    }
                    openPaymentIssueConfirmation(selectedItem, 'paid');
                  }}
                  disabled={isResolveSaving}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolveSaving ? '처리 중...' : '결제 완료 처리'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedItem) {
                      return;
                    }
                    openPaymentIssueConfirmation(selectedItem, 'canceled');
                  }}
                  disabled={isResolveSaving}
                  className="w-full rounded-lg bg-slate-600 px-4 py-3 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolveSaving ? '처리 중...' : '결제 면제 처리'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentIssueResolveDialog(null)}
                  disabled={isResolveSaving}
                  className="w-full rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {accidentApprovalRejectConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={handleAccidentRejectBackdropMouseDown}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-[#1e2939]">승인 반려로 저장하시겠습니까?</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                승인 반려로 저장하면 예약이 취소되고 관련 후속 이슈가 정리됩니다.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAccidentApprovalRejectConfirmOpen(false);
                    void runAccidentClaimAction('save-info');
                  }}
                  disabled={isAccidentClaimSaving}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAccidentClaimSaving ? '처리 중...' : '예약 취소 및 정리'}
                </button>
                <button
                  type="button"
                  onClick={() => setAccidentApprovalRejectConfirmOpen(false)}
                  disabled={isAccidentClaimSaving}
                  className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {previewDocument && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onMouseDown={handlePreviewDocumentBackdropMouseDown}>
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#1e2939]">승인 근거 문서</h2>
                  <p className="mt-1 break-all text-sm text-gray-500">
                    {previewDocument.fileName || previewDocument.objectName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDocument(null)}
                  className="shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>
              <div className="min-h-[320px] overflow-auto bg-gray-50 p-5">
                {previewDocument.url ? (
                  previewDocument.contentType?.startsWith('image/') ? (
                    <img
                      src={previewDocument.url}
                      alt={previewDocument.fileName || previewDocument.objectName}
                      className="mx-auto max-h-[65vh] max-w-full rounded-lg border border-gray-200 bg-white object-contain"
                    />
                  ) : (
                    <iframe
                      src={previewDocument.url}
                      title={previewDocument.fileName || previewDocument.objectName}
                      className="h-[65vh] w-full rounded-lg border border-gray-200 bg-white"
                    />
                  )
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                    미리보기 URL을 만들 수 없습니다. 문서 저장 상태를 확인해 주세요.
                  </div>
                )}
              </div>
              {previewDocument.url && (
                <div className="border-t border-gray-200 p-4 text-right">
                  <a
                    href={previewDocument.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    새 탭에서 열기
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
