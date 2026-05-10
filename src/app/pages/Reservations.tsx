import { Layout } from '../components/Layout';
import { startTransition, useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type CompositionEvent, type KeyboardEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Plus, Car, Calendar, AlertCircle, DollarSign, AlertTriangle, Loader2, RefreshCw, X, Edit2, Save, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  AccidentReportModal,
  type AccidentReportAssigneeOption,
  type AccidentReportField,
  type AccidentReportFormValues,
  type AccidentReportSubmitFeedback,
} from '../components/AccidentReportModal';
import {
  NewContractModal,
  type NewContractField,
  type NewContractFormValues,
  type NewContractLocationOption,
  type NewContractSubmitFeedback,
} from '../components/NewContractModal';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { usePaymentStatusSync } from '../hooks/usePaymentStatusSync';
import { useAuth } from '../context/AuthContext';
import {
  buildPaymentSyncTargets,
  createFallbackVehicleAsset as createReservationFallbackVehicleAsset,
  mergeVehicleRows,
  resolveReservationVehicleNumber,
} from './reservationsViewModel';
import {
  invalidatePaymentStatusCache,
  isUnpaidPaymentStatus,
  toCanonicalPaymentStatus,
  toReservationPaymentStatus,
  type PaymentStatusCanonical,
  type PaymentStatusSnapshot,
} from '../utils/paymentStatusSync';
import { useAuthorization } from '../context/AuthorizationContext';
import { ACTION_PERMISSIONS, ROUTE_PERMISSIONS } from '../authorization';
import { formatDateKst, formatDateTimeKst } from '../utils/dateTimeFormat';
import { normalizeActionMainCategory, normalizeActionSubCategory } from '../utils/actionItemTaxonomy';
import type { VehicleAsset } from '../types/assets';
import type { Reservation, ReservationAccidentClaim, ReservationAccidentReport, ReservationBillingSummary, ReservationChargeItem, ReservationDocumentChecklistItem, ReservationParties, ReservationParty, ReservationPaymentRecord } from '../types/reservations';
import { ApiError } from '../../services/api';
import { signAssetUpload, uploadFileToSignedUrl } from '../../services/assetOcr';
import { getAssetsList } from '../../services/assets';
import { createReservationChargeItem, createReservationPaymentRecord, getUploadDownloadUrl, patchChargeItem, voidPaymentRecord } from '../../services/billing';
import { patchPaymentStatus } from '../../services/payments';
import {
  getActionRequiredList,
  patchActionRequiredMemo,
  patchActionRequiredStatus,
} from '../../services/actionRequired';
import {
  cancelReservation,
  createReservation,
  getReservationDetail,
  getReservationsList,
  patchReservation,
  patchReservationAccidentFollowup,
  prepareReservationCreation,
  reportReservationAccident,
  returnReservation,
  transitionReservation,
} from '../../services/reservations';
import { createSettingsGarage, listSettingsGarages, listSettingsMembers, type SettingsGarage, type SettingsMember } from '../../services/settings';

// 드래그 선택 타입 정의
type DragSelection = {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
} | null;
type DragConflictPrompt = {
  vehicleNumber: string;
  startDateLabel: string;
  endDateLabel: string;
  conflicts: Array<{
    id: string;
    customer: string;
    startDateFull: string;
    endDateFull: string;
  }>;
};
type ReservationWarningPrompt = {
  message: string;
  confirmLabel?: string;
  cancelLabel: string;
  dismissResult: boolean;
};
type ViewFilter = 'all' | 'reservation' | 'rental' | 'return' | 'unpaid' | 'overdue';
const PAYMENT_ISSUE_LABELS = new Set(['미납/결제 문제', '정산/수납']);
type PaymentScope = 'all' | 'delinquent';
type RentalTypeFilter = 'all' | 'short_term' | 'long_term' | 'accident_replacement';
type WorkflowStatusFilter = 'all' | 'intake' | 'confirmed' | 'pickup_ready' | 'renting' | 'returned' | 'closeout_required' | 'closed' | 'cancelled';
type CloseoutStatusFilter = 'all' | 'not_required' | 'required' | 'partial' | 'disputed' | 'closed';
type CancellationSettlementStatusFilter = 'all' | 'not_required' | 'fee_due' | 'refund_due' | 'mixed_due' | 'disputed' | 'settled';
type LongTermAccountStatusFilter = 'all' | 'not_applicable' | 'active_normal' | 'due_soon' | 'due' | 'partial' | 'overdue_1' | 'overdue_2_plus' | 'collection_review' | 'early_termination' | 'closeout' | 'closed';
type AccidentReplacementStatusFilter = 'all' | 'not_applicable' | 'info_missing' | 'approval_pending' | 'delivery_ready' | 'in_use' | 'repair_done_not_returned' | 'returned' | 'ready_to_claim' | 'claiming' | 'insurance_paid' | 'partial_recognized' | 'difference_settlement' | 'disputed' | 'closed';
type DueFilter = 'pickup' | 'return' | null;

function createTodayBaseDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const CALENDAR_BASE_DATE = createTodayBaseDate();
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TOTAL_DAYS_TO_SHOW = 42;
const RESERVATION_FETCH_PAGE_SIZE = 500;
const RESERVATION_FETCH_BUFFER_BEFORE_DAYS = 14;
const RESERVATION_FETCH_BUFFER_AFTER_DAYS = 28;
const RESERVATION_MAX_FETCH_WINDOW_DAYS = 90;
const ASSET_FALLBACK_PAGE_SIZE = 200;
const RESERVATION_CALENDAR_CACHE_KEY_PREFIX = 'pangea.reservations.calendar.v1';
const RESERVATION_CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;
const CALENDAR_TODAY_LEFT_OFFSET_DAYS = 3;
const TOTAL_COUNT_KEYS = ['total', 'totalCount', 'count', 'size', 'itemsCount', 'totalElements'];
const RETRY_TOAST_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const ACTIVE_ACTION_STATUS_QUERY = 'open,in_progress';
const EXPIRED_INSURANCE_PICKUP_MESSAGE = '현재 보험 만료 상태로 차량 인수가 불가능합니다.\n보험 만료 이후에 운행을 할 경우 행정처분(과태료, 영업정지)과 형사처벌을 받을 수 있으며 사고 발생시 보험처리가 불가합니다.';
const INSPECTION_PICKUP_FORCE_MESSAGE = '예약 기간내에 정기점검 만료일자가 있습니다.\n수검 가능 기간을 넘기면 과태료(4만원 + 3일당 2만원)가 발생하며, 사고 발생시 보험 처리에 불리합니다.';
const INSPECTION_PICKUP_NOTICE_MESSAGE = '예약 종료 후 수검 만료기간까지 {days}일입니다. \n반납 지연 및 대여 연장 발생시 주의해주세요.';
const LEDGER_AUTHORITATIVE_PAYMENT_MESSAGE = '이 계약은 정산 항목의 청구/수납 내역으로 결제 상태를 계산합니다. 각 항목의 수납 버튼에서 처리하세요.';
const WORKFLOW_STATUS_LABELS: Record<Exclude<WorkflowStatusFilter, 'all'>, string> = {
  intake: '예약접수',
  confirmed: '예약확정',
  pickup_ready: '인수대기',
  renting: '대여중',
  returned: '반납완료',
  closeout_required: '종료정산 필요',
  closed: '종결',
  cancelled: '취소',
};
const CLOSEOUT_STATUS_LABELS: Record<Exclude<CloseoutStatusFilter, 'all'>, string> = {
  not_required: '정산 대상 아님',
  required: '종료정산 필요',
  partial: '부분 정산',
  disputed: '분쟁/보류',
  closed: '정산 완료',
};
const CANCELLATION_SETTLEMENT_STATUS_LABELS: Record<Exclude<CancellationSettlementStatusFilter, 'all'>, string> = {
  not_required: '취소정산 대상 아님',
  fee_due: '취소수수료 청구',
  refund_due: '환불대기',
  mixed_due: '취소수수료/환불 정산',
  disputed: '분쟁/보류',
  settled: '취소정산 완료',
};
const LONG_TERM_ACCOUNT_STATUS_LABELS: Record<Exclude<LongTermAccountStatusFilter, 'all'>, string> = {
  not_applicable: '장기렌트 아님',
  active_normal: '정상',
  due_soon: '납부예정',
  due: '납부대기',
  partial: '부분납부',
  overdue_1: '1회차 연체',
  overdue_2_plus: '2회차 이상 연체',
  collection_review: '회수/중도해지 검토',
  early_termination: '중도해지',
  closeout: '종료정산',
  closed: '종결',
};
const ACCIDENT_REPLACEMENT_STATUS_LABELS: Record<Exclude<AccidentReplacementStatusFilter, 'all'>, string> = {
  not_applicable: '사고대차 아님',
  info_missing: '사고정보 미완성',
  approval_pending: '대차 승인 대기',
  delivery_ready: '인수대기',
  in_use: '대차 진행중',
  repair_done_not_returned: '수리완료 후 미반납',
  returned: '반납완료',
  ready_to_claim: '청구대기',
  claiming: '보험청구중',
  insurance_paid: '보험입금 완료',
  partial_recognized: '일부인정/차액발생',
  difference_settlement: '차액정산',
  disputed: '분쟁/보류',
  closed: '종결',
};

type FieldErrorMap<TField extends string> = Partial<Record<TField, string>>;
type ReservationsHydrationPayload = {
  reservationsPayload: unknown;
  assetPayload?: unknown;
};
type ReservationActiveActionItem = {
  id: string;
  label: string;
  mainLabel: string;
  subLabel?: string;
  status?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDateTimeFromDateAndTime(dateValue: string, timeValue: string): string | null {
  const parsed = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
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

function differenceInDays(fromDate: Date, toDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((toDate.getTime() - fromDate.getTime()) / msPerDay);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function getReservationDateRange(formValues: NewContractFormValues): { startDate: Date; endDate: Date } | null {
  const startDate = parseDateOnly(formValues.startDate);
  const endDate = parseDateOnly(formValues.endDate);
  if (!startDate || !endDate) {
    return null;
  }
  return { startDate, endDate };
}

function isInsuranceDueWithinReservationRange(asset: VehicleAsset | null, reservation: { startDateFull?: string; endDateFull?: string }): boolean {
  if (!asset) {
    return false;
  }
  const insuranceDue = parseDateOnly(asset.insuranceExpiry);
  const reservationStart = parseDateOnly(reservation.startDateFull);
  const reservationEnd = parseDateOnly(reservation.endDateFull);
  if (!insuranceDue || !reservationStart || !reservationEnd) {
    return false;
  }
  return reservationStart <= insuranceDue && insuranceDue <= reservationEnd;
}

function evaluateReservationAssetWarning(
  asset: VehicleAsset,
  formValues: NewContractFormValues,
  hasInspectionIssueCard: boolean,
): { blockedMessage?: string; prompt?: ReservationWarningPrompt } {
  const range = getReservationDateRange(formValues);
  if (!range) {
    return {};
  }

  const insuranceDue = parseDateOnly(asset.insuranceExpiry);
  const inspectionDue = parseDateOnly(asset.nextInspection);
  const inspectionWindowExpiry = inspectionDue ? addDays(inspectionDue, 31) : null;
  const today = parseDateOnly(new Date().toISOString().slice(0, 10));

  if (inspectionWindowExpiry && today && inspectionWindowExpiry < today) {
    return { blockedMessage: '정기점검 수검 가능 기간이 만료된 차량은 예약할 수 없습니다.' };
  }

  const informationalMessages: string[] = [];
  const confirmationMessages: string[] = [];

  if (insuranceDue && insuranceDue >= range.startDate && insuranceDue <= range.endDate) {
    informationalMessages.push('예약 기간 내에 보험이 만료 됩니다. 만료일 전에 반드시 갱신하세요.');
  }
  if (hasInspectionIssueCard && inspectionWindowExpiry && range.endDate < inspectionWindowExpiry) {
    confirmationMessages.push(`예약 종료 후 수검 가능 만료일까지 ${differenceInDays(range.endDate, inspectionWindowExpiry)}일입니다.`);
  }
  if (hasInspectionIssueCard && inspectionWindowExpiry && inspectionWindowExpiry >= range.startDate && inspectionWindowExpiry <= range.endDate) {
    confirmationMessages.push('예약 시작일 전에 정기점검을 반드시 받아야합니다.');
  }
  if (insuranceDue) {
    const daysLeft = differenceInDays(range.endDate, insuranceDue);
    if (daysLeft >= 0 && daysLeft <= 30) {
      confirmationMessages.push(`예약 종료 후 보험만료 유효기간까지 ${daysLeft}일입니다.`);
    }
  }

  const combinedMessages = [...confirmationMessages, ...informationalMessages];
  if (combinedMessages.length === 0) {
    return {};
  }

  if (confirmationMessages.length > 0) {
    return {
      prompt: {
        message: combinedMessages.join('\n\n'),
        cancelLabel: '취소',
        confirmLabel: '예약 진행',
        dismissResult: false,
      },
    };
  }

  return {
    prompt: {
      message: combinedMessages.join('\n\n'),
      cancelLabel: '닫기',
      dismissResult: true,
    },
  };
}

function isInsuranceExpired(asset: VehicleAsset | null): boolean {
  if (!asset) {
    return false;
  }
  const insuranceDue = parseDateOnly(asset.insuranceExpiry);
  const today = parseDateOnly(new Date().toISOString().slice(0, 10));
  return Boolean(insuranceDue && today && insuranceDue < today);
}

function requiresForcedPickupPrompt(reservation: Reservation, asset: VehicleAsset | null): boolean {
  if (!asset) {
    return false;
  }
  const inspectionDue = parseDateOnly(asset.nextInspection);
  const inspectionWindowExpiry = inspectionDue ? addDays(inspectionDue, 31) : null;
  const reservationStart = parseDateOnly(reservation.startDateFull);
  const reservationEnd = parseDateOnly(reservation.endDateFull);
  if (!inspectionWindowExpiry || !reservationStart || !reservationEnd) {
    return false;
  }
  return inspectionWindowExpiry >= reservationStart && inspectionWindowExpiry <= reservationEnd;
}

function getPickupInspectionNoticeDaysByIssueCard(
  reservation: Reservation,
  asset: VehicleAsset | null,
  hasInspectionIssueCard: boolean,
): number | null {
  if (!asset || !hasInspectionIssueCard) {
    return null;
  }
  const inspectionDue = parseDateOnly(asset.nextInspection);
  const inspectionWindowExpiry = inspectionDue ? addDays(inspectionDue, 31) : null;
  const reservationEnd = parseDateOnly(reservation.endDateFull);
  if (!inspectionWindowExpiry || !reservationEnd) {
    return null;
  }
  if (reservationEnd >= inspectionWindowExpiry) {
    return null;
  }
  return differenceInDays(reservationEnd, inspectionWindowExpiry);
}

function buildPickupWarningPrompt(options: {
  shouldForcePickup: boolean;
  inspectionNoticeDays: number | null;
  insuranceDueInRange: boolean;
}): ReservationWarningPrompt | null {
  const { shouldForcePickup, inspectionNoticeDays, insuranceDueInRange } = options;
  const messages: string[] = [];
  if (shouldForcePickup) {
    messages.push(INSPECTION_PICKUP_FORCE_MESSAGE);
  }
  if (inspectionNoticeDays !== null) {
    messages.push(INSPECTION_PICKUP_NOTICE_MESSAGE.replace('{days}', String(inspectionNoticeDays)));
  }
  if (insuranceDueInRange) {
    messages.push('예약 기간 내에 보험이 만료 됩니다. 만료일 전에 반드시 갱신하세요.');
  }

  if (messages.length === 0) {
    return null;
  }
  if (shouldForcePickup) {
    return {
      message: messages.join('\n\n'),
      cancelLabel: '닫기',
      confirmLabel: '인수 처리 강행',
      dismissResult: false,
    };
  }
  return {
    message: messages.join('\n\n'),
    cancelLabel: '닫기',
    confirmLabel: '확인',
    dismissResult: false,
  };
}

function toAccidentDisplayTime(value: Date): string {
  return formatDateTimeKst(value, '-');
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]+/g, '_');
  return normalized.replace(/^\.+/, '') || 'file';
}

function toCurrencyDisplayFromInput(value: string): string {
  const numericText = value.replace(/[^\d.-]/g, '');
  const numericValue = Number(numericText);
  if (Number.isFinite(numericValue)) {
    return `${numericValue.toLocaleString('ko-KR')}원`;
  }
  return toCurrencyValue(value);
}

function toCurrencyNumberFromInput(value: string): number {
  const numericText = value.replace(/[^\d.-]/g, '');
  const numericValue = Number(numericText);
  return Number.isFinite(numericValue) ? numericValue : 0;
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
    const targetField = fieldMap[name];
    if (!targetField) {
      continue;
    }
    if (!mapped[targetField]) {
      mapped[targetField] = reason;
    }
  }

  return mapped;
}

function toCreateFieldErrors(error: ApiError): FieldErrorMap<NewContractField> {
  const mapped = mapFieldErrors<NewContractField>(toErrorFieldEntries(error), {
    reservationId: 'selectedVehicle',
    vin: 'selectedVehicle',
    vehicleNumber: 'selectedVehicle',
    plate: 'selectedVehicle',
    startAt: 'startDate',
    endAt: 'endDate',
    customerName: 'customerName',
    phone: 'customerPhone',
    licenseNumber: 'customerLicense',
    address: 'customerAddress',
  });

  const msg = error.message ?? '';
  if (!mapped.startDate && msg.includes('현재 시간 이전')) {
    mapped.startDate = msg;
  }
  if (!mapped.selectedVehicle && msg.includes('사용가능한 상태가 아닙니다')) {
    mapped.selectedVehicle = msg;
  }

  return mapped;
}

function toAccidentFieldErrors(error: ApiError): FieldErrorMap<AccidentReportField> {
  const mapped = mapFieldErrors<AccidentReportField>(toErrorFieldEntries(error), {
    blackboxFileName: 'blackboxFile',
    blackboxGcsObjectName: 'blackboxFile',
    handlerName: 'assignee',
    memo: 'description',
  });

  const errorMessage = (error.message || '').toLowerCase();
  if (!mapped.blackboxFile && errorMessage.includes('blackbox')) {
    mapped.blackboxFile = error.message;
  }

  return mapped;
}

function isRetryableMutationError(error: ApiError): boolean {
  if (error.status !== undefined && error.status >= 500) {
    return true;
  }
  return (
    error.code === 'NETWORK_ERROR'
    || error.code === 'TIMEOUT'
    || error.code === 'ABORTED'
    || error.code === 'SERVER_ERROR'
  );
}

function withIssueLabel(issues: string[] | undefined, label: string): string[] {
  const nextIssues = Array.isArray(issues) ? [...issues] : [];
  if (!nextIssues.includes(label)) {
    nextIssues.push(label);
  }
  return nextIssues;
}

function withoutIssueLabel(issues: string[] | undefined, label: string): string[] {
  if (!Array.isArray(issues) || issues.length === 0) {
    return [];
  }
  return issues.filter((issue) => issue !== label);
}

function withoutPaymentIssueLabels(issues: string[] | undefined): string[] {
  if (!Array.isArray(issues) || issues.length === 0) {
    return [];
  }
  return issues.filter((issue) => !PAYMENT_ISSUE_LABELS.has(issue));
}

function hasPaymentIssueLabel(issues: string[] | undefined): boolean {
  return Array.isArray(issues) && issues.some((issue) => PAYMENT_ISSUE_LABELS.has(issue));
}

function areIssueListsEqual(left: string[] | undefined, right: string[] | undefined): boolean {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];
  if (leftList.length !== rightList.length) {
    return false;
  }
  return leftList.every((item, index) => item === rightList[index]);
}

const TERMINAL_CONTRACT_STATUSES = new Set(['완료']);

function normalizeReservationContractStatus(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
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
  return value.trim();
}

export function canReportAccidentForReservation(reservation: Reservation): boolean {
  const currentContractStatus = normalizeReservationContractStatus(reservation.contractStatus ?? null);
  if (currentContractStatus && TERMINAL_CONTRACT_STATUSES.has(currentContractStatus)) {
    return false;
  }
  return reservation.type !== 'return';
}

function getReservationStartTimestamp(reservation: Reservation): number | null {
  if (typeof reservation.scheduledStartAt === 'string' && reservation.scheduledStartAt.trim()) {
    const parsed = Date.parse(reservation.scheduledStartAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof reservation.startDateFull === 'string' && reservation.startDateFull.trim()) {
    const parsed = Date.parse(reservation.startDateFull);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.isFinite(reservation.startDate) ? reservation.startDate : null;
}

function canStartReservationNow(reservation: Reservation, now = Date.now()): boolean {
  if (reservation.type !== 'reservation') {
    return false;
  }
  const startTimestamp = getReservationStartTimestamp(reservation);
  if (startTimestamp === null) {
    return true;
  }
  return startTimestamp <= now;
}

function resolveReservationAttachmentContentType(file: File): string {
  if (file.type.trim()) {
    return file.type.trim();
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.mp4')) {
    return 'video/mp4';
  }
  if (lowerName.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (lowerName.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}

async function uploadReservationCreationDocument(file: File, reservationId: string): Promise<string> {
  const contentType = resolveReservationAttachmentContentType(file);
  const signedUpload = await signAssetUpload({
    fileName: file.name,
    folder: `reservations/${reservationId}/documents`,
    contentType,
    fileSize: file.size,
  });
  await uploadFileToSignedUrl(signedUpload.uploadUrl, file, signedUpload.contentType || contentType);
  return signedUpload.objectName;
}

function applySyncedPaymentStatusToReservation(
  reservation: Reservation,
  syncedPaymentStatus: PaymentStatusSnapshot,
): Reservation {
  if (syncedPaymentStatus.status === 'not-found' || syncedPaymentStatus.status === 'unknown') {
    return reservation;
  }

  const nextPaymentStatus = toReservationPaymentStatus(syncedPaymentStatus.status);
  const nextIssues = isUnpaidPaymentStatus(syncedPaymentStatus.status)
    ? withIssueLabel(reservation.issues, '미납/결제 문제')
    : withoutPaymentIssueLabels(reservation.issues);

  return {
    ...reservation,
    paymentStatus: nextPaymentStatus,
    additionalPaymentAmount: (
      normalizeAdditionalPaymentAmount(syncedPaymentStatus.additionalAmount)
      ?? normalizeAdditionalPaymentAmount(syncedPaymentStatus.amount)
      ?? reservation.additionalPaymentAmount
    ),
    paymentMethod: syncedPaymentStatus.method
      ? normalizePaymentMethod(syncedPaymentStatus.method)
      : reservation.paymentMethod,
    paymentInfo: {
      paymentId: syncedPaymentStatus.paymentId ?? reservation.paymentInfo?.paymentId,
      reservationId: syncedPaymentStatus.reservationId ?? reservation.id,
      status: syncedPaymentStatus.status,
      amount: normalizeAdditionalPaymentAmount(syncedPaymentStatus.amount) ?? (reservation.paymentInfo?.amount ?? 0),
      principalAmount: normalizeAdditionalPaymentAmount(syncedPaymentStatus.principalAmount) ?? (reservation.paymentInfo?.principalAmount ?? 0),
      additionalAmount: normalizeAdditionalPaymentAmount(syncedPaymentStatus.additionalAmount) ?? (
        reservation.paymentInfo?.additionalAmount ?? reservation.additionalPaymentAmount ?? 0
      ),
      overdueDays: Math.max(0, Math.trunc(normalizeAdditionalPaymentAmount(syncedPaymentStatus.overdueDays) ?? reservation.paymentInfo?.overdueDays ?? 0)),
      dueDate: syncedPaymentStatus.dueDate ?? reservation.paymentInfo?.dueDate,
      method: syncedPaymentStatus.method ?? reservation.paymentInfo?.method ?? reservation.paymentMethod,
      updatedAt: syncedPaymentStatus.updatedAt ?? reservation.paymentInfo?.updatedAt,
    },
    issues: nextIssues,
  };
}

function applyCompletedPaymentToReservation(reservation: Reservation): Reservation {
  const principalAmount = reservation.paymentInfo?.principalAmount ?? (toCurrencyNumberValue(reservation.amount) ?? 0);
  const additionalAmount = reservation.paymentInfo?.additionalAmount ?? (reservation.additionalPaymentAmount ?? 0);
  const totalAmount = reservation.paymentInfo?.amount ?? (principalAmount + additionalAmount);
  return {
    ...reservation,
    paymentStatus: toReservationPaymentStatus('paid'),
    hasPaymentInfo: true,
    additionalPaymentAmount: additionalAmount,
    paymentInfo: {
      ...reservation.paymentInfo,
      reservationId: reservation.id,
      status: 'paid',
      amount: totalAmount,
      principalAmount,
      additionalAmount,
      overdueDays: reservation.paymentInfo?.overdueDays ?? 0,
      method: reservation.paymentInfo?.method ?? reservation.paymentMethod,
      updatedAt: reservation.paymentInfo?.updatedAt,
    },
    issues: withoutPaymentIssueLabels(reservation.issues),
  };
}

function applyUnpaidPaymentToReservation(
  reservation: Reservation,
  { amount }: { amount: number },
): Reservation {
  return {
    ...reservation,
    paymentStatus: toReservationPaymentStatus('unpaid'),
    hasPaymentInfo: true,
    additionalPaymentAmount: Math.max(amount, 0),
    paymentInfo: {
      ...reservation.paymentInfo,
      reservationId: reservation.id,
      status: 'overdue',
      amount: reservation.paymentInfo?.amount ?? Math.max(amount, 0),
      principalAmount: reservation.paymentInfo?.principalAmount ?? (toCurrencyNumberValue(reservation.amount) ?? 0),
      additionalAmount: Math.max(amount, 0),
      overdueDays: reservation.paymentInfo?.overdueDays ?? 0,
      method: reservation.paymentInfo?.method ?? reservation.paymentMethod,
      updatedAt: reservation.paymentInfo?.updatedAt,
    },
    issues: withIssueLabel(reservation.issues, '미납/결제 문제'),
  };
}

function canManageReservationPaymentIssue(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): boolean {
  const effectiveStatus = paymentSnapshot?.status === 'not-found'
    ? toCanonicalPaymentStatus(reservation.paymentStatus)
    : paymentSnapshot?.status ?? toCanonicalPaymentStatus(reservation.paymentStatus);
  return effectiveStatus === 'pending' || effectiveStatus === 'unpaid' || effectiveStatus === 'partial';
}

export function canMarkReservationPaymentAsPaid(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): boolean {
  return canManageReservationPaymentIssue(reservation, paymentSnapshot);
}

export function getReservationPaymentMutationId(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): string {
  return paymentSnapshot?.paymentId?.trim() || `AUTO-PAY-${reservation.id}`;
}

function formatDateAsYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateFromOffset(offset: number): Date {
  const date = new Date(CALENDAR_BASE_DATE);
  date.setDate(CALENDAR_BASE_DATE.getDate() + offset);
  return date;
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

function toReservationParty(value: unknown): ReservationParty | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const party: ReservationParty = {
    type: toStringValue(value.type) ?? undefined,
    source: toStringValue(value.source) ?? undefined,
    name: toStringValue(value.name) ?? undefined,
    organizationName: toStringValue(value.organizationName) ?? undefined,
    contactName: toStringValue(value.contactName) ?? undefined,
    phone: toStringValue(value.phone) ?? undefined,
    businessNumber: toStringValue(value.businessNumber) ?? undefined,
    address: toStringValue(value.address) ?? undefined,
    licenseNumber: toStringValue(value.licenseNumber) ?? undefined,
    licenseDocumentObjectName: toStringValue(value.licenseDocumentObjectName) ?? undefined,
    billingAccount: toStringValue(value.billingAccount) ?? undefined,
    insurerName: toStringValue(value.insurerName) ?? undefined,
    claimNo: toStringValue(value.claimNo) ?? undefined,
    externalRequestNo: toStringValue(value.externalRequestNo) ?? undefined,
  };
  return Object.values(party).some(Boolean) ? party : undefined;
}

function toReservationParties(value: unknown): ReservationParties | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const additionalDrivers = Array.isArray(value.additionalDrivers)
    ? value.additionalDrivers
      .map(toReservationParty)
      .filter((party): party is ReservationParty => Boolean(party))
    : undefined;
  const parties: ReservationParties = {
    contractor: toReservationParty(value.contractor),
    driver: toReservationParty(value.driver),
    additionalDrivers: additionalDrivers && additionalDrivers.length > 0 ? additionalDrivers : undefined,
    requester: toReservationParty(value.requester),
    payer: toReservationParty(value.payer),
  };
  return Object.values(parties).some(Boolean) ? parties : undefined;
}

function toReservationDocumentChecklist(value: unknown): ReservationDocumentChecklistItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const toDocumentDetail = (detailValue: unknown) => {
    if (!isRecord(detailValue)) {
      return undefined;
    }
    const objectName = toStringValue(detailValue.objectName);
    if (!objectName) {
      return undefined;
    }
    return {
      objectName,
      fileName: toStringValue(detailValue.fileName) ?? undefined,
      contentType: toStringValue(detailValue.contentType) ?? undefined,
      url: toStringValue(detailValue.url) ?? undefined,
      documentType: toStringValue(detailValue.documentType) ?? undefined,
    };
  };
  const items = value
    .filter(isRecord)
    .map((item): ReservationDocumentChecklistItem | null => {
      const key = toStringValue(item.key);
      const label = toStringValue(item.label);
      const status = toStringValue(item.status);
      if (!key || !label || !status) {
        return null;
      }
      const detail = toDocumentDetail(item.detail);
      const details = Array.isArray(item.details)
        ? item.details.map(toDocumentDetail).filter((row): row is NonNullable<typeof detail> => Boolean(row))
        : undefined;
      return {
        key,
        label,
        status,
        required: item.required === true,
        objectName: toStringValue(item.objectName) ?? undefined,
        detail,
        details: details && details.length > 0 ? details : undefined,
        reasonType: toStringValue(item.reasonType) ?? undefined,
      };
    })
    .filter((item): item is ReservationDocumentChecklistItem => item !== null);
  return items.length > 0 ? items : undefined;
}

function reservationDocumentStatusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return '완료';
    case 'missing':
      return '누락';
    case 'optional':
      return '선택';
    case 'pickup_blocked':
      return '인수 전 필요';
    case 'action_required':
      return '조치 필요';
    case 'not_applicable':
      return '해당 없음';
    default:
      return status;
  }
}

function reservationDocumentStatusClass(status: string): string {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'pickup_blocked':
    case 'action_required':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'missing':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'optional':
    case 'not_applicable':
      return 'border-gray-200 bg-gray-50 text-gray-600';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function reservationDisplayName(row: Record<string, unknown>, parties: ReservationParties | undefined): string {
  return parties?.driver?.name
    ?? parties?.contractor?.name
    ?? parties?.requester?.organizationName
    ?? parties?.requester?.name
    ?? '고객 미확인';
}

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  const text = toStringValue(value)?.toLowerCase();
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  return null;
}

function parseReservationMemoValue(memo: unknown, key: string): string | null {
  const memoText = toStringValue(memo);
  if (!memoText) {
    return null;
  }

  const entries = memoText.split(',');
  for (const entry of entries) {
    const [entryKey, ...entryValueParts] = entry.split('=');
    if (!entryKey || entryValueParts.length === 0) {
      continue;
    }
    if (entryKey.trim() !== key) {
      continue;
    }
    const value = entryValueParts.join('=').trim();
    if (value) {
      return value;
    }
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

function normalizeDateParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  return formatDateAsYmd(parsedDate);
}

function normalizeDueFilter(value: string | null): DueFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'pickup' || normalized === 'start') {
    return 'pickup';
  }
  if (normalized === 'return' || normalized === 'end') {
    return 'return';
  }
  return null;
}

function toDateOffset(value: unknown): number | null {
  const numericOffset = toNumberValue(value);
  if (numericOffset !== null) {
    return numericOffset;
  }

  const dateString = toStringValue(value);
  if (!dateString) {
    return null;
  }

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const parsedDayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
  return Math.floor((parsedDayStart.getTime() - CALENDAR_BASE_DATE.getTime()) / (1000 * 60 * 60 * 24));
}

function toDateLabelFromOffset(offset: number): string {
  return formatDateAsYmd(toDateFromOffset(offset));
}

function calendarStartOffsetForTarget(targetOffset: number): number {
  return targetOffset - CALENDAR_TODAY_LEFT_OFFSET_DAYS;
}

type ReservationFetchWindow = {
  from: string;
  to: string;
};

type ReservationCalendarCachePayload = {
  expiresAt: number;
  total: number;
  reservations: Reservation[];
  vehicleAssets: VehicleAsset[];
};

function toOffsetFromDateLabel(value: string): number | null {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return null;
  }
  return differenceInDays(CALENDAR_BASE_DATE, parsed);
}

function buildReservationFetchWindows({
  currentWeekStart,
  totalDaysToShow,
  fromDate,
  toDate,
}: {
  currentWeekStart: number;
  totalDaysToShow: number;
  fromDate: string | null;
  toDate: string | null;
}): ReservationFetchWindow[] {
  const visibleStartOffset = currentWeekStart - RESERVATION_FETCH_BUFFER_BEFORE_DAYS;
  const visibleEndOffset = currentWeekStart + totalDaysToShow - 1 + RESERVATION_FETCH_BUFFER_AFTER_DAYS;
  const explicitFromOffset = fromDate ? toOffsetFromDateLabel(fromDate) : null;
  const explicitToOffset = toDate ? toOffsetFromDateLabel(toDate) : null;
  const hasExplicitDateRange = Boolean(fromDate || toDate);
  const boundedStartOffset = hasExplicitDateRange
    ? explicitFromOffset ?? visibleStartOffset
    : visibleStartOffset;
  const boundedEndOffset = hasExplicitDateRange
    ? explicitToOffset ?? visibleEndOffset
    : visibleEndOffset;

  if (boundedStartOffset > boundedEndOffset) {
    return [];
  }

  const windows: ReservationFetchWindow[] = [];
  let windowStart = boundedStartOffset;
  while (windowStart <= boundedEndOffset) {
    const windowEnd = Math.min(
      windowStart + RESERVATION_MAX_FETCH_WINDOW_DAYS - 1,
      boundedEndOffset,
    );
    windows.push({
      from: toDateLabelFromOffset(windowStart),
      to: toDateLabelFromOffset(windowEnd),
    });
    windowStart = windowEnd + 1;
  }
  return windows;
}

function readReservationCalendarCache(cacheKey: string): ReservationCalendarCachePayload | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const rawValue = window.sessionStorage.getItem(cacheKey);
    if (!rawValue) {
      return null;
    }
    const parsedValue = JSON.parse(rawValue) as Partial<ReservationCalendarCachePayload>;
    if (
      !parsedValue
      || typeof parsedValue.expiresAt !== 'number'
      || parsedValue.expiresAt <= Date.now()
      || !Array.isArray(parsedValue.reservations)
      || !Array.isArray(parsedValue.vehicleAssets)
    ) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }
    return {
      expiresAt: parsedValue.expiresAt,
      total: typeof parsedValue.total === 'number' ? parsedValue.total : parsedValue.reservations.length,
      reservations: parsedValue.reservations as Reservation[],
      vehicleAssets: parsedValue.vehicleAssets as VehicleAsset[],
    };
  } catch {
    return null;
  }
}

function writeReservationCalendarCache(
  cacheKey: string,
  payload: Omit<ReservationCalendarCachePayload, 'expiresAt'>,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify({
      ...payload,
      expiresAt: Date.now() + RESERVATION_CALENDAR_CACHE_TTL_MS,
    }));
  } catch {
    // sessionStorage quota or privacy restrictions should not block page rendering.
  }
}

type ReservationCalendarSegment = {
  kind: 'scheduled' | 'overdue';
  startDate: number;
  endDate: number;
};

function getReservationReturnedDateOffset(reservation: Reservation): number | null {
  if (typeof reservation.returnedAt !== 'string' || !reservation.returnedAt.trim()) {
    return null;
  }

  return toDateOffset(reservation.returnedAt);
}

function parseReservationDateTime(value: string | undefined): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function hasReturnedLate(reservation: Reservation, scheduledEndAt: Date | null, returnedAtDate: Date | null): boolean {
  if (reservation.lateReturn === true) {
    return true;
  }
  if (reservation.lateReturn === false) {
    return false;
  }
  if (isReservationLateReturn(reservation)) {
    return true;
  }
  return scheduledEndAt !== null && returnedAtDate !== null && returnedAtDate > scheduledEndAt;
}

export function getReservationOverdueSegment(
  reservation: Reservation,
  todayOffset = 0,
  referenceNow: Date = new Date(),
): ReservationCalendarSegment | null {
  if (reservation.type === 'reservation') {
    return null;
  }

  const scheduledEndAt = parseReservationDateTime(reservation.scheduledEndAt);
  const returnedAtDate = parseReservationDateTime(reservation.returnedAt);
  const overdueStartDate = reservation.endDate + 1;
  const returnedDateOffset = getReservationReturnedDateOffset(reservation);

  if (returnedDateOffset !== null) {
    if (!hasReturnedLate(reservation, scheduledEndAt, returnedAtDate)) {
      return null;
    }
    const hasSameDayLateReturn = (
      scheduledEndAt !== null
      && returnedAtDate !== null
      && returnedAtDate > scheduledEndAt
      && returnedDateOffset === reservation.endDate
    );
    if (hasSameDayLateReturn) {
      const overdueEndDate = Math.min(returnedDateOffset, todayOffset);
      if (overdueEndDate < reservation.endDate) {
        return null;
      }
      return {
        kind: 'overdue',
        startDate: reservation.endDate,
        endDate: overdueEndDate,
      };
    }

    const overdueEndDate = Math.min(returnedDateOffset, todayOffset);
    if (overdueEndDate < overdueStartDate) {
      return null;
    }

    return {
      kind: 'overdue',
      startDate: overdueStartDate,
      endDate: overdueEndDate,
    };
  }

  const currentContractStatus = normalizeReservationContractStatus(reservation.contractStatus ?? null);
  const isCompleted = reservation.type === 'return'
    || (currentContractStatus !== null && TERMINAL_CONTRACT_STATUSES.has(currentContractStatus));
  const isSameDayCurrentlyOverdue = (
    !isCompleted
    && scheduledEndAt !== null
    && referenceNow > scheduledEndAt
    && todayOffset === reservation.endDate
  );
  if (isSameDayCurrentlyOverdue) {
    return {
      kind: 'overdue',
      startDate: reservation.endDate,
      endDate: todayOffset,
    };
  }

  if (isCompleted || todayOffset < overdueStartDate) {
    return null;
  }

  return {
    kind: 'overdue',
    startDate: overdueStartDate,
    endDate: todayOffset,
  };
}

export function getReservationCalendarSegments(
  reservation: Reservation,
  todayOffset = 0,
): ReservationCalendarSegment[] {
  const segments: ReservationCalendarSegment[] = [
    {
      kind: 'scheduled',
      startDate: reservation.startDate,
      endDate: reservation.endDate,
    },
  ];

  const overdueSegment = getReservationOverdueSegment(reservation, todayOffset);
  if (overdueSegment) {
    segments.push(overdueSegment);
  }

  return segments;
}

function getReservationOccupiedEndDate(reservation: Reservation, todayOffset = 0): number {
  return getReservationOverdueSegment(reservation, todayOffset)?.endDate ?? reservation.endDate;
}

function doesReservationSegmentOverlapView(
  segment: ReservationCalendarSegment,
  viewStart: number,
  viewEnd: number,
): boolean {
  return !(segment.endDate < viewStart || segment.startDate > viewEnd);
}

function toCurrencyValue(value: unknown): string {
  const numericValue = toNumberValue(value);
  if (numericValue !== null) {
    return `${numericValue.toLocaleString('ko-KR')}원`;
  }

  const textValue = toStringValue(value);
  if (!textValue) {
    return '0원';
  }

  return textValue.endsWith('원') ? textValue : `${textValue}원`;
}

function toCurrencyNumberValue(value: unknown): number | null {
  const numericValue = toNumberValue(value);
  if (numericValue !== null) {
    return numericValue;
  }

  const textValue = toStringValue(value);
  if (!textValue) {
    return null;
  }
  const numericText = textValue.replace(/[^\d.-]/g, '');
  if (!numericText) {
    return null;
  }
  const parsed = Number(numericText);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function normalizeAdditionalPaymentAmount(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

function fallbackAdditionalPaymentAmountFromContract(amount: unknown, deposit: unknown): number {
  const amountValue = toCurrencyNumberValue(amount) ?? 0;
  const depositValue = toCurrencyNumberValue(deposit) ?? 0;
  return Math.max(amountValue - depositValue, 0);
}

function resolveReservationAdditionalPaymentAmount(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): number {
  const reservationInfo = reservation.paymentInfo;
  if (paymentSnapshot && paymentSnapshot.status !== 'not-found' && paymentSnapshot.status !== 'unknown') {
    const syncedAmount = normalizeAdditionalPaymentAmount(
      paymentSnapshot.additionalAmount ?? paymentSnapshot.amount,
    );
    if (syncedAmount !== null) {
      return syncedAmount;
    }
  }
  const fromReservationInfo = normalizeAdditionalPaymentAmount(reservationInfo?.additionalAmount);
  if (fromReservationInfo !== null) {
    return fromReservationInfo;
  }

  const reservationAmount = normalizeAdditionalPaymentAmount(reservation.additionalPaymentAmount);
  if (reservationAmount !== null) {
    return reservationAmount;
  }
  return fallbackAdditionalPaymentAmountFromContract(reservation.amount, reservation.deposit);
}

function resolveReservationPrincipalPaymentAmount(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): number {
  const fromReservationInfo = normalizeAdditionalPaymentAmount(reservation.paymentInfo?.principalAmount);
  if (fromReservationInfo !== null) {
    return fromReservationInfo;
  }
  const fromSnapshot = normalizeAdditionalPaymentAmount(paymentSnapshot?.principalAmount ?? null);
  if (fromSnapshot !== null) {
    return fromSnapshot;
  }
  return normalizeAdditionalPaymentAmount(toCurrencyNumberValue(reservation.amount)) ?? 0;
}

function resolveReservationTotalPaymentAmount(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): number {
  const fromReservationInfo = normalizeAdditionalPaymentAmount(reservation.paymentInfo?.amount);
  if (fromReservationInfo !== null) {
    return fromReservationInfo;
  }
  const fromSnapshot = normalizeAdditionalPaymentAmount(paymentSnapshot?.amount ?? null);
  if (fromSnapshot !== null) {
    return fromSnapshot;
  }
  const principalAmount = resolveReservationPrincipalPaymentAmount(reservation, paymentSnapshot);
  const additionalAmount = resolveReservationAdditionalPaymentAmount(reservation, paymentSnapshot);
  return principalAmount + additionalAmount;
}

function resolveReservationPaymentOverdueDays(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): number {
  const reservationDays = normalizeAdditionalPaymentAmount(reservation.paymentInfo?.overdueDays ?? null);
  if (reservationDays !== null) {
    return Math.max(0, Math.trunc(reservationDays));
  }
  const snapshotDays = normalizeAdditionalPaymentAmount(paymentSnapshot?.overdueDays ?? null);
  if (snapshotDays !== null) {
    return Math.max(0, Math.trunc(snapshotDays));
  }
  return 0;
}

function resolveReservationPaymentUpdatedAt(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): string | null {
  return toStringValue(reservation.paymentInfo?.updatedAt) ?? paymentSnapshot?.updatedAt ?? null;
}

function resolveReservationPaymentMethod(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): Reservation['paymentMethod'] {
  return normalizePaymentMethod(
    toStringValue(reservation.paymentInfo?.method)
      ?? paymentSnapshot?.method
      ?? reservation.paymentMethod
      ?? null,
  );
}

function resolveReservationPaymentStatus(
  reservation: Reservation,
  paymentSnapshot: PaymentStatusSnapshot | null,
): Reservation['paymentStatus'] {
  const reservationInfoStatus = toCanonicalPaymentStatus(toStringValue(reservation.paymentInfo?.status));
  if (reservationInfoStatus !== 'unknown' && reservationInfoStatus !== 'not-found') {
    return toReservationPaymentStatus(reservationInfoStatus);
  }
  const effectiveSnapshotStatus = paymentSnapshot?.status === 'not-found'
    ? toCanonicalPaymentStatus(reservation.paymentStatus)
    : paymentSnapshot?.status ?? toCanonicalPaymentStatus(reservation.paymentStatus);
  return toReservationPaymentStatus(effectiveSnapshotStatus);
}

function normalizeReservationType(value: string | null): Reservation['type'] {
  if (!value) {
    return 'reservation';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'reservation' || normalized === 'reserved' || normalized === '예약' || normalized === '예약중') {
    return 'reservation';
  }
  if (normalized === 'rental' || normalized === 'in_use' || normalized === '대여' || normalized === '대여중') {
    return 'rental';
  }
  if (normalized === 'return' || normalized === 'returned' || normalized === '반납' || normalized === '반납완료' || normalized === '완료') {
    return 'return';
  }

  return 'reservation';
}

function normalizePaymentMethod(value: string | null): Reservation['paymentMethod'] {
  if (value === '카드' || value?.toLowerCase() === 'card') {
    return '카드';
  }
  if (value === '현금' || value?.toLowerCase() === 'cash') {
    return '현금';
  }
  if (value === '계좌이체' || value?.toLowerCase() === 'transfer' || value?.toLowerCase() === 'bank_transfer') {
    return '계좌이체';
  }
  return '카드';
}

function toApiPaymentStatus(status: PaymentStatusCanonical): 'pending' | 'overdue' | 'partial' | 'paid' | 'canceled' {
  if (status === 'paid') {
    return 'paid';
  }
  if (status === 'canceled') {
    return 'canceled';
  }
  if (status === 'partial') {
    return 'partial';
  }
  if (status === 'unpaid') {
    return 'overdue';
  }
  return 'pending';
}

export function normalizeReservationPaymentStatus(value: string | null): Reservation['paymentStatus'] {
  return toReservationPaymentStatus(toCanonicalPaymentStatus(value));
}

export function isDelinquentPaymentScopeActive(viewFilter: ViewFilter, paymentScope: PaymentScope): boolean {
  return viewFilter === 'unpaid' && paymentScope === 'delinquent';
}

export function matchesReservationFilters(
  reservation: Reservation,
  options: {
    viewFilter: ViewFilter;
    paymentScope: PaymentScope;
    rentalTypeFilter?: RentalTypeFilter;
    workflowStatusFilter?: WorkflowStatusFilter;
    closeoutStatusFilter?: CloseoutStatusFilter;
    cancellationSettlementStatusFilter?: CancellationSettlementStatusFilter;
    longTermAccountStatusFilter?: LongTermAccountStatusFilter;
    accidentReplacementStatusFilter?: AccidentReplacementStatusFilter;
    searchQuery: string;
  },
): boolean {
  const {
    viewFilter,
    paymentScope,
    rentalTypeFilter = 'all',
    workflowStatusFilter = 'all',
    closeoutStatusFilter = 'all',
    cancellationSettlementStatusFilter = 'all',
    longTermAccountStatusFilter = 'all',
    accidentReplacementStatusFilter = 'all',
    searchQuery,
  } = options;

  if (rentalTypeFilter !== 'all' && (reservation.rentalType ?? 'short_term') !== rentalTypeFilter) {
    return false;
  }
  if (workflowStatusFilter !== 'all' && reservation.workflowStatus !== workflowStatusFilter) {
    return false;
  }
  if (closeoutStatusFilter !== 'all' && reservation.closeoutStatus !== closeoutStatusFilter) {
    return false;
  }
  if (
    cancellationSettlementStatusFilter !== 'all'
    && reservation.cancellationSettlementStatus !== cancellationSettlementStatusFilter
  ) {
    return false;
  }
  if (longTermAccountStatusFilter !== 'all' && reservation.longTermAccountStatus !== longTermAccountStatusFilter) {
    return false;
  }
  if (accidentReplacementStatusFilter !== 'all' && reservation.accidentReplacementStatus !== accidentReplacementStatusFilter) {
    return false;
  }
  if (viewFilter === 'unpaid' && !isDelinquentPaymentScopeActive(viewFilter, paymentScope) && !hasPaymentIssueLabel(reservation.issues)) {
    return false;
  }
  if (!searchQuery) {
    return true;
  }
  const normalizedSearch = searchQuery.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }
  const parties = reservation.parties ?? {};
  const accidentClaim = reservation.accidentClaim;
  const searchableValues = [
    reservation.id,
    reservation.vehicleNumber,
    reservation.vin,
    reservation.customer,
    reservation.phone,
    parties.driver?.name,
    parties.driver?.phone,
    parties.driver?.licenseNumber,
    parties.contractor?.name,
    parties.contractor?.organizationName,
    parties.contractor?.contactName,
    parties.contractor?.phone,
    parties.requester?.name,
    parties.requester?.organizationName,
    parties.requester?.phone,
    parties.payer?.name,
    parties.payer?.organizationName,
    parties.payer?.contactName,
    parties.payer?.phone,
    parties.payer?.insurerName,
    parties.payer?.claimNo,
    accidentClaim?.insurerName,
    accidentClaim?.claimNo,
    accidentClaim?.repairShopName,
    accidentClaim?.requesterName,
    accidentClaim?.requesterOrganizationName,
    accidentClaim?.requesterPhone,
  ];
  return searchableValues.some((value) => String(value ?? '').trim().toLowerCase().includes(normalizedSearch));
}

function normalizeRentalTypeFilter(value: string | null): RentalTypeFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'short_term' || normalized === 'long_term' || normalized === 'accident_replacement') {
    return normalized;
  }
  return 'all';
}

function normalizeWorkflowStatusFilter(value: string | null): WorkflowStatusFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized in WORKFLOW_STATUS_LABELS) {
    return normalized as WorkflowStatusFilter;
  }
  return 'all';
}

function normalizeCloseoutStatusFilter(value: string | null): CloseoutStatusFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized in CLOSEOUT_STATUS_LABELS) {
    return normalized as CloseoutStatusFilter;
  }
  return 'all';
}

function normalizeCancellationSettlementStatusFilter(value: string | null): CancellationSettlementStatusFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized in CANCELLATION_SETTLEMENT_STATUS_LABELS) {
    return normalized as CancellationSettlementStatusFilter;
  }
  return 'all';
}

function normalizeLongTermAccountStatusFilter(value: string | null): LongTermAccountStatusFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized in LONG_TERM_ACCOUNT_STATUS_LABELS) {
    return normalized as LongTermAccountStatusFilter;
  }
  return 'all';
}

function normalizeAccidentReplacementStatusFilter(value: string | null): AccidentReplacementStatusFilter {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized in ACCIDENT_REPLACEMENT_STATUS_LABELS) {
    return normalized as AccidentReplacementStatusFilter;
  }
  return 'all';
}

function getWorkflowStatusLabel(value: string | null | undefined, fallback?: string): string {
  const normalized = normalizeWorkflowStatusFilter(value ?? null);
  return normalized === 'all' ? (fallback || value || '-') : WORKFLOW_STATUS_LABELS[normalized];
}

function getCloseoutStatusLabel(value: string | null | undefined, fallback?: string): string {
  const normalized = normalizeCloseoutStatusFilter(value ?? null);
  return normalized === 'all' ? (fallback || value || '-') : CLOSEOUT_STATUS_LABELS[normalized];
}

function getCancellationSettlementStatusLabel(value: string | null | undefined, fallback?: string): string {
  const normalized = normalizeCancellationSettlementStatusFilter(value ?? null);
  return normalized === 'all' ? (fallback || value || '-') : CANCELLATION_SETTLEMENT_STATUS_LABELS[normalized];
}

function getLongTermAccountStatusLabel(value: string | null | undefined, fallback?: string): string {
  const normalized = normalizeLongTermAccountStatusFilter(value ?? null);
  return normalized === 'all' ? (fallback || value || '-') : LONG_TERM_ACCOUNT_STATUS_LABELS[normalized];
}

function getAccidentReplacementStatusLabel(value: string | null | undefined, fallback?: string): string {
  const normalized = normalizeAccidentReplacementStatusFilter(value ?? null);
  return normalized === 'all' ? (fallback || value || '-') : ACCIDENT_REPLACEMENT_STATUS_LABELS[normalized];
}

function getRentalTypeBadgeLabel(value: string | null | undefined): string {
  if (value === 'long_term') {
    return '장기';
  }
  if (value === 'accident_replacement') {
    return '대차';
  }
  return '단기';
}

function normalizeViewFilter(value: string | null): ViewFilter {
  if (!value) {
    return 'all';
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return 'all';
  }
  if (normalized === 'reservation' || normalized === 'reserved' || normalized === '예약' || normalized === '예약중') {
    return 'reservation';
  }
  if (normalized === 'rental' || normalized === '대여' || normalized === '대여중' || normalized === 'in_use') {
    return 'rental';
  }
  if (normalized === 'return' || normalized === 'returned' || normalized === '반납' || normalized === '반납완료' || normalized === '완료') {
    return 'return';
  }
  if (normalized === 'unpaid' || normalized === '미납') {
    return 'unpaid';
  }
  if (normalized === 'overdue' || normalized === '연체' || normalized === 'late') {
    return 'overdue';
  }
  return 'all';
}

function normalizePaymentScope(value: string | null): PaymentScope {
  if (!value) {
    return 'all';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'delinquent') {
    return 'delinquent';
  }
  return 'all';
}

function toStatusQueryValue(filterValue: ViewFilter, dueFilter: DueFilter): string | undefined {
  if (filterValue === 'return' && dueFilter === 'return') {
    return 'rental';
  }
  if (filterValue === 'all' || filterValue === 'unpaid' || filterValue === 'overdue') {
    return undefined;
  }
  return filterValue;
}

function toApiContractStatus(filterValue: ViewFilter, dueFilter: DueFilter): string | undefined {
  if (filterValue === 'return' && dueFilter === 'return') {
    return '대여중';
  }
  if (filterValue === 'reservation') {
    return '예약중';
  }
  if (filterValue === 'rental') {
    return '대여중';
  }
  if (filterValue === 'return') {
    return '완료';
  }
  if (filterValue === 'overdue') {
    return '대여중';
  }
  return undefined;
}

function normalizeIssues(issueValue: unknown): string[] {
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

function toTotalCount(payload: unknown, fallbackValue: number): number {
  if (!isRecord(payload)) {
    return fallbackValue;
  }

  for (const key of TOTAL_COUNT_KEYS) {
    const countValue = toNumberValue(payload[key]);
    if (countValue !== null) {
      return countValue;
    }
  }

  if (isRecord(payload.meta)) {
    for (const key of TOTAL_COUNT_KEYS) {
      const countValue = toNumberValue(payload.meta[key]);
      if (countValue !== null) {
        return countValue;
      }
    }
  }

  return fallbackValue;
}

function toMemberDisplayName(member: SettingsMember): string | null {
  const name = toStringValue(member.name);
  if (name) {
    return name;
  }
  return toStringValue(member.email) ?? toStringValue(member.userId);
}

function toReservationChargeItem(row: unknown): ReservationChargeItem | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = toStringValue(row.id);
  if (!id) {
    return null;
  }
  const amount = normalizeAdditionalPaymentAmount(toCurrencyNumberValue(row.amount)) ?? 0;
  const paidAmount = normalizeAdditionalPaymentAmount(toCurrencyNumberValue(row.paidAmount)) ?? 0;
  const remainingAmount = normalizeAdditionalPaymentAmount(toCurrencyNumberValue(row.remainingAmount)) ?? Math.max(amount - paidAmount, 0);
  const changeHistory = toBillingChangeHistory(row.changeHistory);
  const evidenceRefs = Array.isArray(row.evidenceRefs)
    ? row.evidenceRefs
      .filter(isRecord)
      .map((ref) => ({
        objectName: toStringValue(ref.objectName) ?? '',
        fileName: toStringValue(ref.fileName) ?? undefined,
        contentType: toStringValue(ref.contentType) ?? undefined,
        attachedAt: toStringValue(ref.attachedAt) ?? undefined,
        attachedByName: toStringValue(ref.attachedByName) ?? undefined,
      }))
      .filter((ref) => Boolean(ref.objectName))
    : undefined;
  return {
    id,
    reservationId: toStringValue(row.reservationId) ?? undefined,
    rentalType: toStringValue(row.rentalType) ?? undefined,
    sequenceNo: toNumberValue(row.sequenceNo) ?? undefined,
    chargeType: toStringValue(row.chargeType) ?? 'rental_fee',
    payerType: toStringValue(row.payerType) ?? undefined,
    billingPeriodStart: toStringValue(row.billingPeriodStart) ?? undefined,
    billingPeriodEnd: toStringValue(row.billingPeriodEnd) ?? undefined,
    dueDate: toStringValue(row.dueDate) ?? undefined,
    amount,
    paidAmount,
    remainingAmount,
    status: toStringValue(row.status) ?? 'pending',
    memo: toStringValue(row.memo) ?? undefined,
    refundCompletedAt: toStringValue(row.refundCompletedAt) ?? undefined,
    refundMethod: toStringValue(row.refundMethod) ?? undefined,
    refundReason: toStringValue(row.refundReason) ?? undefined,
    evidenceRefs,
    changeHistory,
  };
}

function toBillingChangeHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const rows = value
    .filter(isRecord)
    .map((entry) => ({
      action: toStringValue(entry.action) ?? undefined,
      changedAt: toStringValue(entry.changedAt) ?? undefined,
      changedByName: toStringValue(entry.changedByName) ?? undefined,
      changedBy: toStringValue(entry.changedBy) ?? undefined,
      changes: isRecord(entry.changes) ? entry.changes : undefined,
    }));
  return rows.length > 0 ? rows : undefined;
}

function formatBillingChangeValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
  }
  if (typeof value === 'boolean') {
    return value ? '예' : '아니오';
  }
  if (Array.isArray(value)) {
    return `${value.length}건`;
  }
  if (isRecord(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatBillingChangeSummary(changes: Record<string, { from?: unknown; to?: unknown }> | undefined): string {
  if (!changes) {
    return '';
  }
  return Object.entries(changes)
    .slice(0, 4)
    .map(([field, diff]) => `${field}: ${formatBillingChangeValue(diff?.from)} -> ${formatBillingChangeValue(diff?.to)}`)
    .join(' / ');
}

function getChargeItemPayerChangeLabel(item: ReservationChargeItem, defaultPayerType: string | undefined): string | null {
  const currentPayerType = item.payerType ?? defaultPayerType;
  if (!defaultPayerType || !currentPayerType || currentPayerType === defaultPayerType) {
    return null;
  }
  const payerTypeChange = item.changeHistory
    ?.slice()
    .reverse()
    .find((entry) => entry.changes?.payerType);
  if (payerTypeChange?.changes?.payerType) {
    const payerTypeDiff = payerTypeChange.changes.payerType;
    const fromLabel = getPayerTypeLabel(String(payerTypeDiff.from ?? defaultPayerType));
    const toLabel = getPayerTypeLabel(String(payerTypeDiff.to ?? currentPayerType));
    const changedAtLabel = payerTypeChange.changedAt ? formatDateKst(payerTypeChange.changedAt, '-') : null;
    return changedAtLabel ? `${changedAtLabel}부터 ${fromLabel} -> ${toLabel}` : `${fromLabel} -> ${toLabel}`;
  }
  return `기본 청구처와 다름: ${getPayerTypeLabel(currentPayerType)}`;
}

function toReservationChargeItems(value: unknown): ReservationChargeItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toReservationChargeItem(item))
    .filter((item): item is ReservationChargeItem => item !== null);
}

function toReservationPaymentRecord(row: unknown): ReservationPaymentRecord | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = toStringValue(row.id);
  if (!id) {
    return null;
  }
  const evidenceRefs = Array.isArray(row.evidenceRefs)
    ? row.evidenceRefs
      .filter(isRecord)
      .map((ref) => ({
        objectName: toStringValue(ref.objectName) ?? '',
        fileName: toStringValue(ref.fileName) ?? undefined,
        contentType: toStringValue(ref.contentType) ?? undefined,
        attachedAt: toStringValue(ref.attachedAt) ?? undefined,
        attachedByName: toStringValue(ref.attachedByName) ?? undefined,
      }))
      .filter((ref) => Boolean(ref.objectName))
    : undefined;
  return {
    id,
    reservationId: toStringValue(row.reservationId) ?? undefined,
    payerType: toStringValue(row.payerType) ?? undefined,
    paidAt: toStringValue(row.paidAt) ?? undefined,
    amount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(row.amount)) ?? 0,
    method: toStringValue(row.method) ?? undefined,
    confirmationStatus: toStringValue(row.confirmationStatus) ?? 'needs_confirmation',
    depositorName: toStringValue(row.depositorName) ?? undefined,
    approvalNo: toStringValue(row.approvalNo) ?? undefined,
    allocations: Array.isArray(row.allocations)
      ? row.allocations
        .filter(isRecord)
        .map((allocation) => ({
          chargeItemId: toStringValue(allocation.chargeItemId) ?? undefined,
          amount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(allocation.amount)) ?? undefined,
        }))
      : undefined,
    memo: toStringValue(row.memo) ?? undefined,
    evidenceRefs,
    status: toStringValue(row.status) ?? undefined,
    changeHistory: toBillingChangeHistory(row.changeHistory),
  };
}

function toReservationPaymentRecords(value: unknown): ReservationPaymentRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toReservationPaymentRecord(item))
    .filter((item): item is ReservationPaymentRecord => item !== null);
}

function toReservationBillingSummary(value: unknown): ReservationBillingSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const chargeItems = toReservationChargeItems(value.chargeItems);
  const paymentRecords = toReservationPaymentRecords(value.paymentRecords);
  const billingPlan = isRecord(value.billingPlan)
    ? {
      id: toStringValue(value.billingPlan.id) ?? undefined,
      reservationId: toStringValue(value.billingPlan.reservationId) ?? undefined,
      monthlyAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.billingPlan.monthlyAmount)) ?? undefined,
      billingDay: toNumberValue(value.billingPlan.billingDay) ?? undefined,
      billingTiming: toStringValue(value.billingPlan.billingTiming) ?? undefined,
      cycleMonths: toNumberValue(value.billingPlan.cycleMonths) ?? undefined,
      graceDays: toNumberValue(value.billingPlan.graceDays) ?? undefined,
      deposit: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.billingPlan.deposit)) ?? undefined,
      advancePayment: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.billingPlan.advancePayment)) ?? undefined,
      installmentCount: toNumberValue(value.billingPlan.installmentCount) ?? undefined,
      payerType: toStringValue(value.billingPlan.payerType) ?? undefined,
    }
    : null;
  return {
    reservationId: toStringValue(value.reservationId) ?? undefined,
    paymentSummaryStatus: toStringValue(value.paymentSummaryStatus) ?? 'none',
    paymentSummaryLabel: toStringValue(value.paymentSummaryLabel) ?? '결제정보 없음',
    totalAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.totalAmount)) ?? 0,
    paidAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.paidAmount)) ?? 0,
    remainingAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.remainingAmount)) ?? 0,
    overdueAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.overdueAmount)) ?? 0,
    refundAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.refundAmount)) ?? 0,
    chargeItemCount: Math.max(0, Math.trunc(toNumberValue(value.chargeItemCount) ?? chargeItems.length)),
    paymentRecordCount: Math.max(0, Math.trunc(toNumberValue(value.paymentRecordCount) ?? paymentRecords.length)),
    confirmationNeededCount: Math.max(0, Math.trunc(toNumberValue(value.confirmationNeededCount) ?? 0)),
    currency: toStringValue(value.currency) ?? undefined,
    billingPlan,
    chargeItems,
    paymentRecords,
  };
}

function toReservationAccidentClaim(value: unknown): ReservationAccidentClaim | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    id: toStringValue(value.id) ?? undefined,
    reservationId: toStringValue(value.reservationId) ?? undefined,
    requestSource: toStringValue(value.requestSource) ?? undefined,
    requesterOrganizationName: toStringValue(value.requesterOrganizationName) ?? undefined,
    requesterName: toStringValue(value.requesterName) ?? undefined,
    requesterPhone: toStringValue(value.requesterPhone) ?? undefined,
    insurerName: toStringValue(value.insurerName) ?? undefined,
    claimNo: toStringValue(value.claimNo) ?? undefined,
    adjusterName: toStringValue(value.adjusterName) ?? undefined,
    adjusterPhone: toStringValue(value.adjusterPhone) ?? undefined,
    repairShopName: toStringValue(value.repairShopName) ?? undefined,
    repairShopLocation: toStringValue(value.repairShopLocation) ?? undefined,
    repairCompletedAt: toStringValue(value.repairCompletedAt) ?? undefined,
    damagedVehicleNumber: toStringValue(value.damagedVehicleNumber) ?? undefined,
    damagedVehicleModel: toStringValue(value.damagedVehicleModel) ?? undefined,
    deliveryLocation: toStringValue(value.deliveryLocation) ?? undefined,
    billedAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.billedAmount)) ?? undefined,
    recognizedAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.recognizedAmount)) ?? undefined,
    differenceAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.differenceAmount)) ?? undefined,
    differencePayerType: toStringValue(value.differencePayerType) ?? undefined,
    documentStatus: toStringValue(value.documentStatus) ?? undefined,
    claimStatus: toStringValue(value.claimStatus) ?? undefined,
    documentObjectNames: Array.isArray(value.documentObjectNames)
      ? value.documentObjectNames.map((item) => toStringValue(item)).filter((item): item is string => Boolean(item))
      : undefined,
    submittedAt: toStringValue(value.submittedAt) ?? undefined,
    supplementMemo: toStringValue(value.supplementMemo) ?? undefined,
  };
}

function toReservationAccidentReport(value: unknown): ReservationAccidentReport | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    accidentDate: toStringValue(value.accidentDate) ?? undefined,
    accidentDateTime: toStringValue(value.accidentDateTime) ?? undefined,
    accidentDisplayTime: toStringValue(value.accidentDisplayTime) ?? undefined,
    blackboxFileName: toStringValue(value.blackboxFileName) ?? undefined,
    blackboxGcsObjectName: toStringValue(value.blackboxGcsObjectName) ?? undefined,
    handlerName: toStringValue(value.handlerName) ?? undefined,
    accidentLocation: toStringValue(value.accidentLocation) ?? undefined,
    opponentInfo: toStringValue(value.opponentInfo) ?? undefined,
    insuranceClaimNo: toStringValue(value.insuranceClaimNo) ?? undefined,
    evidenceStatus: toStringValue(value.evidenceStatus) ?? undefined,
    insuranceProcessStatus: toStringValue(value.insuranceProcessStatus) ?? undefined,
    repairCompletedAt: toStringValue(value.repairCompletedAt) ?? undefined,
    customerChargeAmount: normalizeAdditionalPaymentAmount(toCurrencyNumberValue(value.customerChargeAmount)) ?? undefined,
    customerChargeStatus: toStringValue(value.customerChargeStatus) ?? undefined,
    followupUpdatedAt: toStringValue(value.followupUpdatedAt) ?? undefined,
    memo: toStringValue(value.memo) ?? undefined,
  };
}

function getChargeTypeLabel(value: string | undefined): string {
  switch ((value ?? '').trim()) {
    case 'rental_fee':
      return '대여료';
    case 'additional_fee':
      return '추가비용';
    case 'monthly_fee':
      return '월 렌트료';
    case 'late_fee':
      return '연체료';
    case 'fuel_fee':
      return '유류비';
    case 'toll_fee':
      return '통행료';
    case 'damage_fee':
      return '손상비';
    case 'insurance_claim':
      return '보험청구';
    case 'deductible':
      return '자기부담금';
    case 'refund':
      return '환불';
    case 'cancellation_fee':
      return '취소수수료';
    case 'adjustment':
      return '정정';
    default:
      return value || '청구항목';
  }
}

function getChargeItemPeriodLabel(item: ReservationChargeItem): string | null {
  if (item.billingPeriodStart && item.billingPeriodEnd) {
    return `${item.billingPeriodStart}~${item.billingPeriodEnd}`;
  }
  return item.billingPeriodStart || item.billingPeriodEnd || null;
}

function getPayerTypeLabel(value: string | undefined): string {
  switch ((value ?? '').trim()) {
    case 'customer':
      return '고객';
    case 'insurer':
      return '보험사';
    case 'repair_shop':
      return '정비소';
    case 'partner':
      return '제휴처';
    default:
      return value || '-';
  }
}

function getChargeStatusLabel(value: string | undefined): string {
  switch ((value ?? '').trim()) {
    case 'paid':
      return '완납';
    case 'partial':
      return '부분납부';
    case 'overdue':
      return '연체';
    case 'waived':
      return '면제';
    case 'refund_due':
      return '환불필요';
    case 'disputed':
      return '보류';
    case 'scheduled':
      return '예정';
    case 'pending':
      return '대기';
    default:
      return value || '대기';
  }
}

function toReservationPaymentInfo(
  row: Record<string, unknown>,
  options: {
    reservationId: string;
    paymentMethodSource: string | null;
    paymentStatusSource: string | null;
    additionalPaymentAmount: number | null;
    hasPaymentInfo: boolean;
  },
): Reservation['paymentInfo'] | undefined {
  const {
    reservationId,
    paymentMethodSource,
    paymentStatusSource,
    additionalPaymentAmount,
    hasPaymentInfo,
  } = options;
  const paymentSource = isRecord(row.paymentInfo)
    ? row.paymentInfo
    : isRecord(row.payment)
      ? row.payment
      : null;
  const paymentId = toStringValue(paymentSource?.paymentId ?? paymentSource?.id) ?? toStringValue(row.paymentId);
  const method = toStringValue(paymentSource?.method ?? paymentSource?.paymentMethod ?? paymentSource?.paymentType) ?? paymentMethodSource;
  const status = toStringValue(paymentSource?.status ?? paymentSource?.paymentStatus) ?? paymentStatusSource;
  const principalAmount = normalizeAdditionalPaymentAmount(
    toCurrencyNumberValue(paymentSource?.principalAmount) ?? toCurrencyNumberValue(row.amount),
  ) ?? 0;
  const additionalAmount = normalizeAdditionalPaymentAmount(
    toCurrencyNumberValue(paymentSource?.additionalAmount) ?? additionalPaymentAmount,
  ) ?? 0;
  const amount = normalizeAdditionalPaymentAmount(toCurrencyNumberValue(paymentSource?.amount)) ?? (principalAmount + additionalAmount);
  const overdueDays = Math.max(0, Math.trunc(normalizeAdditionalPaymentAmount(toNumberValue(paymentSource?.overdueDays)) ?? 0));
  const dueDate = toStringValue(paymentSource?.dueDate ?? paymentSource?.paymentDueDate)
    ?? toStringValue(row.paymentDueDate)
    ?? toStringValue(row.dueDate);
  const updatedAt = toStringValue(paymentSource?.updatedAt) ?? toStringValue(row.updatedAt);
  if (
    !hasPaymentInfo
    && !paymentId
    && !method
    && !status
    && !dueDate
    && amount === 0
    && principalAmount === 0
    && additionalAmount === 0
    && overdueDays === 0
  ) {
    return undefined;
  }
  return {
    paymentId: paymentId ?? undefined,
    reservationId,
    status: status ?? undefined,
    amount,
    principalAmount,
    additionalAmount,
    overdueDays,
    dueDate: dueDate ?? undefined,
    method: method ?? undefined,
    updatedAt: updatedAt ?? undefined,
  };
}

function toReservationRow(row: unknown, index: number): Reservation | null {
  if (!isRecord(row)) {
    return null;
  }

  const vehicleNumber = toStringValue(row.vehicleNumber) ?? toStringValue(row.plateNumber) ?? toStringValue(row.plate);
  const fallbackVehicleNumber = vehicleNumber
    ?? toStringValue(row.vin)
    ?? toStringValue(row.reservationId)
    ?? toStringValue(row.rentalId)
    ?? toStringValue(row.id);
  if (!fallbackVehicleNumber) {
    return null;
  }

  const parties = toReservationParties(row.parties);
  const customer = reservationDisplayName(row, parties);
  const reservationId = toStringValue(row.id)
    ?? toStringValue(row.reservationId)
    ?? toStringValue(row.rentalId)
    ?? `R${String(index + 1).padStart(3, '0')}`;

  const startSource = row.startAt ?? row.startDateFull ?? row.startDate ?? row.from;
  const endSource = row.endAt ?? row.endDateFull ?? row.endDate ?? row.to;
  const startDateOffset = toDateOffset(startSource) ?? 0;
  const endDateOffsetCandidate = toDateOffset(endSource) ?? startDateOffset;
  const endDateOffset = endDateOffsetCandidate < startDateOffset ? startDateOffset : endDateOffsetCandidate;

  const startDateLabel = normalizeDateParam(toStringValue(startSource)) ?? toDateLabelFromOffset(startDateOffset);
  const endDateLabel = normalizeDateParam(toStringValue(endSource)) ?? toDateLabelFromOffset(endDateOffset);
  const issues = normalizeIssues(row.issues);
  const accidentReported = toBooleanValue(row.accidentReported) === true;
  const lateReturn = toBooleanValue(row.lateReturn);
  const contractStatus = normalizeReservationContractStatus(
    toStringValue(row.contractStatus) ?? toStringValue(row.status) ?? toStringValue(row.type),
  );
  if (accidentReported && !issues.includes('사고 접수')) {
    issues.unshift('사고 접수');
  }

  const paymentMethodSource = null;
  const billingSummary = toReservationBillingSummary(row.billingSummary);
  const chargeItemsPreview = toReservationChargeItems(row.chargeItemsPreview);
  const accidentClaim = toReservationAccidentClaim(row.accidentClaim);
  const accidentReport = toReservationAccidentReport(row.accidentReport);
  const documentChecklist = toReservationDocumentChecklist(row.documentChecklist);
  const paymentStatusSource = toStringValue(row.paymentSummaryStatus);
  const hasPaymentInfo = (
    paymentMethodSource !== null
    || paymentStatusSource !== null
    || Boolean(billingSummary)
  );
  const additionalPaymentAmount = normalizeAdditionalPaymentAmount(
    toCurrencyNumberValue(row.additionalPaymentAmount)
    ?? toCurrencyNumberValue(row.unpaidAmount)
    ?? toCurrencyNumberValue(row.remainingAmount)
    ?? toCurrencyNumberValue(row.outstandingAmount),
  );
  const paymentInfo = toReservationPaymentInfo(
    row,
    {
      reservationId,
      paymentMethodSource,
      paymentStatusSource,
      additionalPaymentAmount,
      hasPaymentInfo,
    },
  );

  return {
    id: reservationId,
    companyId: toStringValue(row.companyId) ?? undefined,
    rentalType: toStringValue(row.rentalType) ?? undefined,
    creationMode: toStringValue(row.creationMode) ?? undefined,
    vehicleNumber: fallbackVehicleNumber,
    vin: toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? undefined,
    customer,
    startDate: startDateOffset,
    endDate: endDateOffset,
    returnedAt: toStringValue(row.returnedAt) ?? undefined,
    lateReturn: lateReturn ?? undefined,
    scheduledStartAt: toStringValue(startSource) ?? undefined,
    scheduledEndAt: toStringValue(endSource) ?? undefined,
    contractStatus: contractStatus ?? undefined,
    workflowStatus: toStringValue(row.workflowStatus) ?? undefined,
    workflowStatusLabel: toStringValue(row.workflowStatusLabel) ?? undefined,
    closeoutStatus: toStringValue(row.closeoutStatus) ?? undefined,
    closeoutStatusLabel: toStringValue(row.closeoutStatusLabel) ?? undefined,
    cancellationSettlementStatus: toStringValue(row.cancellationSettlementStatus) ?? undefined,
    cancellationSettlementStatusLabel: toStringValue(row.cancellationSettlementStatusLabel) ?? undefined,
    longTermAccountStatus: toStringValue(row.longTermAccountStatus) ?? undefined,
    longTermAccountStatusLabel: toStringValue(row.longTermAccountStatusLabel) ?? undefined,
    accidentReplacementStatus: toStringValue(row.accidentReplacementStatus) ?? undefined,
    accidentReplacementStatusLabel: toStringValue(row.accidentReplacementStatusLabel) ?? undefined,
    workflowVersion: toNumberValue(row.workflowVersion) ?? undefined,
    type: normalizeReservationType(contractStatus ?? toStringValue(row.type) ?? toStringValue(row.status)),
    issues,
    phone: (
      parties?.driver?.phone
      ?? '-'
    ),
    paymentMethod: normalizePaymentMethod(paymentMethodSource),
    amount: toCurrencyValue(row.amount),
    deposit: toCurrencyValue(row.deposit),
    licenseDocumentObjectName: parties?.driver?.licenseDocumentObjectName ?? undefined,
    contractDocumentObjectName: toStringValue(row.contractDocumentObjectName) ?? undefined,
    contractDocumentType: toStringValue(row.contractDocumentType) ?? undefined,
    contractDocuments: Array.isArray(row.contractDocuments)
      ? row.contractDocuments
        .filter(isRecord)
        .map((item) => ({
          objectName: toStringValue(item.objectName) ?? '',
          fileName: toStringValue(item.fileName) ?? undefined,
          documentType: toStringValue(item.documentType) ?? undefined,
        }))
        .filter((item) => item.objectName)
      : undefined,
    documentChecklist,
    paymentStatus: normalizeReservationPaymentStatus(paymentStatusSource),
    hasPaymentInfo: hasPaymentInfo || Boolean(paymentInfo),
    additionalPaymentAmount: additionalPaymentAmount ?? undefined,
    paymentInfo,
    paymentSummaryStatus: toStringValue(row.paymentSummaryStatus) ?? billingSummary?.paymentSummaryStatus ?? undefined,
    billingSummary,
    chargeItemsPreview: chargeItemsPreview.length > 0 ? chargeItemsPreview : undefined,
    accidentClaim,
    accidentReport,
    parties,
    startDateFull: startDateLabel,
    endDateFull: endDateLabel,
  };
}

function toReservationRows(payload: unknown): Reservation[] {
  const rows = getCollectionFromPayload(payload, ['reservations', 'items', 'rows', 'list']);
  if (!rows) {
    return [];
  }

  if (rows.length === 0) {
    return [];
  }

  const normalizedRows: Reservation[] = rows
    .map((row, index) => toReservationRow(row, index))
    .filter((row): row is Reservation => row !== null);

  return normalizedRows;
}

function mergeReservationDetail(detailRow: Reservation, fallbackReservation: Reservation): Reservation {
  const mergedReservation: Reservation = {
    ...fallbackReservation,
    ...detailRow,
  };
  if (detailRow.phone === '-' && fallbackReservation.phone !== '-') {
    mergedReservation.phone = fallbackReservation.phone;
  }
  if (!detailRow.paymentInfo && fallbackReservation.paymentInfo) {
    mergedReservation.paymentInfo = fallbackReservation.paymentInfo;
  }
  if (!detailRow.billingSummary && fallbackReservation.billingSummary) {
    mergedReservation.billingSummary = fallbackReservation.billingSummary;
  }
  if (!detailRow.chargeItemsPreview && fallbackReservation.chargeItemsPreview) {
    mergedReservation.chargeItemsPreview = fallbackReservation.chargeItemsPreview;
  }
  if (!detailRow.accidentClaim && fallbackReservation.accidentClaim) {
    mergedReservation.accidentClaim = fallbackReservation.accidentClaim;
  }
  if (!detailRow.accidentReport && fallbackReservation.accidentReport) {
    mergedReservation.accidentReport = fallbackReservation.accidentReport;
  }
  return mergedReservation;
}

function toReservationDetail(payload: unknown, fallbackReservation: Reservation): Reservation {
  if (isRecord(payload)) {
    const detailCandidate = payload.item
      ?? payload.reservation
      ?? payload.detail
      ?? payload.data
      ?? payload.record;

    const detailRow = toReservationRow(detailCandidate, 0);
    if (detailRow) {
      return mergeReservationDetail(detailRow, fallbackReservation);
    }
  }

  const directDetailRow = toReservationRow(payload, 0);
  if (directDetailRow) {
    return mergeReservationDetail(directDetailRow, fallbackReservation);
  }

  return fallbackReservation;
}

function isLateReturnIssueLabel(value: string | null): boolean {
  return value?.replace(/\s+/g, '') === '반납지연';
}

function extractActionItemId(row: unknown, fallbackIndex: number): string | null {
  if (!isRecord(row)) {
    return null;
  }
  return (
    toStringValue(row.id)
    ?? toStringValue(row.actionId)
    ?? toStringValue(row.actionItemId)
    ?? toStringValue(row.paymentId)
    ?? `action-${fallbackIndex + 1}`
  );
}

function extractActionItemType(row: unknown): string | null {
  if (!isRecord(row)) {
    return null;
  }
  return (
    toStringValue(row.type)
    ?? toStringValue(row.category)
    ?? toStringValue(row.issueType)
    ?? toStringValue(row.issue)
    ?? toStringValue(row.title)
  );
}

function extractActionItemField(row: unknown, fieldNames: string[]): string | null {
  if (!isRecord(row)) {
    return null;
  }
  for (const fieldName of fieldNames) {
    const value = toStringValue(row[fieldName]);
    if (value) {
      return value;
    }
  }
  return null;
}

function toReservationActiveActionItem(row: unknown, index: number): ReservationActiveActionItem | null {
  const id = extractActionItemId(row, index);
  if (!id) {
    return null;
  }

  const category = extractActionItemField(row, ['category', 'mainCategory', 'type', 'issueType', 'issue']);
  const subCategory = extractActionItemField(row, ['subCategory', 'subcategory', 'sub_category']);
  const reasonType = extractActionItemField(row, ['reasonType', 'reason_type']);
  const issueCode = extractActionItemField(row, ['issueCode', 'issue_code', 'code']);
  const title = extractActionItemField(row, ['title', 'label', 'name']);
  const fallbackLabel = extractActionItemType(row) ?? title ?? issueCode;
  const mainLabel = normalizeActionMainCategory(category ?? fallbackLabel) ?? category ?? fallbackLabel;

  if (!mainLabel) {
    return null;
  }

  const normalizedSubLabel = normalizeActionSubCategory(mainLabel, subCategory, reasonType);
  const subLabelCandidate = normalizedSubLabel ?? title ?? issueCode ?? undefined;
  const subLabel = subLabelCandidate && subLabelCandidate !== mainLabel ? subLabelCandidate : undefined;
  const label = subLabel ? `${mainLabel} / ${subLabel}` : mainLabel;
  const status = isRecord(row) ? toStringValue(row.status) ?? undefined : undefined;

  return {
    id,
    label,
    mainLabel,
    subLabel,
    status,
  };
}

function toReservationActiveActionItems(payload: unknown): ReservationActiveActionItem[] {
  const rows = getCollectionFromPayload(payload, ['items', 'rows', 'list', 'actionRequired', 'actionItems']) ?? [];
  return rows
    .map((row, index) => toReservationActiveActionItem(row, index))
    .filter((item): item is ReservationActiveActionItem => item !== null);
}

function normalizeVehicleStatus(statusValue: string | null): VehicleAsset['status'] {
  if (statusValue === '대여중' || statusValue === '예약' || statusValue === '가용' || statusValue === '정비중') {
    return statusValue;
  }
  if (statusValue === 'reserved' || statusValue === '예약됨') {
    return '예약';
  }
  if (statusValue === 'rental' || statusValue === 'in_use') {
    return '대여중';
  }
  if (statusValue === 'maintenance' || statusValue === 'repair') {
    return '정비중';
  }
  return '가용';
}

function normalizeVehicleOperatingStatus(statusValue: string | null): VehicleAsset['vehicleOperatingStatus'] {
  const normalized = statusValue?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'rental' || normalized === 'rented' || normalized === 'in_use' || statusValue === '대여중') {
    return 'rented';
  }
  if (normalized === 'reserved' || statusValue === '예약' || statusValue === '예약됨' || statusValue === '예약중') {
    return 'reserved';
  }
  if (normalized === 'available' || normalized === 'idle' || statusValue === '가용') {
    return 'available';
  }
  if (normalized === 'maintenance' || normalized === 'repair' || statusValue === '정비중') {
    return 'maintenance';
  }
  if (normalized === 'returned' || normalized === 'return' || statusValue === '반납됨' || statusValue === '반납완료') {
    return 'returned';
  }
  if (normalized === 'recovery_required' || normalized === 'recovery' || statusValue === '회수필요') {
    return 'recovery_required';
  }
  if (normalized === 'recovered' || statusValue === '회수완료') {
    return 'recovered';
  }
  return undefined;
}

function toVehicleStatusFromReservation(reservationType: Reservation['type']): VehicleAsset['status'] {
  if (reservationType === 'reservation') {
    return '예약';
  }
  if (reservationType === 'rental') {
    return '대여중';
  }
  return '가용';
}

function isReservationLateReturn(reservation: Reservation | null): boolean {
  if (!reservation || reservation.type !== 'rental') {
    return false;
  }
  if (reservation.issues?.includes('반납 지연')) {
    return true;
  }
  return reservation.endDate < 0;
}

function createFallbackVehicleAsset(reservation: Reservation): VehicleAsset {
  return {
    vehicleNumber: reservation.vehicleNumber,
    model: '차종 미확인',
    status: toVehicleStatusFromReservation(reservation.type),
    issues: reservation.issues ?? [],
    insuranceExpiry: '-',
    nextInspection: '-',
    vin: '-',
    year: '-',
    owner: '-',
  };
}

function toVehicleRows(payload: unknown, reservationRows: Reservation[]): VehicleAsset[] {
  const fallbackVehicleMap = new Map<string, VehicleAsset>();
  reservationRows.forEach((reservation) => {
    fallbackVehicleMap.set(reservation.vehicleNumber, createFallbackVehicleAsset(reservation));
  });

  const rows = getCollectionFromPayload(payload, ['vehicleAssets', 'vehicles', 'assets']);
  if (!rows) {
    return Array.from(fallbackVehicleMap.values());
  }

  const normalizedRows: VehicleAsset[] = rows
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }

      const vehicleNumber = toStringValue(row.vehicleNumber) ?? toStringValue(row.plateNumber) ?? toStringValue(row.plate);
      if (!vehicleNumber) {
        return null;
      }

      return {
        vehicleNumber,
        model: toStringValue(row.model) ?? toStringValue(row.vehicleModel) ?? '차종 미확인',
        status: normalizeVehicleStatus(
          toStringValue(row.status) ?? toStringValue(row.contractStatus) ?? toStringValue(row.assetStatus),
        ),
        vehicleOperatingStatus: normalizeVehicleOperatingStatus(
          toStringValue(row.vehicleOperatingStatus)
          ?? toStringValue(row.status)
          ?? toStringValue(row.contractStatus)
          ?? toStringValue(row.assetStatus),
        ),
        vehicleOperatingStatusLabel: toStringValue(row.vehicleOperatingStatusLabel) ?? undefined,
        issues: normalizeIssues(row.issues),
        insuranceExpiry: toStringValue(row.insuranceExpiry) ?? toStringValue(row.insuranceExpiryDate) ?? '-',
        nextInspection: toStringValue(row.nextInspection) ?? toStringValue(row.nextInspectionDate) ?? '-',
        vin: toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? '-',
        year: toStringValue(row.year) ?? toStringValue(row.modelYear) ?? '-',
        owner: toStringValue(row.owner) ?? toStringValue(row.ownerName) ?? '-',
      };
    })
    .filter((row): row is VehicleAsset => row !== null);

  normalizedRows.forEach((vehicleAsset) => {
    fallbackVehicleMap.set(vehicleAsset.vehicleNumber, vehicleAsset);
  });

  return Array.from(fallbackVehicleMap.values());
}

export default function Reservations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canPerformAction, canAccessRoute } = useAuthorization();
  const canWriteReservations = canPerformAction(ACTION_PERMISSIONS.reservationsWrite);
  const canWritePayments = canPerformAction(ACTION_PERMISSIONS.paymentsWrite);
  const canTransitionReservations = canWriteReservations
    && ['admin', 'super_admin'].includes((user?.role ?? '').trim().toLowerCase());
  const canViewAssets = canAccessRoute(ROUTE_PERMISSIONS.assets);
  const canViewActionRequired = canAccessRoute(ROUTE_PERMISSIONS.actionRequired);
  const page = DEFAULT_PAGE;
  const pageSize = DEFAULT_PAGE_SIZE;
  const fromDate = normalizeDateParam(searchParams.get('from'));
  const toDate = normalizeDateParam(searchParams.get('to'));
  const dueFilter = normalizeDueFilter(searchParams.get('due'));
  const searchQuery = searchParams.get('q') ?? searchParams.get('search') ?? '';
  const viewFilter = normalizeViewFilter(
    searchParams.get('status') ?? searchParams.get('filter') ?? searchParams.get('contractStatus'),
  );
  const paymentScope = normalizePaymentScope(searchParams.get('paymentScope'));
  const rentalTypeFilter = normalizeRentalTypeFilter(searchParams.get('rentalType'));
  const workflowStatusFilter = normalizeWorkflowStatusFilter(searchParams.get('workflowStatus'));
  const closeoutStatusFilter = normalizeCloseoutStatusFilter(searchParams.get('closeoutStatus'));
  const cancellationSettlementStatusFilter = normalizeCancellationSettlementStatusFilter(searchParams.get('cancellationSettlementStatus'));
  const longTermAccountStatusFilter = normalizeLongTermAccountStatusFilter(searchParams.get('longTermAccountStatus'));
  const accidentReplacementStatusFilter = normalizeAccidentReplacementStatusFilter(searchParams.get('accidentReplacementStatus'));

  const [currentWeekStart, setCurrentWeekStart] = useState(() => calendarStartOffsetForTarget(0));
  const [customerSearchDraft, setCustomerSearchDraft] = useState(searchQuery);
  const [showModal, setShowModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedVehicleAsset, setSelectedVehicleAsset] = useState<VehicleAsset | null>(null);
  const [modelFilter, setModelFilter] = useState('all');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'reservation' | 'payment' | 'vehicle'>('reservation');
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showAccidentModal, setShowAccidentModal] = useState(false);
  const [accidentAssigneeOptions, setAccidentAssigneeOptions] = useState<AccidentReportAssigneeOption[]>([]);
  const [isAccidentAssigneeLoading, setIsAccidentAssigneeLoading] = useState(false);
  const [accidentAssigneeLoadError, setAccidentAssigneeLoadError] = useState<string | null>(null);
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [vehicleAssets, setVehicleAssets] = useState<VehicleAsset[]>([]);
  const [garageLocationOptions, setGarageLocationOptions] = useState<SettingsGarage[]>([]);
  const [targetDate, setTargetDate] = useState(() => toDateLabelFromOffset(0));
  const [totalReservationCount, setTotalReservationCount] = useState(0);
  const [pageErrorStatus, setPageErrorStatus] = useState<number | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailNotFound, setIsDetailNotFound] = useState(false);
  const [isReturnSubmitting, setIsReturnSubmitting] = useState(false);
  const [returnSubmitError, setReturnSubmitError] = useState<string | null>(null);
  const [pendingLateReturnActionItemId, setPendingLateReturnActionItemId] = useState<string | null>(null);
  const [resolvedLateReturnActionItemId, setResolvedLateReturnActionItemId] = useState<string | null>(null);
  const [lateReturnMemoDraft, setLateReturnMemoDraft] = useState('');
  const [lateReturnMemoSaveError, setLateReturnMemoSaveError] = useState<string | null>(null);
  const [isLateReturnMemoSaving, setIsLateReturnMemoSaving] = useState(false);
  const [isLateReturnMemoSaved, setIsLateReturnMemoSaved] = useState(false);
  const [isPaymentCompleting, setIsPaymentCompleting] = useState(false);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState('');
  const [paymentMethodDraft, setPaymentMethodDraft] = useState<Reservation['paymentMethod']>('카드');
  const [isPaymentMethodSaving, setIsPaymentMethodSaving] = useState(false);
  const [isPaymentAmountSaving, setIsPaymentAmountSaving] = useState(false);
  const [activePaymentRecordMutationId, setActivePaymentRecordMutationId] = useState<string | null>(null);
  const [activeReservationAction, setActiveReservationAction] = useState<'start' | 'cancel' | null>(null);
  const [showCancelReservationConfirm, setShowCancelReservationConfirm] = useState(false);
  const [reservationActionError, setReservationActionError] = useState<string | null>(null);
  const [reservationWarningPrompt, setReservationWarningPrompt] = useState<ReservationWarningPrompt | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editVin, setEditVin] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [activeReservationActionItems, setActiveReservationActionItems] = useState<ReservationActiveActionItem[]>([]);
  const [isActiveActionItemsLoading, setIsActiveActionItemsLoading] = useState(false);
  const [activeActionItemsError, setActiveActionItemsError] = useState<string | null>(null);

  // 동적 날짜 로딩을 위한 상태
  const [totalDaysToShow, setTotalDaysToShow] = useState(DEFAULT_TOTAL_DAYS_TO_SHOW); // 초기 6주
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const detailRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);
  const reservationWarningResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const customerSearchCompositionRef = useRef(false);
  const latestSearchQueryRef = useRef(searchQuery);
  const reservationCalendarCacheKey = useMemo(() => {
    const fetchWindows = buildReservationFetchWindows({
      currentWeekStart,
      totalDaysToShow,
      fromDate,
      toDate,
    });
    return [
      RESERVATION_CALENDAR_CACHE_KEY_PREFIX,
      user?.companyId ?? 'no-company',
      user?.userId ?? 'anonymous',
      viewFilter,
      dueFilter ?? 'none',
      paymentScope,
      workflowStatusFilter,
      closeoutStatusFilter,
      cancellationSettlementStatusFilter,
      longTermAccountStatusFilter,
      accidentReplacementStatusFilter,
      fetchWindows.map((window) => `${window.from}..${window.to}`).join(','),
    ].join('|');
  }, [accidentReplacementStatusFilter, cancellationSettlementStatusFilter, closeoutStatusFilter, currentWeekStart, dueFilter, fromDate, longTermAccountStatusFilter, paymentScope, toDate, totalDaysToShow, user?.companyId, user?.userId, viewFilter, workflowStatusFilter]);

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection>(null);
  const [dragConflictPrompt, setDragConflictPrompt] = useState<DragConflictPrompt | null>(null);

  const paymentSyncTargets = useMemo(
    () => buildPaymentSyncTargets(reservationsData, selectedReservation),
    [reservationsData, selectedReservation],
  );

  const {
    byReservationId: syncedPaymentByReservationId,
    isSyncing: isPaymentSyncing,
    error: paymentSyncError,
    usingLastKnown: isPaymentSyncUsingLastKnown,
    retry: retryPaymentSync,
  } = usePaymentStatusSync({
    targets: paymentSyncTargets,
    enabled: reservationsData.length > 0,
    pollIntervalMs: 20_000,
  });

  const updateReservationSearchParams = useCallback((
    mutator: (params: URLSearchParams) => void,
    replace = false,
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    mutator(nextParams);

    if (!nextParams.get('status')) {
      nextParams.delete('status');
    }
    if (!nextParams.get('from')) {
      nextParams.delete('from');
    }
    if (!nextParams.get('to')) {
      nextParams.delete('to');
    }
    if (!nextParams.get('q')) {
      nextParams.delete('q');
    }
    if (!nextParams.get('due')) {
      nextParams.delete('due');
    }
    if (!nextParams.get('rentalType') || nextParams.get('rentalType') === 'all') {
      nextParams.delete('rentalType');
    }
    if (!nextParams.get('workflowStatus') || nextParams.get('workflowStatus') === 'all') {
      nextParams.delete('workflowStatus');
    }
    if (!nextParams.get('closeoutStatus') || nextParams.get('closeoutStatus') === 'all') {
      nextParams.delete('closeoutStatus');
    }
    if (!nextParams.get('cancellationSettlementStatus') || nextParams.get('cancellationSettlementStatus') === 'all') {
      nextParams.delete('cancellationSettlementStatus');
    }
    if (!nextParams.get('longTermAccountStatus') || nextParams.get('longTermAccountStatus') === 'all') {
      nextParams.delete('longTermAccountStatus');
    }
    if (!nextParams.get('accidentReplacementStatus') || nextParams.get('accidentReplacementStatus') === 'all') {
      nextParams.delete('accidentReplacementStatus');
    }

    nextParams.delete('filter');
    nextParams.delete('contractStatus');
    nextParams.delete('page');
    nextParams.delete('size');
    nextParams.delete('pageSize');
    nextParams.delete('search');

    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

  const commitCustomerSearchQuery = useCallback((value: string, replace = true) => {
    updateReservationSearchParams((params) => {
      const nextQuery = value.trim();
      if (nextQuery) {
        params.set('q', nextQuery);
      } else {
        params.delete('q');
      }
      params.set('page', String(DEFAULT_PAGE));
    }, replace);
  }, [updateReservationSearchParams]);

  useEffect(() => {
    if (searchQuery === latestSearchQueryRef.current) {
      return;
    }
    latestSearchQueryRef.current = searchQuery;
    if (!customerSearchCompositionRef.current) {
      setCustomerSearchDraft(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (customerSearchCompositionRef.current || customerSearchDraft === searchQuery) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      commitCustomerSearchQuery(customerSearchDraft);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [commitCustomerSearchQuery, customerSearchDraft, searchQuery]);

  const handleCustomerSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setCustomerSearchDraft(nextValue);
    if (!customerSearchCompositionRef.current && nextValue.trim() === '') {
      commitCustomerSearchQuery(nextValue);
    }
  }, [commitCustomerSearchQuery]);

  const handleCustomerSearchCompositionStart = useCallback((_event: CompositionEvent<HTMLInputElement>) => {
    customerSearchCompositionRef.current = true;
  }, []);

  const handleCustomerSearchCompositionEnd = useCallback((event: CompositionEvent<HTMLInputElement>) => {
    customerSearchCompositionRef.current = false;
    const nextValue = event.currentTarget.value;
    setCustomerSearchDraft(nextValue);
    commitCustomerSearchQuery(nextValue);
  }, [commitCustomerSearchQuery]);

  const handleCustomerSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitCustomerSearchQuery(event.currentTarget.value, false);
    }
  }, [commitCustomerSearchQuery]);

  const closeReturnConfirm = useCallback(() => {
    setShowReturnConfirm(false);
    setReturnSubmitError(null);
    setPendingLateReturnActionItemId(null);
    setResolvedLateReturnActionItemId(null);
    setLateReturnMemoDraft('');
    setLateReturnMemoSaveError(null);
    setIsLateReturnMemoSaving(false);
    setIsLateReturnMemoSaved(false);
  }, []);

  const findLateReturnActionItemId = useCallback(async (reservationId: string): Promise<string | null> => {
    const payload = await getActionRequiredList({
      page: 1,
      pageSize: 50,
      status: ACTIVE_ACTION_STATUS_QUERY,
      reservationId,
    });
    const rows = getCollectionFromPayload(payload, ['items', 'rows', 'list', 'actionRequired', 'actionItems']);
    if (!rows) {
      return null;
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const type = extractActionItemType(row);
      if (!isLateReturnIssueLabel(type)) {
        continue;
      }
      const actionItemId = extractActionItemId(row, index);
      if (actionItemId) {
        return actionItemId;
      }
    }

    return null;
  }, []);

  const hasInspectionIssueCardForVehicle = useCallback(async (vehicleNumber: string): Promise<boolean> => {
    const normalizedVehicleNumber = vehicleNumber.trim();
    if (!normalizedVehicleNumber) {
      return false;
    }

    const pageSize = 100;
    for (let page = 1; page <= 5; page += 1) {
      const payload = await getActionRequiredList({
        page,
        pageSize,
        status: ACTIVE_ACTION_STATUS_QUERY,
      });
      const rows = getCollectionFromPayload(payload, ['items', 'rows', 'list', 'actionRequired', 'actionItems']);
      if (!rows || rows.length === 0) {
        return false;
      }

      for (const row of rows) {
        if (!isRecord(row)) {
          continue;
        }
        const type = extractActionItemType(row);
        if (!type || !type.includes('정기점검')) {
          continue;
        }
        const rowVehicleNumber = toStringValue(row.vehicleNumber)
          ?? toStringValue(row.plate)
          ?? toStringValue(row.assetName)
          ?? '';
        if (rowVehicleNumber === normalizedVehicleNumber) {
          return true;
        }
      }

      if (rows.length < pageSize) {
        break;
      }
    }

    return false;
  }, []);


  useEffect(() => {
    const compatFilter = searchParams.get('filter');
    const compatContractStatus = searchParams.get('contractStatus');
    const compatSearch = searchParams.get('search');
    const canonicalStatus = searchParams.get('status');
    const canonicalQ = searchParams.get('q');
    const canonicalSize = searchParams.get('size');
    const compatPageSize = searchParams.get('pageSize');
    const currentDue = searchParams.get('due');
    const normalizedDue = normalizeDueFilter(currentDue);
    const currentPaymentScope = searchParams.get('paymentScope');
    const normalizedPaymentScope = normalizePaymentScope(currentPaymentScope);
    const normalizedFromDate = normalizeDateParam(searchParams.get('from'));
    const normalizedToDate = normalizeDateParam(searchParams.get('to'));
    const currentFromDate = searchParams.get('from');
    const currentToDate = searchParams.get('to');
    const currentWorkflowStatus = searchParams.get('workflowStatus');
    const normalizedWorkflowStatus = normalizeWorkflowStatusFilter(currentWorkflowStatus);
    const currentCloseoutStatus = searchParams.get('closeoutStatus');
    const normalizedCloseoutStatus = normalizeCloseoutStatusFilter(currentCloseoutStatus);
    const currentCancellationSettlementStatus = searchParams.get('cancellationSettlementStatus');
    const normalizedCancellationSettlementStatus = normalizeCancellationSettlementStatusFilter(currentCancellationSettlementStatus);
    const currentLongTermAccountStatus = searchParams.get('longTermAccountStatus');
    const normalizedLongTermAccountStatus = normalizeLongTermAccountStatusFilter(currentLongTermAccountStatus);
    const currentAccidentReplacementStatus = searchParams.get('accidentReplacementStatus');
    const normalizedAccidentReplacementStatus = normalizeAccidentReplacementStatusFilter(currentAccidentReplacementStatus);
    const normalizedStatus = normalizeViewFilter(canonicalStatus ?? compatFilter ?? compatContractStatus);
    const shouldNormalizeStatus = normalizedStatus !== 'all';

    const currentPage = searchParams.get('page');
    const needsNormalization = (
      Boolean(compatFilter)
      || Boolean(compatContractStatus)
      || Boolean(compatSearch)
      || Boolean(canonicalSize)
      || Boolean(compatPageSize)
      || Boolean(currentFromDate && normalizedFromDate && currentFromDate !== normalizedFromDate)
      || Boolean(currentToDate && normalizedToDate && currentToDate !== normalizedToDate)
      || Boolean(currentDue && currentDue !== normalizedDue)
      || Boolean(currentPaymentScope && (
        normalizedPaymentScope !== currentPaymentScope
        || !isDelinquentPaymentScopeActive(normalizedStatus, normalizedPaymentScope)
      ))
      || Boolean(currentWorkflowStatus && currentWorkflowStatus !== normalizedWorkflowStatus)
      || Boolean(currentCloseoutStatus && currentCloseoutStatus !== normalizedCloseoutStatus)
      || Boolean(currentCancellationSettlementStatus && currentCancellationSettlementStatus !== normalizedCancellationSettlementStatus)
      || Boolean(currentLongTermAccountStatus && currentLongTermAccountStatus !== normalizedLongTermAccountStatus)
      || Boolean(currentAccidentReplacementStatus && currentAccidentReplacementStatus !== normalizedAccidentReplacementStatus)
      || Boolean(canonicalStatus && normalizeViewFilter(canonicalStatus) !== canonicalStatus)
      || Boolean(currentPage)
    );

    if (!needsNormalization) {
      return;
    }

    updateReservationSearchParams((params) => {
      if (shouldNormalizeStatus) {
        params.set('status', normalizedStatus);
      } else {
        params.delete('status');
      }

      if (compatSearch && !canonicalQ) {
        params.set('q', compatSearch);
      }
      if (compatPageSize && !canonicalSize) {
        params.set('size', compatPageSize);
      }

      if (normalizedFromDate) {
        params.set('from', normalizedFromDate);
      } else {
        params.delete('from');
      }

      if (normalizedToDate) {
        params.set('to', normalizedToDate);
      } else {
        params.delete('to');
      }

      if (normalizedDue) {
        params.set('due', normalizedDue);
      } else {
        params.delete('due');
      }

      if (isDelinquentPaymentScopeActive(normalizedStatus, normalizedPaymentScope)) {
        params.set('paymentScope', 'delinquent');
      } else {
        params.delete('paymentScope');
      }

      if (normalizedWorkflowStatus !== 'all') {
        params.set('workflowStatus', normalizedWorkflowStatus);
      } else {
        params.delete('workflowStatus');
      }
      if (normalizedCloseoutStatus !== 'all') {
        params.set('closeoutStatus', normalizedCloseoutStatus);
      } else {
        params.delete('closeoutStatus');
      }
      if (normalizedCancellationSettlementStatus !== 'all') {
        params.set('cancellationSettlementStatus', normalizedCancellationSettlementStatus);
      } else {
        params.delete('cancellationSettlementStatus');
      }
      if (normalizedLongTermAccountStatus !== 'all') {
        if (normalizeRentalTypeFilter(searchParams.get('rentalType')) === 'long_term') {
          params.set('longTermAccountStatus', normalizedLongTermAccountStatus);
        } else {
          params.delete('longTermAccountStatus');
        }
      } else {
        params.delete('longTermAccountStatus');
      }
      if (normalizedAccidentReplacementStatus !== 'all') {
        if (normalizeRentalTypeFilter(searchParams.get('rentalType')) === 'accident_replacement') {
          params.set('accidentReplacementStatus', normalizedAccidentReplacementStatus);
        } else {
          params.delete('accidentReplacementStatus');
        }
      } else {
        params.delete('accidentReplacementStatus');
      }
    }, true);
  }, [searchParams, updateReservationSearchParams]);

  const applyReservationsHydrationPayload = useCallback((
    payload: ReservationsHydrationPayload,
    options: { cache?: boolean; transition?: boolean } = {},
  ) => {
    const reservationRows = toReservationRows(payload.reservationsPayload);
    const vehicleRows = mergeVehicleRows(payload.assetPayload ?? payload.reservationsPayload, reservationRows);
    const total = toTotalCount(payload.reservationsPayload, reservationRows.length);
    const applyState = () => {
      setReservationsData(reservationRows);
      setVehicleAssets(vehicleRows);
      setTotalReservationCount(total);
      setPageErrorStatus(null);
    };

    if (options.transition === false) {
      applyState();
    } else {
      startTransition(applyState);
    }

    if (options.cache !== false) {
      writeReservationCalendarCache(reservationCalendarCacheKey, {
        reservations: reservationRows,
        vehicleAssets: vehicleRows,
        total,
      });
    }
  }, [reservationCalendarCacheKey]);

  const requestReservations = useCallback(async (signal: AbortSignal) => {
    if (fromDate && toDate && fromDate > toDate) {
      setPageErrorStatus(400);
      throw new ApiError(
        'VALIDATION_ERROR',
        '조회 기간이 올바르지 않습니다. 시작일이 종료일보다 늦을 수 없습니다.',
        { status: 400 },
      );
    }

    try {
      const reservationsRequest = (async () => {
        const reservationRowsById = new Map<string, unknown>();
        const reservationRowsWithoutId: unknown[] = [];
        const fetchWindows = buildReservationFetchWindows({
          currentWeekStart,
          totalDaysToShow,
          fromDate,
          toDate,
        });

        if (fetchWindows.length === 0) {
          return {
            items: [],
            total: 0,
            page: DEFAULT_PAGE,
            size: RESERVATION_FETCH_PAGE_SIZE,
          };
        }

        for (const fetchWindow of fetchWindows) {
          let nextPage = DEFAULT_PAGE;
          let windowRowsCount = 0;
          let windowTotalCount = 0;

          while (true) {
            if (signal.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }

            const payload = await getReservationsList({
              page: nextPage,
              size: RESERVATION_FETCH_PAGE_SIZE,
              status: toStatusQueryValue(viewFilter, dueFilter),
              contractStatus: toApiContractStatus(viewFilter, dueFilter),
              workflowStatus: workflowStatusFilter === 'all' ? undefined : workflowStatusFilter,
              closeoutStatus: closeoutStatusFilter === 'all' ? undefined : closeoutStatusFilter,
              cancellationSettlementStatus: cancellationSettlementStatusFilter === 'all' ? undefined : cancellationSettlementStatusFilter,
              longTermAccountStatus: longTermAccountStatusFilter === 'all' ? undefined : longTermAccountStatusFilter,
              accidentReplacementStatus: accidentReplacementStatusFilter === 'all' ? undefined : accidentReplacementStatusFilter,
              paymentScope: isDelinquentPaymentScopeActive(viewFilter, paymentScope) ? 'delinquent' : undefined,
              from: fetchWindow.from,
              to: fetchWindow.to,
              due: viewFilter === 'overdue' ? 'overdue' : (dueFilter ?? undefined),
              signal,
            });

            const pageRows = getCollectionFromPayload(payload, ['reservations', 'items', 'rows', 'list']) ?? [];
            for (const row of pageRows) {
              const reservationId = isRecord(row)
                ? toStringValue(row.reservationId) ?? toStringValue(row.rentalId) ?? toStringValue(row.id)
                : null;
              if (reservationId) {
                reservationRowsById.set(reservationId, row);
              } else {
                reservationRowsWithoutId.push(row);
              }
            }
            windowRowsCount += pageRows.length;
            windowTotalCount = Math.max(windowTotalCount, toTotalCount(payload, windowRowsCount));
            const partialReservationRows = [
              ...reservationRowsById.values(),
              ...reservationRowsWithoutId,
            ];
            applyReservationsHydrationPayload({
              reservationsPayload: {
                items: partialReservationRows,
                total: partialReservationRows.length,
                page: DEFAULT_PAGE,
                size: RESERVATION_FETCH_PAGE_SIZE,
              },
            }, { cache: false });

            if (
              pageRows.length === 0
              || windowRowsCount >= windowTotalCount
              || pageRows.length < RESERVATION_FETCH_PAGE_SIZE
            ) {
              break;
            }

            nextPage += 1;
          }
        }

        const mergedReservationRows = [
          ...reservationRowsById.values(),
          ...reservationRowsWithoutId,
        ];
        return {
          items: mergedReservationRows,
          total: mergedReservationRows.length,
          page: DEFAULT_PAGE,
          size: RESERVATION_FETCH_PAGE_SIZE,
        };
      })();
      const assetRequest = canViewAssets
        ? (async () => {
          const assetRows: unknown[] = [];
          let nextPage = DEFAULT_PAGE;
          let totalCount = 0;

          while (true) {
            const payload = await getAssetsList({
              page: nextPage,
              size: ASSET_FALLBACK_PAGE_SIZE,
              signal,
            });
            const pageRows = getCollectionFromPayload(payload, ['vehicleAssets', 'vehicles', 'assets', 'items', 'rows', 'list']) ?? [];
            assetRows.push(...pageRows);
            totalCount = Math.max(totalCount, toTotalCount(payload, assetRows.length));
            if (pageRows.length === 0 || assetRows.length >= totalCount || pageRows.length < ASSET_FALLBACK_PAGE_SIZE) {
              return {
                ...(isRecord(payload) ? payload : {}),
                items: assetRows,
                total: totalCount || assetRows.length,
                page: DEFAULT_PAGE,
                pageSize: ASSET_FALLBACK_PAGE_SIZE,
              };
            }
            nextPage += 1;
          }
        })().catch(() => undefined)
        : Promise.resolve(undefined);

      const [reservationsPayload, assetPayload] = await Promise.all([reservationsRequest, assetRequest]);

      return {
        reservationsPayload,
        assetPayload,
      } satisfies ReservationsHydrationPayload;
    } catch (error) {
      setPageErrorStatus(error instanceof ApiError ? error.status ?? null : null);
      throw error;
    }
  }, [accidentReplacementStatusFilter, applyReservationsHydrationPayload, cancellationSettlementStatusFilter, canViewAssets, closeoutStatusFilter, currentWeekStart, dueFilter, fromDate, longTermAccountStatusFilter, paymentScope, toDate, totalDaysToShow, viewFilter, workflowStatusFilter]);

  const handleReservationsSuccess = useCallback((payload: ReservationsHydrationPayload) => {
    applyReservationsHydrationPayload(payload, { cache: true });
  }, [applyReservationsHydrationPayload]);

  const isReservationsResponseEmpty = useCallback((payload: ReservationsHydrationPayload) => {
    const rows = getCollectionFromPayload(payload.reservationsPayload, ['reservations', 'items', 'rows', 'list']);
    if (rows) {
      return rows.length === 0;
    }
    return isPayloadEmpty(payload.reservationsPayload, ['reservations', 'items', 'rows', 'list']);
  }, []);

  const {
    isLoading: isPageLoading,
    error: pageError,
    errorKind: pageErrorKind,
    run: hydrateReservationsData,
  } = usePageEndpointState<ReservationsHydrationPayload>({
    request: requestReservations,
    onSuccess: handleReservationsSuccess,
    isEmpty: isReservationsResponseEmpty,
  });

  useEffect(() => {
    const cachedPayload = readReservationCalendarCache(reservationCalendarCacheKey);
    if (!cachedPayload) {
      return;
    }

    setReservationsData(cachedPayload.reservations);
    setVehicleAssets(cachedPayload.vehicleAssets);
    setTotalReservationCount(cachedPayload.total);
    setPageErrorStatus(null);
  }, [reservationCalendarCacheKey]);

  useEffect(() => {
    void hydrateReservationsData();
  }, [hydrateReservationsData]);

  useEffect(() => {
    listSettingsGarages().then((payload) => {
      setGarageLocationOptions(Array.isArray(payload.items) ? payload.items : []);
    }).catch(() => {
      // garage loading is best-effort; fall back to free-text input
    });
  }, []);

  const handleCreateNewContractGarage = useCallback(async (payload: { name: string; address: string }): Promise<NewContractLocationOption> => {
    const createdGarage = await createSettingsGarage(payload);
    setGarageLocationOptions((previous) => [...previous, createdGarage]);
    toast.success('차고지가 등록되었습니다.');
    return createdGarage;
  }, []);

  useEffect(() => {
    if (!showAccidentModal || !selectedReservation) {
      return;
    }

    const targetCompanyId = selectedReservation.companyId ?? user?.companyId ?? undefined;
    const controller = new AbortController();
    setIsAccidentAssigneeLoading(true);
    setAccidentAssigneeLoadError(null);
    setAccidentAssigneeOptions([]);

    void listSettingsMembers('approved', {
      companyId: targetCompanyId,
      signal: controller.signal,
    }).then((payload) => {
      if (controller.signal.aborted) {
        return;
      }

      const rows = Array.isArray(payload.items) ? payload.items : [];
      const options = rows
        .map((member) => {
          const userId = toStringValue(member.userId);
          const label = toMemberDisplayName(member);
          if (!userId || !label) {
            return null;
          }
          return { userId, label } satisfies AccidentReportAssigneeOption;
        })
        .filter((row): row is AccidentReportAssigneeOption => row !== null);

      setAccidentAssigneeOptions(options);
      if (options.length === 0) {
        setAccidentAssigneeLoadError('해당 업체에 선택 가능한 승인된 직원이 없습니다.');
      }
    }).catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      if (error instanceof ApiError) {
        setAccidentAssigneeLoadError(error.message || '담당자 목록을 불러오지 못했습니다.');
      } else {
        setAccidentAssigneeLoadError('담당자 목록을 불러오지 못했습니다.');
      }
      setAccidentAssigneeOptions([]);
    }).finally(() => {
      if (!controller.signal.aborted) {
        setIsAccidentAssigneeLoading(false);
      }
    });

    return () => {
      controller.abort();
    };
  }, [selectedReservation, showAccidentModal, user?.companyId]);

  useEffect(() => () => {
    detailControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    setTargetDate(toDateLabelFromOffset(currentWeekStart + CALENDAR_TODAY_LEFT_OFFSET_DAYS));
  }, [currentWeekStart]);

  useEffect(() => {
    setSelectedReservation((previousReservation) => {
      if (!previousReservation) {
        return previousReservation;
      }

      const syncedPaymentStatus = syncedPaymentByReservationId[previousReservation.id];
      if (!syncedPaymentStatus) {
        return previousReservation;
      }

      const nextReservation = applySyncedPaymentStatusToReservation(previousReservation, syncedPaymentStatus);
      if (
        nextReservation.paymentStatus === previousReservation.paymentStatus
        && areIssueListsEqual(nextReservation.issues, previousReservation.issues)
      ) {
        return previousReservation;
      }

      return nextReservation;
    });
  }, [syncedPaymentByReservationId]);

  const handleReservationsRetry = useCallback(() => {
    void hydrateReservationsData();
  }, [hydrateReservationsData]);

  const resetReservationFilters = useCallback(() => {
    setModelFilter('all');
    setVehicleSearchQuery('');
    setCustomerSearchDraft('');
    updateReservationSearchParams((params) => {
      params.delete('status');
      params.delete('from');
      params.delete('to');
      params.delete('q');
      params.delete('due');
      params.delete('paymentScope');
      params.delete('rentalType');
      params.delete('workflowStatus');
      params.delete('closeoutStatus');
      params.delete('cancellationSettlementStatus');
      params.delete('longTermAccountStatus');
      params.delete('accidentReplacementStatus');
      params.set('page', String(DEFAULT_PAGE));
      params.set('size', String(DEFAULT_PAGE_SIZE));
    });
  }, [updateReservationSearchParams]);

  const handleReservationsErrorAction = useCallback(() => {
    if (pageErrorStatus === 400) {
      resetReservationFilters();
      return;
    }
    if (pageErrorKind === 'unauthorized') {
      const currentParams = new URLSearchParams(window.location.search);
      if (!currentParams.get('page')) currentParams.set('page', String(DEFAULT_PAGE));
      if (!currentParams.get('size')) currentParams.set('size', String(DEFAULT_PAGE_SIZE));
      const returnUrl = encodeURIComponent(`${window.location.pathname}?${currentParams.toString()}`);
      navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
      return;
    }
    handlePageErrorAction(pageErrorKind, navigate);
  }, [navigate, pageErrorKind, pageErrorStatus, resetReservationFilters]);

  const closeReservationDetail = useCallback(() => {
    detailControllerRef.current?.abort();
    setSelectedReservation(null);
    setSelectedVehicleAsset(null);
    setActiveTab('reservation');
    setIsDetailLoading(false);
    setDetailError(null);
    setIsDetailNotFound(false);
    setShowReturnConfirm(false);
    setIsReturnSubmitting(false);
    setReturnSubmitError(null);
    setIsPaymentCompleting(false);
    setReservationActionError(null);
    setActiveReservationAction(null);
    setIsEditMode(false);
    setEditSubmitError(null);
    setIsEditSubmitting(false);
    setActiveReservationActionItems([]);
    setIsActiveActionItemsLoading(false);
    setActiveActionItemsError(null);
  }, []);

  const hydrateReservationDetail = useCallback(async (reservationId: string, fallbackReservation: Reservation) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;

    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;

    setIsDetailLoading(true);
    setDetailError(null);
    setIsDetailNotFound(false);

    try {
      const payload = await getReservationDetail(reservationId, { signal: controller.signal });
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      const detailedReservation = toReservationDetail(payload, fallbackReservation);
      setSelectedReservation(detailedReservation);
      const matchedAsset = vehicleAssets.find((asset) => asset.vehicleNumber === detailedReservation.vehicleNumber);
      setSelectedVehicleAsset(matchedAsset ?? createReservationFallbackVehicleAsset(detailedReservation));
      if (canViewActionRequired) {
        setIsActiveActionItemsLoading(true);
        setActiveActionItemsError(null);
        try {
          const actionPayload = await getActionRequiredList({
            page: 1,
            pageSize: 100,
            status: ACTIVE_ACTION_STATUS_QUERY,
            reservationId,
            signal: controller.signal,
          });
          if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
            setActiveReservationActionItems(toReservationActiveActionItems(actionPayload));
          }
        } catch {
          if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
            setActiveActionItemsError('활성 조치 항목을 불러오지 못했습니다.');
            setActiveReservationActionItems([]);
          }
        } finally {
          if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
            setIsActiveActionItemsLoading(false);
          }
        }
      } else {
        setActiveReservationActionItems([]);
        setActiveActionItemsError(null);
      }
    } catch (error) {
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setIsDetailNotFound(true);
        setDetailError('선택한 예약이 삭제되었거나 존재하지 않습니다. 목록 데이터로 표시합니다.');
      } else if (error instanceof ApiError && error.status === 403) {
        setDetailError('해당 예약 상세를 조회할 권한이 없습니다. 목록 데이터로 표시합니다.');
      } else {
        setDetailError(error instanceof Error ? error.message : '상세 정보를 불러오는 중 오류가 발생했습니다.');
      }

      setSelectedReservation(fallbackReservation);
      const fallbackAsset = vehicleAssets.find((asset) => asset.vehicleNumber === fallbackReservation.vehicleNumber);
      setSelectedVehicleAsset(fallbackAsset ?? createReservationFallbackVehicleAsset(fallbackReservation));
      setActiveReservationActionItems([]);
    } finally {
      if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  }, [canViewActionRequired, vehicleAssets]);

  const handleViewFilterChange = useCallback((nextFilter: ViewFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('status');
      } else {
        params.set('status', nextFilter);
      }
      params.delete('paymentScope');
      if (nextFilter === 'all' || nextFilter === 'unpaid' || nextFilter === 'overdue') {
        params.delete('due');
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleRentalTypeFilterChange = useCallback((nextFilter: RentalTypeFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('rentalType');
      } else {
        params.set('rentalType', nextFilter);
      }
      if (nextFilter !== 'long_term') {
        params.delete('longTermAccountStatus');
      }
      if (nextFilter !== 'accident_replacement') {
        params.delete('accidentReplacementStatus');
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleWorkflowStatusFilterChange = useCallback((nextFilter: WorkflowStatusFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('workflowStatus');
      } else {
        params.set('workflowStatus', nextFilter);
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleCloseoutStatusFilterChange = useCallback((nextFilter: CloseoutStatusFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('closeoutStatus');
      } else {
        params.set('closeoutStatus', nextFilter);
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleCancellationSettlementStatusFilterChange = useCallback((nextFilter: CancellationSettlementStatusFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('cancellationSettlementStatus');
      } else {
        params.set('cancellationSettlementStatus', nextFilter);
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleLongTermAccountStatusFilterChange = useCallback((nextFilter: LongTermAccountStatusFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('longTermAccountStatus');
      } else {
        params.set('longTermAccountStatus', nextFilter);
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleAccidentReplacementStatusFilterChange = useCallback((nextFilter: AccidentReplacementStatusFilter) => {
    updateReservationSearchParams((params) => {
      if (nextFilter === 'all') {
        params.delete('accidentReplacementStatus');
      } else {
        params.set('accidentReplacementStatus', nextFilter);
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleFromDateChange = useCallback((nextFromDate: string) => {
    updateReservationSearchParams((params) => {
      if (nextFromDate) {
        params.set('from', nextFromDate);
      } else {
        params.delete('from');
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handleToDateChange = useCallback((nextToDate: string) => {
    updateReservationSearchParams((params) => {
      if (nextToDate) {
        params.set('to', nextToDate);
      } else {
        params.delete('to');
      }
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  const handlePageChange = useCallback((nextPage: number) => {
    updateReservationSearchParams((params) => {
      params.set('page', String(Math.max(1, nextPage)));
    });
  }, [updateReservationSearchParams]);

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    updateReservationSearchParams((params) => {
      params.set('size', String(nextPageSize));
      params.set('page', String(DEFAULT_PAGE));
    });
  }, [updateReservationSearchParams]);

  // 가로 스크롤 감지하여 더 많은 날짜 로드
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;
    
    // 스크롤이 끝에서 200px 이내로 오면 더 많은 날짜 추가
    if (scrollWidth - scrollLeft - clientWidth < 200) {
      setTotalDaysToShow(prev => Math.min(prev + 28, 365)); // 최대 1년까지
    }
  };

  // 차량 목록
  const vehicles = useMemo(() => vehicleAssets.map(v => v.vehicleNumber), [vehicleAssets]);
  const vehicleAssetByNumber = useMemo(() => {
    const map = new Map<string, VehicleAsset>();
    vehicleAssets.forEach((vehicleAsset) => {
      map.set(vehicleAsset.vehicleNumber, vehicleAsset);
    });
    return map;
  }, [vehicleAssets]);
  
  // 0 = 월요일, 1 = 화요일, ... 6 = 일요일
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  const dates = Array.from({ length: totalDaysToShow }, (_, i) => currentWeekStart + i); // 동적으로 날짜 생성
  const currentViewEnd = currentWeekStart + totalDaysToShow - 1;

  const reservations: Reservation[] = useMemo(() => (
    reservationsData.map((reservation) => {
      const syncedPaymentStatus = syncedPaymentByReservationId[reservation.id];
      if (!syncedPaymentStatus) {
        return reservation;
      }
      return applySyncedPaymentStatusToReservation(reservation, syncedPaymentStatus);
    })
  ), [reservationsData, syncedPaymentByReservationId]);

  // 고유 차종 목록 추출
  const uniqueModels = useMemo(
    () => Array.from(new Set(vehicleAssets.map(v => v.model))).sort(),
    [vehicleAssets],
  );

  // 먼저 예약 필터링 (상태 필터 + 검색어 적용)
  const filteredReservations = useMemo(() => (
    reservations.filter((reservation) => matchesReservationFilters(reservation, {
      viewFilter,
      paymentScope,
      rentalTypeFilter,
      workflowStatusFilter,
      closeoutStatusFilter,
      cancellationSettlementStatusFilter,
      longTermAccountStatusFilter,
      accidentReplacementStatusFilter,
      searchQuery,
    }))
  ), [accidentReplacementStatusFilter, cancellationSettlementStatusFilter, closeoutStatusFilter, longTermAccountStatusFilter, paymentScope, rentalTypeFilter, reservations, searchQuery, viewFilter, workflowStatusFilter]);
  const reservationsByVehicle = useMemo(() => {
    const groupedReservations = new Map<string, Reservation[]>();

    filteredReservations.forEach((reservation) => {
      const vehicleNumber = resolveReservationVehicleNumber(reservation, vehicleAssets);
      const existingReservations = groupedReservations.get(vehicleNumber) ?? [];
      existingReservations.push(reservation);
      groupedReservations.set(vehicleNumber, existingReservations);
    });

    return groupedReservations;
  }, [filteredReservations, vehicleAssets]);
  const reservationIntervalsByVehicle = useMemo(() => {
    const groupedIntervals = new Map<string, Array<{ start: number; end: number }>>();
    reservationsByVehicle.forEach((vehicleReservations, vehicleNumber) => {
      groupedIntervals.set(
        vehicleNumber,
        vehicleReservations.map((reservation) => ({
          start: reservation.startDate,
          end: getReservationOccupiedEndDate(reservation),
        })),
      );
    });
    return groupedIntervals;
  }, [reservationsByVehicle]);

  const totalPages = Math.max(1, Math.ceil((totalReservationCount || 0) / pageSize));
  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;
  const pageErrorActionLabel = pageErrorStatus === 400 ? '조건 초기화' : getPageErrorActionLabel(pageErrorKind);
  const pageErrorDescription = pageErrorStatus === 400
    ? '기간 또는 필터 조건이 올바르지 않습니다. 기간을 확인하거나 필터를 초기화해 주세요.'
    : '예약 캘린더 데이터를 불러오는 중 문제가 발생했습니다.';
  const isCalendarBlockingLoading = isPageLoading && reservationsData.length === 0 && vehicleAssets.length === 0;
  const canStartReservationMutation = canWriteReservations && !isPageLoading;

  // 차량 필터링 로직 (차종 + 상태 필터 AND 조건)
  const filteredVehicles = useMemo(() => (
    vehicles.filter(vehicleNumber => {
      const asset = vehicleAssetByNumber.get(vehicleNumber);

      // 차종 필터
      const matchesModel = modelFilter === 'all' || (asset && asset.model === modelFilter);

      // 차량번호 검색
      const matchesSearch = vehicleSearchQuery === '' || vehicleNumber.includes(vehicleSearchQuery);

      // 상태 필터에 따른 차량 필터링 (해당 차량의 예약이 필터 조건에 맞는 경우만)
      if (viewFilter !== 'all') {
        const hasMatchingReservation = (reservationsByVehicle.get(vehicleNumber)?.length ?? 0) > 0;
        if (!hasMatchingReservation) {
          return false;
        }
      }

      return matchesModel && matchesSearch;
    })
  ), [modelFilter, reservationsByVehicle, vehicleAssetByNumber, vehicleSearchQuery, vehicles, viewFilter]);

  const getBlockColor = (reservation: Reservation) => {
    const endDate = toDateFromOffset(reservation.endDate);

    // 연체 후 반납 완료 → 초록색 (미납 체크보다 우선)
    if (reservation.type === 'return') {
      const scheduledEndAt = parseReservationDateTime(reservation.scheduledEndAt);
      const returnedAtDate = parseReservationDateTime(reservation.returnedAt);
      if (hasReturnedLate(reservation, scheduledEndAt, returnedAtDate)) {
        return 'bg-green-500';
      }
    }

    // 미납 건
    const syncedPaymentStatus = syncedPaymentByReservationId[reservation.id];
    if (
      (syncedPaymentStatus && isUnpaidPaymentStatus(syncedPaymentStatus.status))
      || hasPaymentIssueLabel(reservation.issues)
    ) {
      return 'bg-red-500';
    }

    // 반납 (수동 반납 처리 또는 과거 반납 완료) - 회색 통일
    if (reservation.type === 'return' || endDate < CALENDAR_BASE_DATE) {
      return 'bg-gray-400';
    }
    
    // 예약 확정 (미래)
    if (reservation.type === 'reservation') {
      return 'bg-blue-500';
    }
    
    // 대여중
    if (reservation.type === 'rental') {
      return 'bg-green-500';
    }
    
    return 'bg-gray-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '가용':
        return 'bg-green-100 text-green-700';
      case '대여중':
        return 'bg-blue-100 text-blue-700';
      case '정비중':
        return 'bg-red-100 text-red-700';
      case '반납됨':
      case '회수완료':
        return 'bg-gray-100 text-gray-700';
      case '회수필요':
        return 'bg-red-100 text-red-700';
      case '예약':
      case '예약됨':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatVehicleOperatingStatus = (asset: VehicleAsset) => {
    if (asset.vehicleOperatingStatusLabel) {
      return asset.vehicleOperatingStatusLabel;
    }
    switch (asset.vehicleOperatingStatus) {
      case 'available':
        return '대여가능';
      case 'reserved':
        return '예약배정';
      case 'rented':
        return '대여중';
      case 'returned':
        return '반납됨';
      case 'maintenance':
        return '정비중';
      case 'recovery_required':
        return '회수필요';
      case 'recovered':
        return '회수완료';
      default:
        return asset.status;
    }
  };

  const getPaymentStatusColor = (status: Reservation['paymentStatus']) => {
    if (status === '완료') {
      return 'bg-green-100 text-green-700';
    }
    if (status === '미납') {
      return 'bg-red-100 text-red-700';
    }
    if (status === '부분납부') {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const selectedReservationPaymentSync = selectedReservation
    ? syncedPaymentByReservationId[selectedReservation.id] ?? null
    : null;
  const selectedReservationPaymentStatus = selectedReservation
    ? resolveReservationPaymentStatus(selectedReservation, selectedReservationPaymentSync)
    : '대기';
  const selectedReservationPrincipalAmount = selectedReservation
    ? resolveReservationPrincipalPaymentAmount(selectedReservation, selectedReservationPaymentSync)
    : 0;
  const selectedReservationAdditionalAmount = selectedReservation
    ? resolveReservationAdditionalPaymentAmount(selectedReservation, selectedReservationPaymentSync)
    : 0;
  const selectedReservationTotalAmount = selectedReservation
    ? resolveReservationTotalPaymentAmount(selectedReservation, selectedReservationPaymentSync)
    : 0;
  const selectedReservationCalculatedTotalAmount = selectedReservationPrincipalAmount + selectedReservationAdditionalAmount;
  const selectedReservationTotalAmountDelta = selectedReservationTotalAmount - selectedReservationCalculatedTotalAmount;
  const selectedReservationOverdueDays = selectedReservation
    ? resolveReservationPaymentOverdueDays(selectedReservation, selectedReservationPaymentSync)
    : 0;
  const selectedReservationPaymentUpdatedAt = selectedReservation
    ? resolveReservationPaymentUpdatedAt(selectedReservation, selectedReservationPaymentSync)
    : null;
  const selectedReservationBillingSummary = selectedReservation?.billingSummary ?? null;
  const selectedReservationBillingPlan = selectedReservationBillingSummary?.billingPlan ?? null;
  const isSelectedReservationLongTerm = selectedReservation?.rentalType === 'long_term';
  const selectedReservationChargeItems = selectedReservation
    ? selectedReservation.chargeItemsPreview ?? selectedReservationBillingSummary?.chargeItems ?? []
    : [];
  const selectedReservationPaymentRecords = selectedReservationBillingSummary?.paymentRecords ?? [];
  const selectedReservationBillingLabel = selectedReservationBillingSummary?.paymentSummaryLabel
    ?? selectedReservationPaymentStatus;
  const selectedReservationBillingTotalAmount = selectedReservationBillingSummary?.totalAmount
    ?? selectedReservationTotalAmount;
  const selectedReservationBillingPaidAmount = selectedReservationBillingSummary?.paidAmount
    ?? (selectedReservationPaymentStatus === '완료' ? selectedReservationTotalAmount : 0);
  const selectedReservationBillingRemainingAmount = selectedReservationBillingSummary?.remainingAmount
    ?? (selectedReservationPaymentStatus === '완료' ? 0 : selectedReservationTotalAmount);
  const selectedReservationBillingConfirmationCount = selectedReservationBillingSummary?.confirmationNeededCount ?? 0;
  const selectedReservationChargeItemCount = selectedReservationBillingSummary?.chargeItemCount ?? selectedReservationChargeItems.length;
  const selectedReservationPaymentRecordCount = selectedReservationBillingSummary?.paymentRecordCount ?? selectedReservationPaymentRecords.length;
  const selectedReservationDefaultPayerType = selectedReservationBillingPlan?.payerType
    ?? selectedReservation?.parties?.payer?.type
    ?? undefined;
  const selectedReservationMonthlyAmountText = selectedReservationBillingPlan?.monthlyAmount !== undefined
    ? toCurrencyValue(selectedReservationBillingPlan.monthlyAmount)
    : selectedReservation?.amount ?? '-';
  const selectedReservationDepositText = selectedReservationBillingPlan?.deposit !== undefined
    ? toCurrencyValue(selectedReservationBillingPlan.deposit)
    : selectedReservation?.deposit ?? '-';
  const selectedReservationAdvancePaymentText = selectedReservationBillingPlan?.advancePayment !== undefined
    ? toCurrencyValue(selectedReservationBillingPlan.advancePayment)
    : '-';
  const hasSelectedReservationBillingLedger = (
    selectedReservationChargeItemCount > 0
    || selectedReservationPaymentRecordCount > 0
  );
  const canEditReservationPaymentFields = selectedReservation
    ? canWritePayments
      && !hasSelectedReservationBillingLedger
      && canManageReservationPaymentIssue(selectedReservation, selectedReservationPaymentSync)
    : false;
  useEffect(() => {
    if (!selectedReservation) {
      setPaymentAmountDraft('');
      setPaymentMethodDraft('카드');
      return;
    }
    const additionalAmount = resolveReservationAdditionalPaymentAmount(
      selectedReservation,
      selectedReservationPaymentSync,
    );
    setPaymentAmountDraft(String(Math.max(0, Math.trunc(additionalAmount))));
    setPaymentMethodDraft(
      resolveReservationPaymentMethod(selectedReservation, selectedReservationPaymentSync),
    );
  }, [selectedReservation, selectedReservationPaymentSync]);
  const isPaymentSyncStatusVisible = isPaymentSyncing || Boolean(paymentSyncError);
  const paymentSyncStatusMessage = isPaymentSyncing
    ? '결제 상태를 동기화하는 중입니다.'
    : (
      isPaymentSyncUsingLastKnown
        ? '결제 상태 동기화에 실패해 마지막 정상 상태를 표시 중입니다.'
        : paymentSyncError ?? ''
    );

  const openReservationDetail = useCallback((reservation: Reservation) => {
    setSelectedReservation(reservation);
    const asset = vehicleAssets.find((entry) => entry.vehicleNumber === reservation.vehicleNumber);
    setSelectedVehicleAsset(asset ?? createReservationFallbackVehicleAsset(reservation));
    setActiveTab('reservation');
    setShowReturnConfirm(false);
    setIsReturnSubmitting(false);
    setReturnSubmitError(null);
    setIsPaymentCompleting(false);
    setReservationActionError(null);
    setActiveReservationAction(null);
    void hydrateReservationDetail(reservation.id, reservation);
  }, [hydrateReservationDetail, vehicleAssets]);

  const refreshReservationsAfterMutation = useCallback((warningMessage: string) => {
    void hydrateReservationsData().catch(() => {
      toast.error(warningMessage);
    });
  }, [hydrateReservationsData]);

  const confirmReservationWarning = useCallback((prompt: ReservationWarningPrompt) => new Promise<boolean>((resolve) => {
    reservationWarningResolverRef.current = resolve;
    setReservationWarningPrompt(prompt);
  }), []);

  const handleReservationClick = useCallback((reservation: Reservation) => {
    openReservationDetail(reservation);
  }, [openReservationDetail]);

  const validateNewContractStepOne = useCallback(async (
    formValues: Pick<NewContractFormValues, 'selectedVehicle' | 'startDate' | 'endDate' | 'startTime' | 'endTime'>,
  ): Promise<NewContractSubmitFeedback | null> => {
    const startAt = toIsoDateTimeFromDateAndTime(formValues.startDate, formValues.startTime);
    const endAt = toIsoDateTimeFromDateAndTime(formValues.endDate, formValues.endTime);
    if (!startAt || !endAt || !formValues.selectedVehicle.trim()) {
      return null;
    }
    const selectedStart = new Date(startAt).getTime();
    const selectedEnd = new Date(endAt).getTime();
    if (!Number.isFinite(selectedStart) || !Number.isFinite(selectedEnd) || selectedEnd <= selectedStart) {
      return null;
    }

    const payload = await getReservationsList({
      page: 1,
      size: RESERVATION_FETCH_PAGE_SIZE,
      from: formValues.startDate,
      to: formValues.endDate,
    });
    const rows = toReservationRows(payload);
    const conflicts = rows.filter((reservation) => {
      if (reservation.vehicleNumber !== formValues.selectedVehicle) {
        return false;
      }
      if (reservation.contractStatus === '완료' || reservation.type === 'return') {
        return false;
      }
      const reservationStart = parseReservationDateTime(reservation.scheduledStartAt ?? reservation.startDateFull);
      const reservationEnd = parseReservationDateTime(reservation.scheduledEndAt ?? reservation.endDateFull);
      if (!reservationStart || !reservationEnd) {
        return false;
      }
      return reservationStart.getTime() < selectedEnd && selectedStart < reservationEnd.getTime();
    });

    if (conflicts.length === 0) {
      return null;
    }

    const conflict = conflicts[0];
    return {
      formError: `선택한 차량은 ${conflict.startDateFull ?? '-'} ~ ${conflict.endDateFull ?? '-'} 기간에 이미 예약이 있습니다.`,
      fieldErrors: {
        selectedVehicle: '다른 차량이나 기간을 선택해 주세요.',
      },
    };
  }, []);

  const handleCreateReservation = useCallback(async (
    formValues: NewContractFormValues,
  ): Promise<NewContractSubmitFeedback | null> => {
    if (!canWriteReservations) {
      return {
        formError: '예약 생성 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
      };
    }

    const selectedAsset = vehicleAssets.find((asset) => asset.vehicleNumber === formValues.selectedVehicle);
    const vin = selectedAsset?.vin?.trim();
    if (!selectedAsset || !vin || vin === '-') {
      return {
        formError: '선택한 차량의 VIN 정보가 없어 계약을 등록할 수 없습니다.',
        fieldErrors: {
          selectedVehicle: 'VIN 정보가 있는 차량을 선택해 주세요.',
        },
      };
    }

    const startAt = toIsoDateTimeFromDateAndTime(formValues.startDate, formValues.startTime);
    const endAt = toIsoDateTimeFromDateAndTime(formValues.endDate, formValues.endTime);
    if (!startAt || !endAt) {
      return {
        formError: '대여 시작/종료 일시가 올바르지 않습니다.',
        fieldErrors: {
          startDate: '유효한 날짜/시간을 입력해 주세요.',
          endDate: '유효한 날짜/시간을 입력해 주세요.',
        },
      };
    }

    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return {
        formError: '반납 일시는 픽업 일시보다 이후여야 합니다.',
        fieldErrors: {
          endDate: '반납 일시를 다시 확인해 주세요.',
        },
      };
    }

    let hasInspectionIssueCard = (selectedAsset.issues ?? []).some((issue) => issue.includes('정기점검'));
    try {
      hasInspectionIssueCard = await hasInspectionIssueCardForVehicle(selectedAsset.vehicleNumber);
    } catch {
      // Fall back to asset.issues when action-items lookup is unavailable.
    }

    const assetWarning = evaluateReservationAssetWarning(selectedAsset, formValues, hasInspectionIssueCard);
    if (assetWarning.blockedMessage) {
      return {
        formError: assetWarning.blockedMessage,
        fieldErrors: {
          selectedVehicle: assetWarning.blockedMessage,
        },
      };
    }
    if (assetWarning.prompt) {
      const shouldProceed = await confirmReservationWarning(assetWarning.prompt);
      if (!shouldProceed) {
        return {
          formError: '예약 생성을 취소했습니다.',
        };
      }
    }

    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `reservation-create-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    let preparedReservationId: string | null = null;
    try {
      const prepared = await prepareReservationCreation({ idempotencyKey });
      if (isRecord(prepared.existingReservation)) {
        const existingId = toStringValue(prepared.existingReservation.id)
          ?? toStringValue(prepared.existingReservation.reservationId)
          ?? toStringValue(prepared.existingReservation.rentalId);
        if (existingId) {
          const existingReservation = toReservationDetail(prepared.existingReservation, {
            id: existingId,
            vehicleNumber: formValues.selectedVehicle,
            customer: formValues.customerName.trim() || '고객 미확인',
            startDate: 0,
            endDate: 0,
            type: 'reservation',
            issues: [],
            phone: formValues.customerPhone.trim(),
            paymentMethod: '계좌이체',
            amount: '0',
            deposit: '0',
            paymentStatus: '대기',
          });
          setShowModal(false);
          openReservationDetail(existingReservation);
          await hydrateReservationsData();
          return null;
        }
      }
      preparedReservationId = toStringValue(prepared.reservationId);
    } catch {
      return {
        formError: '예약번호 발급에 실패했습니다.',
      };
    }
    const reservationId = preparedReservationId;
    if (!reservationId) {
      return {
        formError: '예약번호 발급에 실패했습니다.',
      };
    }
    const startDateOffset = toDateOffset(startAt) ?? 0;
    const endDateOffset = toDateOffset(endAt) ?? startDateOffset;
    const fallbackAmount = formValues.rentalType === 'long_term'
      ? toCurrencyNumberFromInput(formValues.monthlyAmount)
      : toCurrencyNumberFromInput(formValues.amount);
    const fallbackDeposit = toCurrencyNumberFromInput(formValues.deposit);
    const fallbackAdvancePayment = toCurrencyNumberFromInput(formValues.advancePayment);
    const fallbackBilledAmount = toCurrencyNumberFromInput(formValues.billedAmount);
    const usesInitialBilling = formValues.rentalType === 'short_term';
    const longTermPayerType = formValues.contractorType === 'corporate' ? 'corporate' : 'customer';
    const longTermContractorName = formValues.contractorName.trim();
    const longTermContractorPhone = formValues.contractorContactPhone.trim();
    const longTermPayerName = formValues.payerName.trim()
      || formValues.contractorContactName.trim()
      || longTermContractorName;
    const longTermPayerPhone = formValues.payerPhone.trim() || longTermContractorPhone;
    const fallbackDisplayAmount = formValues.rentalType === 'long_term'
      ? toCurrencyDisplayFromInput(formValues.monthlyAmount)
      : toCurrencyDisplayFromInput(formValues.amount);
    const fallbackPaymentStatus = usesInitialBilling ? formValues.paymentStatus : '대기';
    const initialBillingStatus = (() => {
      if (!usesInitialBilling) {
        return undefined;
      }
      const canonical = toCanonicalPaymentStatus(formValues.paymentStatus);
      if (canonical === 'paid') {
        return 'paid';
      }
      if (canonical === 'partial') {
        return 'partial';
      }
      if (canonical === 'unpaid') {
        return 'overdue';
      }
      return 'pending';
    })();
    const initialBillingPaymentAmount = (() => {
      if (!usesInitialBilling || fallbackAmount <= 0) {
        return 0;
      }
      if (initialBillingStatus === 'paid') {
        return fallbackAmount;
      }
      if (initialBillingStatus === 'partial') {
        return Math.min(fallbackDeposit, fallbackAmount);
      }
      return 0;
    })();
    const fallbackReservation: Reservation = {
      id: reservationId,
      rentalType: formValues.rentalType,
      creationMode: 'ui_confirmed',
      vehicleNumber: formValues.selectedVehicle,
      customer: formValues.rentalType === 'long_term'
        ? formValues.contractorName.trim() || formValues.customerName.trim() || '고객 미확인'
        : formValues.customerName.trim() || '고객 미확인',
      startDate: Math.min(startDateOffset, endDateOffset),
      endDate: Math.max(startDateOffset, endDateOffset),
      scheduledStartAt: startAt,
      contractStatus: '예약중',
      type: 'reservation',
      issues: [],
      phone: formValues.rentalType === 'long_term'
        ? formValues.contractorContactPhone.trim() || formValues.customerPhone.trim()
        : formValues.customerPhone.trim(),
      paymentMethod: usesInitialBilling ? formValues.paymentMethod : '계좌이체',
      amount: fallbackDisplayAmount,
      deposit: toCurrencyDisplayFromInput(formValues.deposit),
      paymentStatus: fallbackPaymentStatus,
      hasPaymentInfo: usesInitialBilling,
      additionalPaymentAmount: usesInitialBilling ? Math.max(fallbackAmount - fallbackDeposit, 0) : 0,
      startDateFull: formValues.startDate,
      endDateFull: formValues.endDate,
    };

    try {
      let licenseDocumentObjectName: string | undefined;
      const additionalDriverLicenseDocumentObjectNames: Array<string | undefined> = [];
      let contractDocumentObjectName: string | undefined;
      const contractDocuments: Array<{ objectName: string; fileName: string; documentType: 'long_term_contract' | 'rental_contract' | 'accident_replacement_request' }> = [];

      if (formValues.licenseFile) {
        try {
          licenseDocumentObjectName = await uploadReservationCreationDocument(formValues.licenseFile, reservationId);
        } catch {
          const isLongTermIndividual = formValues.rentalType === 'long_term' && formValues.contractorType === 'individual';
          return {
            formError: isLongTermIndividual
              ? '1번째 운전자 면허증 파일 업로드에 실패했습니다.'
              : '운전면허증 파일 업로드에 실패했습니다.',
            fieldErrors: {
              licenseFile: isLongTermIndividual
                ? '1번째 운전자 면허증 파일을 다시 업로드해 주세요.'
                : '파일 업로드 후 다시 시도해 주세요.',
            },
          };
        }
      }

      if (formValues.rentalType === 'long_term' && formValues.contractorType === 'individual') {
        for (let index = 0; index < formValues.additionalDrivers.length; index += 1) {
          const file = formValues.additionalDriverLicenseFiles[index];
          if (!file) {
            additionalDriverLicenseDocumentObjectNames[index] = undefined;
            continue;
          }
          try {
            additionalDriverLicenseDocumentObjectNames[index] = await uploadReservationCreationDocument(file, reservationId);
          } catch {
            const message = `${index + 2}번째 운전자 면허증 파일을 다시 업로드해 주세요.`;
            return {
              formError: `${index + 2}번째 운전자 면허증 파일 업로드에 실패했습니다.`,
              fieldErrors: {
                additionalDriverLicenseFiles: message,
              },
              additionalDriverLicenseFileErrors: {
                [index]: message,
              },
            };
          }
        }
      }

      const contractFiles = formValues.contractFiles.length > 0
        ? formValues.contractFiles
        : (formValues.contractFile ? [formValues.contractFile] : []);
      if (contractFiles.length > 0) {
        for (const [index, file] of contractFiles.entries()) {
          try {
            const objectName = await uploadReservationCreationDocument(file, reservationId);
            contractDocumentObjectName = contractDocumentObjectName ?? objectName;
            contractDocuments.push({
              objectName,
              fileName: file.name,
              documentType: formValues.rentalType === 'long_term'
                ? 'long_term_contract'
                : formValues.rentalType === 'accident_replacement'
                  ? 'accident_replacement_request'
                  : 'rental_contract',
            });
          } catch {
            return {
              formError: contractFiles.length > 1
                ? `${index + 1}번째 계약서/납부 일정표 파일 업로드에 실패했습니다.`
                : '계약서 파일 업로드에 실패했습니다.',
              fieldErrors: {
                contractFile: '파일 업로드 후 다시 시도해 주세요.',
              },
            };
          }
        }
      }

      const driverParty = formValues.rentalType === 'long_term' && formValues.contractorType === 'corporate'
        ? {}
        : {
          name: formValues.rentalType === 'long_term'
            ? formValues.contractorName.trim() || undefined
            : formValues.customerName.trim() || undefined,
          phone: formValues.rentalType === 'long_term'
            ? formValues.contractorContactPhone.trim() || undefined
            : formValues.customerPhone.trim() || undefined,
          licenseNumber: formValues.customerLicense.trim() || undefined,
          address: formValues.customerAddress.trim() || undefined,
          licenseDocumentObjectName,
        };
      const additionalDriverParties = formValues.rentalType === 'long_term' && formValues.contractorType === 'individual'
        ? formValues.additionalDrivers
          .map((driver, index) => ({
            name: driver.name.trim() || undefined,
            phone: driver.phone.trim() || undefined,
            licenseNumber: driver.licenseNumber.trim() || undefined,
            address: driver.address.trim() || undefined,
            licenseDocumentObjectName: additionalDriverLicenseDocumentObjectNames[index],
          }))
          .filter((driver) => Object.values(driver).some(Boolean))
        : [];
      const longTermContractorParty = formValues.rentalType === 'long_term'
        ? {
          type: formValues.contractorType,
          name: longTermContractorName || undefined,
          businessNumber: formValues.contractorType === 'corporate'
            ? formValues.contractorBusinessNumber.trim() || undefined
            : undefined,
          contactName: formValues.contractorContactName.trim() || undefined,
          phone: longTermContractorPhone || undefined,
          address: formValues.customerAddress.trim() || undefined,
        }
        : undefined;
      const parties = {
        contractor: formValues.rentalType === 'accident_replacement'
          ? undefined
          : formValues.rentalType === 'long_term'
            ? longTermContractorParty
            : {
            name: formValues.customerName.trim() || undefined,
            phone: formValues.customerPhone.trim() || undefined,
            address: formValues.customerAddress.trim() || undefined,
          },
        driver: Object.values(driverParty).some(Boolean) ? driverParty : undefined,
        additionalDrivers: additionalDriverParties.length > 0 ? additionalDriverParties : undefined,
        requester: formValues.rentalType === 'accident_replacement'
          ? {
            source: formValues.requestSource,
            organizationName: formValues.requesterOrganizationName.trim() || undefined,
            name: formValues.requesterName.trim() || undefined,
            phone: formValues.requesterPhone.trim() || undefined,
            externalRequestNo: formValues.claimNo.trim() || undefined,
          }
          : undefined,
        payer: formValues.rentalType === 'accident_replacement'
          ? {
            type: 'insurer',
            insurerName: formValues.insurerName.trim() || undefined,
            claimNo: formValues.claimNo.trim() || undefined,
          }
          : formValues.rentalType === 'long_term'
            ? {
              type: longTermPayerType,
              name: longTermPayerName || undefined,
              phone: longTermPayerPhone || undefined,
              billingAccount: formValues.billingAccount.trim() || undefined,
            }
            : {
              type: 'customer',
              name: formValues.customerName.trim() || undefined,
              phone: formValues.customerPhone.trim() || undefined,
            },
      };

      const payload = await createReservation({
        reservationId,
        idempotencyKey,
        vin,
        rentalType: formValues.rentalType,
        creationMode: 'ui_confirmed',
        startAt,
        endAt,
        contractStatus: '예약중',
        vehicleNumber: formValues.selectedVehicle,
        plate: formValues.selectedVehicle,
        parties,
        payerType: formValues.rentalType === 'long_term' ? longTermPayerType : undefined,
        contractDocumentObjectName,
        contractDocumentType: contractDocumentObjectName
          ? (formValues.rentalType === 'long_term'
            ? 'long_term_contract'
            : formValues.rentalType === 'accident_replacement'
              ? 'accident_replacement_request'
              : 'rental_contract')
          : undefined,
        contractDocuments: contractDocuments.length > 0 ? contractDocuments : undefined,
        initialBilling: usesInitialBilling
          ? {
            amount: fallbackAmount,
            deposit: fallbackDeposit,
            chargeType: 'rental_fee',
            payerType: 'customer',
            status: initialBillingStatus,
            dueDate: startAt.slice(0, 10),
            memo: '단기렌트 대여료',
            paymentRecord: initialBillingPaymentAmount > 0
              ? {
                amount: initialBillingPaymentAmount,
                method: formValues.paymentMethod,
                payerType: 'customer',
                confirmationStatus: 'confirmed',
                depositorName: formValues.paymentDepositorName.trim() || undefined,
                approvalNo: formValues.paymentApprovalNo.trim() || undefined,
              }
              : undefined,
          }
          : undefined,
        billingPlan: formValues.rentalType === 'long_term'
          ? {
            monthlyAmount: fallbackAmount,
            billingDay: Number(formValues.billingDay || 1),
            billingTiming: formValues.billingTiming,
            cycleMonths: 1,
            graceDays: Number(formValues.graceDays || 0),
            deposit: fallbackDeposit,
            advancePayment: fallbackAdvancePayment,
            payerType: longTermPayerType,
          }
          : undefined,
        accidentClaim: formValues.rentalType === 'accident_replacement'
          ? {
            requestSource: formValues.requestSource,
            requesterOrganizationName: formValues.requesterOrganizationName.trim() || undefined,
            requesterName: formValues.requesterName.trim() || undefined,
            requesterPhone: formValues.requesterPhone.trim() || undefined,
            insurerName: formValues.insurerName.trim() || undefined,
            claimNo: formValues.claimNo.trim() || undefined,
            adjusterName: formValues.adjusterName.trim() || undefined,
            adjusterPhone: formValues.adjusterPhone.trim() || undefined,
            repairShopName: formValues.repairShopName.trim() || undefined,
            repairShopLocation: formValues.repairShopLocation.trim() || undefined,
            damagedVehicleNumber: formValues.damagedVehicleNumber.trim() || undefined,
            damagedVehicleModel: formValues.damagedVehicleModel.trim() || undefined,
            deliveryLocation: formValues.deliveryLocation.trim() || formValues.pickupLocation.trim() || undefined,
            billedAmount: fallbackBilledAmount > 0 ? fallbackBilledAmount : undefined,
            documentStatus: 'intake_required',
            claimStatus: 'intake',
          }
          : undefined,
        pickupLocation: formValues.pickupLocation.trim() || undefined,
        returnLocation: formValues.returnLocation.trim() || undefined,
        memo: [
          `pickup=${formValues.pickupLocation.trim()}`,
          `return=${formValues.returnLocation.trim()}`,
          `rentalType=${formValues.rentalType}`,
        ].join(', '),
      });

      const createdReservation = toReservationDetail(payload, fallbackReservation);
      const responseId = isRecord(payload)
        ? toStringValue(payload.id) ?? toStringValue(payload.reservationId) ?? toStringValue(payload.rentalId)
        : null;
      const nextReservation: Reservation = responseId
        ? { ...createdReservation, id: responseId }
        : createdReservation;

      setShowModal(false);
      setDragSelection(null);
      openReservationDetail(nextReservation);
      await hydrateReservationsData();
      toast.success(`예약이 등록되었습니다. 예약번호: ${nextReservation.id}`);
      return null;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          return {
            formError: error.message || '입력값을 확인해 주세요.',
            fieldErrors: toCreateFieldErrors(error),
          };
        }
        if (error.status === 403) {
          return {
            formError: '예약 생성 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
          };
        }
        if (error.status === 409) {
          return {
            formError: error.message || '동일한 예약이 이미 존재합니다. 입력값을 확인해 주세요.',
          };
        }
        if (isRetryableMutationError(error)) {
          toast.error(RETRY_TOAST_MESSAGE);
          return {
            formError: RETRY_TOAST_MESSAGE,
          };
        }

        return {
          formError: error.message || '예약 생성에 실패했습니다.',
        };
      }

      toast.error(RETRY_TOAST_MESSAGE);
      return {
        formError: '예약 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }, [canWriteReservations, confirmReservationWarning, hasInspectionIssueCardForVehicle, hydrateReservationsData, openReservationDetail, vehicleAssets]);

  const handleUpdateReservationPaymentStatus = useCallback(async (
    nextStatus: 'paid' | 'canceled',
  ) => {
    if (!canWritePayments) {
      setReservationActionError('결제 상태 변경 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (!selectedReservation || isPaymentCompleting) {
      return;
    }

    if (!canManageReservationPaymentIssue(selectedReservation, selectedReservationPaymentSync)) {
      return;
    }
    if (hasSelectedReservationBillingLedger) {
      setReservationActionError(LEDGER_AUTHORITATIVE_PAYMENT_MESSAGE);
      return;
    }

    setIsPaymentCompleting(true);
    setReservationActionError(null);

    const paymentId = getReservationPaymentMutationId(selectedReservation, selectedReservationPaymentSync);

    try {
      await patchPaymentStatus(paymentId, {
        status: nextStatus,
        reservationId: selectedReservation.id,
      });
      invalidatePaymentStatusCache({
        reservationId: selectedReservation.id,
        paymentId,
      });

      const updatedReservation = applyCompletedPaymentToReservation(selectedReservation);
      setReservationsData((previousReservations) => previousReservations.map((reservation) => (
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      )));
      setSelectedReservation(updatedReservation);

      refreshReservationsAfterMutation('결제 상태는 변경되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
      void hydrateReservationDetail(updatedReservation.id, updatedReservation);
      toast.success(nextStatus === 'paid' ? '결제 상태를 완료로 처리했습니다.' : '결제를 면제 처리했습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setReservationActionError(error.message || '결제 상태 변경 요청값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setReservationActionError('결제 상태 변경 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 404) {
          setReservationActionError('결제 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.');
          void hydrateReservationsData();
          void hydrateReservationDetail(selectedReservation.id, selectedReservation);
          return;
        }
        if (error.status === 409) {
          setReservationActionError(error.message || '결제 상태가 이미 변경되었습니다. 최신 상태를 다시 확인해 주세요.');
          void hydrateReservationsData();
          void hydrateReservationDetail(selectedReservation.id, selectedReservation);
          return;
        }
        if (isRetryableMutationError(error)) {
          setReservationActionError(RETRY_TOAST_MESSAGE);
          toast.error(RETRY_TOAST_MESSAGE);
          return;
        }

        setReservationActionError(error.message || '결제 상태 변경 중 오류가 발생했습니다.');
        return;
      }

      setReservationActionError('결제 상태 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error(RETRY_TOAST_MESSAGE);
    } finally {
      setIsPaymentCompleting(false);
    }
  }, [
    canWritePayments,
    hasSelectedReservationBillingLedger,
    hydrateReservationDetail,
    hydrateReservationsData,
    isPaymentCompleting,
    refreshReservationsAfterMutation,
    selectedReservation,
    selectedReservationPaymentSync,
  ]);

  const handleSaveAdditionalPaymentAmount = useCallback(async () => {
    if (!canWritePayments) {
      setReservationActionError('추가 결제 금액 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }
    if (!selectedReservation || isPaymentAmountSaving) {
      return;
    }
    if (!canManageReservationPaymentIssue(selectedReservation, selectedReservationPaymentSync)) {
      return;
    }
    if (hasSelectedReservationBillingLedger) {
      setReservationActionError(LEDGER_AUTHORITATIVE_PAYMENT_MESSAGE);
      return;
    }
    const amount = Math.max(0, toCurrencyNumberFromInput(paymentAmountDraft));
    const paymentId = getReservationPaymentMutationId(selectedReservation, selectedReservationPaymentSync);

    setIsPaymentAmountSaving(true);
    setReservationActionError(null);
    try {
      await patchPaymentStatus(paymentId, {
        status: 'overdue',
        reservationId: selectedReservation.id,
        additionalAmount: amount,
        force: true,
        forceReason: 'manual-additional-payment',
      });
      invalidatePaymentStatusCache({
        reservationId: selectedReservation.id,
        paymentId,
      });
      const updatedReservation = applyUnpaidPaymentToReservation(selectedReservation, { amount });
      setReservationsData((previousReservations) => previousReservations.map((reservation) => (
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      )));
      setSelectedReservation(updatedReservation);
      refreshReservationsAfterMutation('추가 결제 금액은 저장되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
      void hydrateReservationDetail(updatedReservation.id, updatedReservation);
      toast.success('추가 결제 금액을 저장했습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        setReservationActionError(error.message || '추가 결제 금액 저장 중 오류가 발생했습니다.');
      } else {
        setReservationActionError('추가 결제 금액 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsPaymentAmountSaving(false);
    }
  }, [
    canWritePayments,
    hasSelectedReservationBillingLedger,
    hydrateReservationDetail,
    isPaymentAmountSaving,
    paymentAmountDraft,
    refreshReservationsAfterMutation,
    selectedReservation,
    selectedReservationPaymentSync,
  ]);

  const handleSaveReservationPaymentMethod = useCallback(async () => {
    if (!canWritePayments) {
      setReservationActionError('결제 방법 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }
    if (!selectedReservation || isPaymentMethodSaving) {
      return;
    }
    if (!canManageReservationPaymentIssue(selectedReservation, selectedReservationPaymentSync)) {
      return;
    }
    if (hasSelectedReservationBillingLedger) {
      setReservationActionError(LEDGER_AUTHORITATIVE_PAYMENT_MESSAGE);
      return;
    }

    const paymentId = getReservationPaymentMutationId(selectedReservation, selectedReservationPaymentSync);
    const baseStatus = selectedReservationPaymentSync?.status === 'not-found'
      ? toCanonicalPaymentStatus(selectedReservation.paymentStatus)
      : selectedReservationPaymentSync?.status ?? toCanonicalPaymentStatus(selectedReservation.paymentStatus);
    const status = toApiPaymentStatus(baseStatus);

    setIsPaymentMethodSaving(true);
    setReservationActionError(null);
    try {
      await patchPaymentStatus(paymentId, {
        status,
        reservationId: selectedReservation.id,
        method: paymentMethodDraft,
      });
      invalidatePaymentStatusCache({
        reservationId: selectedReservation.id,
        paymentId,
      });
      const updatedReservation: Reservation = {
        ...selectedReservation,
        paymentMethod: paymentMethodDraft,
      };
      setReservationsData((previousReservations) => previousReservations.map((reservation) => (
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      )));
      setSelectedReservation(updatedReservation);
      refreshReservationsAfterMutation('결제 방법은 저장되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
      void hydrateReservationDetail(updatedReservation.id, updatedReservation);
      toast.success('결제 방법을 저장했습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        setReservationActionError(error.message || '결제 방법 저장 중 오류가 발생했습니다.');
      } else {
        setReservationActionError('결제 방법 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsPaymentMethodSaving(false);
    }
  }, [
    canWritePayments,
    hasSelectedReservationBillingLedger,
    hydrateReservationDetail,
    isPaymentMethodSaving,
    paymentMethodDraft,
    refreshReservationsAfterMutation,
    selectedReservation,
    selectedReservationPaymentSync,
  ]);

  const handleOpenPaymentEvidence = useCallback(async (objectName: string) => {
    try {
      const payload = await getUploadDownloadUrl(objectName);
      window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '수납 증빙 링크를 열지 못했습니다.');
    }
  }, []);

  const handleOpenReservationDocument = useCallback(async (objectName: string) => {
    try {
      const payload = await getUploadDownloadUrl(objectName);
      window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '문서 링크를 열지 못했습니다.');
    }
  }, []);

  const handleVoidPaymentRecord = useCallback(async (record: ReservationPaymentRecord) => {
    if (!selectedReservation || !canWritePayments || activePaymentRecordMutationId) {
      return;
    }
    setActivePaymentRecordMutationId(record.id);
    setReservationActionError(null);
    try {
      await voidPaymentRecord(record.id, '예약 상세에서 수납 기록 무효 처리');
      toast.success('수납 기록을 무효 처리했습니다.');
      void hydrateReservationDetail(selectedReservation.id, selectedReservation);
      refreshReservationsAfterMutation('수납 기록은 변경되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
    } catch (error) {
      setReservationActionError(error instanceof Error ? error.message : '수납 기록 무효 처리 중 오류가 발생했습니다.');
    } finally {
      setActivePaymentRecordMutationId(null);
    }
  }, [activePaymentRecordMutationId, canWritePayments, hydrateReservationDetail, refreshReservationsAfterMutation, selectedReservation]);

  const handleSettleChargeItem = useCallback(async (item: ReservationChargeItem) => {
    if (!selectedReservation || !canWritePayments || activePaymentRecordMutationId) {
      return;
    }
    const amount = Math.max(item.remainingAmount || item.amount || 0, 0);
    if (amount <= 0) {
      setReservationActionError('수납 처리할 잔액이 없습니다.');
      return;
    }
    setActivePaymentRecordMutationId(item.id);
    setReservationActionError(null);
    try {
      await createReservationPaymentRecord(selectedReservation.id, {
        amount,
        method: paymentMethodDraft,
        payerType: item.payerType ?? 'customer',
        confirmationStatus: 'confirmed',
        allocations: [{ chargeItemId: item.id, amount }],
        memo: '예약 상세에서 수납 완료 처리',
      });
      toast.success('수납 기록을 생성했습니다.');
      void hydrateReservationDetail(selectedReservation.id, selectedReservation);
      refreshReservationsAfterMutation('수납 기록은 생성되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
    } catch (error) {
      setReservationActionError(error instanceof Error ? error.message : '수납 처리 중 오류가 발생했습니다.');
    } finally {
      setActivePaymentRecordMutationId(null);
    }
  }, [
    activePaymentRecordMutationId,
    canWritePayments,
    hydrateReservationDetail,
    paymentMethodDraft,
    refreshReservationsAfterMutation,
    selectedReservation,
  ]);

  const handleCreateRefundChargeItem = useCallback(async (record: ReservationPaymentRecord) => {
    if (!selectedReservation || !canWritePayments || activePaymentRecordMutationId) {
      return;
    }
    setActivePaymentRecordMutationId(record.id);
    setReservationActionError(null);
    try {
      await createReservationChargeItem(selectedReservation.id, {
        amount: record.amount,
        chargeType: 'refund',
        payerType: record.payerType ?? 'customer',
        status: 'refund_due',
        memo: `수납 기록 ${record.id} 환불 예정`,
      });
      toast.success('환불 예정 항목을 등록했습니다.');
      void hydrateReservationDetail(selectedReservation.id, selectedReservation);
      refreshReservationsAfterMutation('환불 예정 항목은 등록되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
    } catch (error) {
      setReservationActionError(error instanceof Error ? error.message : '환불 예정 항목 등록 중 오류가 발생했습니다.');
    } finally {
      setActivePaymentRecordMutationId(null);
    }
  }, [activePaymentRecordMutationId, canWritePayments, hydrateReservationDetail, refreshReservationsAfterMutation, selectedReservation]);

  const handleCompleteRefundChargeItem = useCallback(async (item: ReservationChargeItem) => {
    if (!selectedReservation || !canWritePayments || activePaymentRecordMutationId) {
      return;
    }
    setActivePaymentRecordMutationId(item.id);
    setReservationActionError(null);
    try {
      await patchChargeItem(item.id, {
        status: 'paid',
        paidAmount: item.amount,
        refundCompletedAt: new Date().toISOString(),
        refundMethod: 'manual',
        refundReason: item.memo ?? '예약 상세에서 환불 완료 처리',
        memo: item.memo ?? '예약 상세에서 환불 완료 처리',
      });
      toast.success('환불 예정 항목을 완료 처리했습니다.');
      void hydrateReservationDetail(selectedReservation.id, selectedReservation);
      refreshReservationsAfterMutation('환불 완료 처리는 저장되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
    } catch (error) {
      setReservationActionError(error instanceof Error ? error.message : '환불 완료 처리 중 오류가 발생했습니다.');
    } finally {
      setActivePaymentRecordMutationId(null);
    }
  }, [activePaymentRecordMutationId, canWritePayments, hydrateReservationDetail, refreshReservationsAfterMutation, selectedReservation]);

  const handleWaiveRefundChargeItem = useCallback(async (item: ReservationChargeItem) => {
    if (!selectedReservation || !canWritePayments || activePaymentRecordMutationId) {
      return;
    }
    setActivePaymentRecordMutationId(item.id);
    setReservationActionError(null);
    try {
      await patchChargeItem(item.id, {
        status: 'waived',
        paidAmount: 0,
        refundReason: item.memo ?? '예약 상세에서 환불 면제 처리',
        memo: item.memo ?? '예약 상세에서 환불 면제 처리',
      });
      toast.success('환불 예정 항목을 면제 처리했습니다.');
      void hydrateReservationDetail(selectedReservation.id, selectedReservation);
      refreshReservationsAfterMutation('환불 면제 처리는 저장되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
    } catch (error) {
      setReservationActionError(error instanceof Error ? error.message : '환불 면제 처리 중 오류가 발생했습니다.');
    } finally {
      setActivePaymentRecordMutationId(null);
    }
  }, [activePaymentRecordMutationId, canWritePayments, hydrateReservationDetail, refreshReservationsAfterMutation, selectedReservation]);

  const handleStartReservation = useCallback(async () => {
    if (!canTransitionReservations) {
      setReservationActionError('대여 시작 처리 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (!selectedReservation || selectedReservation.type !== 'reservation' || activeReservationAction) {
      return;
    }
    if (!canStartReservationNow(selectedReservation)) {
      setReservationActionError('예약 시작 시각 이후에만 차량 인수 처리가 가능합니다.');
      return;
    }

    const shouldForcePickup = requiresForcedPickupPrompt(selectedReservation, selectedVehicleAsset);
    let hasInspectionIssueCard = (selectedVehicleAsset?.issues ?? []).some((issue) => issue.includes('정기점검'));
    if (selectedVehicleAsset?.vehicleNumber) {
      try {
        hasInspectionIssueCard = await hasInspectionIssueCardForVehicle(selectedVehicleAsset.vehicleNumber);
      } catch {
        // Fall back to asset.issues when action-items lookup is unavailable.
      }
    }
    const pickupInspectionNoticeDays = getPickupInspectionNoticeDaysByIssueCard(
      selectedReservation,
      selectedVehicleAsset,
      hasInspectionIssueCard,
    );
    const insuranceDueInRange = isInsuranceDueWithinReservationRange(selectedVehicleAsset, selectedReservation);
    const shouldBlockPickupForExpiredInsurance = isInsuranceExpired(selectedVehicleAsset);
    if (shouldBlockPickupForExpiredInsurance) {
      await confirmReservationWarning({
        message: EXPIRED_INSURANCE_PICKUP_MESSAGE,
        cancelLabel: '닫기',
        dismissResult: false,
      });
      return;
    }
    const pickupWarningPrompt = buildPickupWarningPrompt({
      shouldForcePickup,
      inspectionNoticeDays: pickupInspectionNoticeDays,
      insuranceDueInRange,
    });
    if (pickupWarningPrompt) {
      const confirmed = await confirmReservationWarning(pickupWarningPrompt);
      if (!confirmed) {
        return;
      }
    }

    setActiveReservationAction('start');
    setReservationActionError(null);

    try {
      const payload = await transitionReservation(selectedReservation.id, {
        to: '대여중',
        reason: '차량 인수 처리',
        force: shouldForcePickup,
      });
      const fallbackReservation: Reservation = {
        ...selectedReservation,
        contractStatus: '대여중',
        type: 'rental',
      };
      const updatedReservation = toReservationDetail(payload, fallbackReservation);

      setReservationsData((prev) => prev.map((reservation) => (
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      )));
      setSelectedReservation(updatedReservation);
      const matchedAsset = vehicleAssets.find((asset) => asset.vehicleNumber === updatedReservation.vehicleNumber);
      if (matchedAsset) {
        setSelectedVehicleAsset({
          ...matchedAsset,
          status: toVehicleStatusFromReservation(updatedReservation.type),
        });
      } else {
        setSelectedVehicleAsset(createReservationFallbackVehicleAsset(updatedReservation));
      }

      refreshReservationsAfterMutation('변경은 저장되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
      void hydrateReservationDetail(updatedReservation.id, updatedReservation);
      toast.success('차량 인수 처리가 완료되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setReservationActionError(error.message || '대여 시작 요청값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setReservationActionError('대여 시작 처리 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 404) {
          await hydrateReservationsData();
          closeReservationDetail();
          return;
        }
        if (error.status === 409) {
          if (error.message === EXPIRED_INSURANCE_PICKUP_MESSAGE) {
            await confirmReservationWarning({
              message: error.message,
              cancelLabel: '닫기',
              dismissResult: false,
            });
            return;
          }
          setReservationActionError(error.message || '상태 전이 충돌이 발생했습니다. 최신 상태를 확인해 주세요.');
          void hydrateReservationsData();
          void hydrateReservationDetail(selectedReservation.id, selectedReservation);
          return;
        }
        if (isRetryableMutationError(error)) {
          setReservationActionError(RETRY_TOAST_MESSAGE);
          toast.error(RETRY_TOAST_MESSAGE);
          return;
        }

        setReservationActionError(error.message || '대여 시작 처리 중 오류가 발생했습니다.');
        return;
      }

      setReservationActionError('대여 시작 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error(RETRY_TOAST_MESSAGE);
    } finally {
      setActiveReservationAction(null);
    }
  }, [
    activeReservationAction,
    canTransitionReservations,
    closeReservationDetail,
    hydrateReservationDetail,
    hydrateReservationsData,
    refreshReservationsAfterMutation,
    hasInspectionIssueCardForVehicle,
    selectedReservation,
    selectedVehicleAsset,
    vehicleAssets,
  ]);

  const handleCancelReservation = useCallback(async () => {
    if (!canTransitionReservations) {
      setReservationActionError('예약 취소 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (!selectedReservation || selectedReservation.type !== 'reservation' || activeReservationAction) {
      return;
    }

    setShowCancelReservationConfirm(true);
  }, [activeReservationAction, canTransitionReservations, selectedReservation]);

  const handleConfirmCancelReservation = useCallback(async () => {
    if (!canTransitionReservations) {
      setReservationActionError('예약 취소 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      setShowCancelReservationConfirm(false);
      return;
    }

    if (!selectedReservation || selectedReservation.type !== 'reservation' || activeReservationAction) {
      setShowCancelReservationConfirm(false);
      return;
    }

    setShowCancelReservationConfirm(false);
    setActiveReservationAction('cancel');
    setReservationActionError(null);

    try {
      await cancelReservation(selectedReservation.id);
      closeReservationDetail();
      refreshReservationsAfterMutation('예약은 취소되었지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.');
      toast.success('예약이 취소되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setReservationActionError('예약 취소 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 404) {
          await hydrateReservationsData();
          closeReservationDetail();
          toast.success('이미 취소되었거나 존재하지 않는 예약입니다.');
          return;
        }
        if (error.status === 409) {
          setReservationActionError(error.message || '예약 취소 상태가 변경되었습니다. 최신 상태를 확인해 주세요.');
          void hydrateReservationsData();
          void hydrateReservationDetail(selectedReservation.id, selectedReservation);
          return;
        }
        if (isRetryableMutationError(error)) {
          setReservationActionError(RETRY_TOAST_MESSAGE);
          toast.error(RETRY_TOAST_MESSAGE);
          return;
        }

        setReservationActionError(error.message || '예약 취소 중 오류가 발생했습니다.');
        return;
      }

      setReservationActionError('예약 취소 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error(RETRY_TOAST_MESSAGE);
    } finally {
      setActiveReservationAction(null);
    }
  }, [
    activeReservationAction,
    canTransitionReservations,
    closeReservationDetail,
    hydrateReservationDetail,
    hydrateReservationsData,
    refreshReservationsAfterMutation,
    selectedReservation,
  ]);

  const handleEnterEditMode = useCallback(() => {
    if (!selectedReservation || !canWriteReservations) {
      return;
    }
    const currentVin = selectedReservation.vin ?? '';
    setEditVin(currentVin);
    const startFull = selectedReservation.startDateFull ?? '';
    const endFull = selectedReservation.endDateFull ?? '';
    setEditStartAt(startFull.length === 10 ? `${startFull}T09:00` : startFull.slice(0, 16));
    setEditEndAt(endFull.length === 10 ? `${endFull}T18:00` : endFull.slice(0, 16));
    setEditReason('');
    setEditSubmitError(null);
    setIsEditSubmitting(false);
    setActiveTab('reservation');
    setIsEditMode(true);
  }, [canWriteReservations, selectedReservation]);

  const handleCancelEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditSubmitError(null);
    setIsEditSubmitting(false);
  }, []);

  const handleSubmitEdit = useCallback(async () => {
    if (!selectedReservation || isEditSubmitting) {
      return;
    }
    if (!canWriteReservations) {
      setEditSubmitError('예약 수정 권한이 없습니다.');
      return;
    }

    const currentVin = selectedReservation.vin ?? '';
    const vehicleChanged = editVin !== currentVin && editVin.length > 0;

    const startIso = editStartAt ? new Date(editStartAt).toISOString() : undefined;
    const endIso = editEndAt ? new Date(editEndAt).toISOString() : undefined;
    if (startIso && endIso && new Date(startIso) >= new Date(endIso)) {
      setEditSubmitError('종료일은 시작일보다 이후여야 합니다.');
      return;
    }

    const payload: Record<string, string | undefined> = {};
    if (startIso) {
      payload.startAt = startIso;
    }
    if (endIso) {
      payload.endAt = endIso;
    }
    if (vehicleChanged) {
      const targetAsset = vehicleAssets.find((a) => a.vin === editVin);
      payload.vin = editVin;
      payload.assetId = editVin;
      payload.plate = targetAsset?.vehicleNumber ?? undefined;
      payload.vehicleNumber = targetAsset?.vehicleNumber ?? undefined;
      if (editReason.trim()) {
        payload.reason = editReason.trim();
      }
    }

    if (!Object.keys(payload).length) {
      setEditSubmitError('변경 사항이 없습니다.');
      return;
    }

    setIsEditSubmitting(true);
    setEditSubmitError(null);

    try {
      await patchReservation(selectedReservation.id, payload);
      const fallbackReservation: Reservation = {
        ...selectedReservation,
        ...(vehicleChanged && payload.vehicleNumber ? { vehicleNumber: payload.vehicleNumber } : {}),
        ...(vehicleChanged && payload.vin ? { vin: payload.vin } : {}),
      };
      setIsEditMode(false);
      refreshReservationsAfterMutation('예약이 수정되었지만 목록을 다시 불러오지 못했습니다.');
      void hydrateReservationDetail(selectedReservation.id, fallbackReservation);
      toast.success(vehicleChanged ? '차량이 변경되었습니다.' : '예약이 수정되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setEditSubmitError(error.message || '입력 값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setEditSubmitError('예약 수정 권한이 없습니다.');
          return;
        }
        if (error.status === 404) {
          setEditSubmitError('대상 차량 또는 예약을 찾을 수 없습니다.');
          return;
        }
        if (error.status === 409) {
          setEditSubmitError(error.message || '해당 차량에 겹치는 예약이 존재합니다.');
          void hydrateReservationDetail(selectedReservation.id, selectedReservation);
          return;
        }
        setEditSubmitError(error.message || '예약 수정 중 오류가 발생했습니다.');
        return;
      }
      setEditSubmitError('예약 수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsEditSubmitting(false);
    }
  }, [
    canWriteReservations,
    editEndAt,
    editReason,
    editStartAt,
    editVin,
    hydrateReservationDetail,
    isEditSubmitting,
    refreshReservationsAfterMutation,
    selectedReservation,
    vehicleAssets,
  ]);

  const handleReturnClick = useCallback(() => {
    if (!canWriteReservations) {
      setReturnSubmitError('차량 반납 처리 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }
    if (selectedReservation?.type !== 'rental') {
      setReturnSubmitError('반납은 대여중 상태에서만 처리할 수 있습니다.');
      return;
    }
    setPendingLateReturnActionItemId(null);
    setResolvedLateReturnActionItemId(null);
    setLateReturnMemoDraft('');
    setLateReturnMemoSaveError(null);
    setIsLateReturnMemoSaving(false);
    setIsLateReturnMemoSaved(false);
    setReturnSubmitError(null);
    setShowReturnConfirm(true);
  }, [canWriteReservations, selectedReservation]);

  const handleConfirmReturn = useCallback(async () => {
    if (!canWriteReservations) {
      setReturnSubmitError('차량 반납 처리 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (!selectedReservation || isReturnSubmitting) {
      return;
    }

    if (selectedReservation.type !== 'rental') {
      setReturnSubmitError('대여중 상태에서만 차량 반납 처리가 가능합니다.');
      return;
    }

    const isLateReturnReservation = isReservationLateReturn(selectedReservation);
    setIsReturnSubmitting(true);
    setReturnSubmitError(null);
    setLateReturnMemoSaveError(null);

    try {
      let lateReturnActionItemId: string | null = null;
      if (isLateReturnReservation) {
        lateReturnActionItemId = await findLateReturnActionItemId(selectedReservation.id);
        if (!lateReturnActionItemId) {
          setReturnSubmitError('반납 지연 이슈를 찾을 수 없어 함께 완료 처리할 수 없습니다.');
          return;
        }
      }

      const payload = await returnReservation(selectedReservation.id, {
        returnedAt: new Date().toISOString(),
      });
      const fallbackReservation: Reservation = {
        ...selectedReservation,
        contractStatus: '완료',
        type: 'return',
        issues: withoutIssueLabel(selectedReservation.issues, '반납 지연'),
      };
      let updatedReservation = toReservationDetail(payload, fallbackReservation);
      if (isLateReturnReservation) {
        updatedReservation = {
          ...updatedReservation,
          issues: withoutIssueLabel(updatedReservation.issues, '반납 지연'),
        };
      }

      setReservationsData((prev) => prev.map((reservation) => (
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      )));
      setSelectedReservation(updatedReservation);
      const matchedAsset = vehicleAssets.find((asset) => asset.vehicleNumber === updatedReservation.vehicleNumber);
      if (matchedAsset) {
        setSelectedVehicleAsset({
          ...matchedAsset,
          status: toVehicleStatusFromReservation(updatedReservation.type),
          issues: isLateReturnReservation
            ? withoutIssueLabel(matchedAsset.issues, '반납 지연')
            : matchedAsset.issues,
        });
      } else {
        setSelectedVehicleAsset(createReservationFallbackVehicleAsset(updatedReservation));
      }

      await hydrateReservationsData();
      void hydrateReservationDetail(updatedReservation.id, updatedReservation);
      if (lateReturnActionItemId) {
        setPendingLateReturnActionItemId(lateReturnActionItemId);
        toast.success('차량이 반납 처리되었습니다.');
      } else {
        setShowReturnConfirm(false);
        toast.success('차량이 반납 처리되었습니다.');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setReturnSubmitError(error.message || '반납 요청값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setReturnSubmitError('차량 반납 처리 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setReturnSubmitError(error.message || '상태 전이 충돌이 발생했습니다. 최신 상태를 확인해 주세요.');
          void hydrateReservationsData();
          void hydrateReservationDetail(selectedReservation.id, selectedReservation);
          return;
        }
        if (isRetryableMutationError(error)) {
          setReturnSubmitError(RETRY_TOAST_MESSAGE);
          toast.error(RETRY_TOAST_MESSAGE);
          return;
        }

        setReturnSubmitError(error.message || '반납 처리 중 오류가 발생했습니다.');
        return;
      }

      setReturnSubmitError('반납 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error(RETRY_TOAST_MESSAGE);
    } finally {
      setIsReturnSubmitting(false);
    }
  }, [
    canWriteReservations,
    findLateReturnActionItemId,
    hydrateReservationDetail,
    hydrateReservationsData,
    isReturnSubmitting,
    selectedReservation,
    vehicleAssets,
  ]);

  const handleConfirmLateReturnIssueResolution = useCallback(async () => {
    if (!pendingLateReturnActionItemId || isReturnSubmitting) {
      return;
    }

    setIsReturnSubmitting(true);
    setReturnSubmitError(null);
    setLateReturnMemoSaveError(null);
    try {
      await patchActionRequiredStatus(pendingLateReturnActionItemId, { status: 'resolved' });
      setPendingLateReturnActionItemId(null);
      setResolvedLateReturnActionItemId(pendingLateReturnActionItemId);
      setLateReturnMemoDraft('');
      setIsLateReturnMemoSaved(false);
      toast.success('반납 지연 이슈가 완료 처리되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        setReturnSubmitError(error.message || '반납 지연 이슈 완료 처리 중 오류가 발생했습니다.');
      } else {
        setReturnSubmitError('반납 지연 이슈 완료 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsReturnSubmitting(false);
    }
  }, [isReturnSubmitting, pendingLateReturnActionItemId]);

  const handleSaveLateReturnMemo = useCallback(async () => {
    if (!resolvedLateReturnActionItemId || !lateReturnMemoDraft.trim() || isLateReturnMemoSaving) {
      return;
    }

    setIsLateReturnMemoSaving(true);
    setLateReturnMemoSaveError(null);
    try {
      await patchActionRequiredMemo(resolvedLateReturnActionItemId, {
        memo: lateReturnMemoDraft.trim(),
      });
      setIsLateReturnMemoSaved(true);
      toast.success('메모가 저장되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        setLateReturnMemoSaveError(error.message || '메모 저장 중 오류가 발생했습니다.');
      } else {
        setLateReturnMemoSaveError('메모 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsLateReturnMemoSaving(false);
    }
  }, [isLateReturnMemoSaving, lateReturnMemoDraft, resolvedLateReturnActionItemId]);

  const handleAccidentReport = useCallback(async (
    report: AccidentReportFormValues,
  ): Promise<AccidentReportSubmitFeedback | null> => {
    if (!canWriteReservations) {
      return {
        formError: '사고 등록 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
      };
    }

    if (!selectedReservation) {
      return {
        formError: '선택된 예약 정보가 없습니다. 다시 시도해 주세요.',
      };
    }

    const now = new Date();
    const accidentDate = formatDateAsYmd(now);
    const accidentHour = pad2(now.getHours());
    const accidentMinute = pad2(now.getMinutes());
    const accidentSecond = pad2(now.getSeconds());
    const accidentDateTime = now.toISOString();
    const accidentDisplayTime = toAccidentDisplayTime(now);
    const blackboxFileName = sanitizeFileName(report.blackboxFile.name);

    try {
      const contentType = resolveReservationAttachmentContentType(report.blackboxFile);
      const signedUpload = await signAssetUpload({
        fileName: blackboxFileName,
        folder: `rentals/${selectedReservation.id}/blackbox`,
        contentType,
        fileSize: report.blackboxFile.size,
      });
      await uploadFileToSignedUrl(signedUpload.uploadUrl, report.blackboxFile, signedUpload.contentType || contentType);
      const payload = await reportReservationAccident(selectedReservation.id, {
        accidentReport: {
          accidentDate,
          accidentHour,
          accidentMinute,
          accidentSecond,
          accidentDateTime,
          accidentDisplayTime,
          blackboxFileName,
          blackboxGcsObjectName: signedUpload.objectName,
          handlerName: report.assignee,
          recordedAt: accidentDateTime,
        },
        memo: report.description,
      });

      const fallbackReservation: Reservation = {
        ...selectedReservation,
        issues: withIssueLabel(selectedReservation.issues, '사고 접수'),
      };
      const updatedReservation = toReservationDetail(payload, fallbackReservation);
      const nextReservation: Reservation = {
        ...updatedReservation,
        issues: withIssueLabel(updatedReservation.issues, '사고 접수'),
      };

      setReservationsData((prev) => prev.map((reservation) => (
        reservation.id === nextReservation.id ? nextReservation : reservation
      )));
      setSelectedReservation(nextReservation);
      const matchedAsset = vehicleAssets.find((asset) => asset.vehicleNumber === nextReservation.vehicleNumber);
      if (matchedAsset) {
        setSelectedVehicleAsset({
          ...matchedAsset,
          issues: withIssueLabel(matchedAsset.issues, '사고 접수'),
        });
      } else {
        setSelectedVehicleAsset(createReservationFallbackVehicleAsset(nextReservation));
      }

      setShowAccidentModal(false);
      await hydrateReservationsData();
      void hydrateReservationDetail(nextReservation.id, nextReservation);
      toast.success('사고가 등록되었습니다.');
      if (canViewActionRequired) {
        navigate('/action-required?filter=대여 중 사고');
      }
      return null;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          return {
            formError: error.message || '입력값을 확인해 주세요.',
            fieldErrors: toAccidentFieldErrors(error),
          };
        }
        if (error.status === 403) {
          return {
            formError: '사고 등록 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
          };
        }
        if (error.status === 409) {
          return {
            formError: error.message || '상태 전이 충돌이 발생했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.',
          };
        }
        if (isRetryableMutationError(error)) {
          toast.error(RETRY_TOAST_MESSAGE);
          return {
            formError: RETRY_TOAST_MESSAGE,
          };
        }

        return {
          formError: error.message || '사고 등록 중 오류가 발생했습니다.',
        };
      }

      toast.error(RETRY_TOAST_MESSAGE);
      return {
        formError: '사고 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }, [canViewActionRequired, canWriteReservations, hydrateReservationDetail, hydrateReservationsData, navigate, selectedReservation, vehicleAssets]);

  return (
    <Layout title="대여 예약">
      <div className="p-4 h-full flex flex-col">
        {/* 필터와 버튼 */}
        <div className="mb-3 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-600">보기:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleViewFilterChange('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    viewFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => handleViewFilterChange('reservation')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                    viewFilter === 'reservation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  예약
                </button>
                <button
                  onClick={() => handleViewFilterChange('rental')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                    viewFilter === 'rental'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  대여
                </button>
                <button
                  onClick={() => handleViewFilterChange('return')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                    viewFilter === 'return'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                  반납
                </button>
                <button
                  onClick={() => handleViewFilterChange('unpaid')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                    viewFilter === 'unpaid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  미납
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                if (!canStartReservationMutation) {
                  toast.error(isPageLoading
                    ? '예약 데이터를 최신 상태로 불러온 뒤 다시 시도해 주세요.'
                    : '예약 생성 권한이 없습니다.');
                  return;
                }
                setShowModal(true);
              }}
              data-testid="reservation-new-contract-button"
              disabled={!canStartReservationMutation}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              새 계약 등록
            </button>
          </div>

        </div>

        {/* 주간 캘린더 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          {/* 날짜 네비게이션 */}
          <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
            <button
              onClick={() => setCurrentWeekStart(prev => prev - 7)}
              className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
              title="1주 이전"
            >
              <ChevronLeft className="w-4 h-4 text-blue-600" />
            </button>
            
            <button
              onClick={() => setCurrentWeekStart(calendarStartOffsetForTarget(0))}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              오늘
            </button>
            
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  if (e.target.value) {
                    const target = new Date(e.target.value);
                    const targetDayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
                    const diffDays = Math.floor((targetDayStart.getTime() - CALENDAR_BASE_DATE.getTime()) / (1000 * 60 * 60 * 24));
                    setCurrentWeekStart(calendarStartOffsetForTarget(diffDays));
                  }
                }}
                className="px-3 py-1.5 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-xs text-blue-600 font-medium">로 이동</span>
            </div>

            <button
              onClick={() => setCurrentWeekStart(prev => prev + 7)}
              className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
              title="1주 이후"
            >
              <ChevronRight className="w-4 h-4 text-blue-600" />
            </button>

            <div className="relative min-w-0 flex-1 self-stretch">
              {isPaymentSyncStatusVisible && (
                <div
                  role="status"
                  aria-live="polite"
                  title={paymentSyncStatusMessage}
                  className={`absolute left-0 top-1/2 z-10 inline-flex max-w-[12rem] -translate-y-1/2 items-center gap-1.5 rounded-md border bg-white/95 px-2 py-1 text-xs shadow-sm sm:max-w-[18rem] ${
                    paymentSyncError && !isPaymentSyncing
                      ? 'border-amber-200 text-amber-700'
                      : 'border-blue-200 text-blue-700'
                  }`}
                >
                  {isPaymentSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="hidden truncate sm:inline">
                    {isPaymentSyncing ? '결제 동기화 중' : '동기화 실패'}
                  </span>
                  {paymentSyncError && !isPaymentSyncing && (
                    <button
                      type="button"
                      onClick={retryPaymentSync}
                      aria-label="결제 상태 동기화 다시 시도"
                      title="다시 시도"
                      className="rounded p-0.5 hover:bg-amber-100"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <span className="text-xs text-blue-700 font-semibold">
              {formatDateKst(toDateFromOffset(currentWeekStart))} ~
            </span>
          </div>

          {/* 차량 필터 영역 */}
          <div className="bg-gray-50 border-b border-gray-200 shrink-0">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="flex items-center gap-2">
                <label htmlFor="reservations-model-filter" className="text-xs font-semibold text-gray-600">차종:</label>
                <select
                  id="reservations-model-filter"
                  name="modelFilter"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">전체</option>
                  {uniqueModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="reservations-vehicle-search-query" className="text-xs font-semibold text-gray-600">차량번호:</label>
                <input
                  id="reservations-vehicle-search-query"
                  name="vehicleSearchQuery"
                  type="text"
                  placeholder="차량번호 검색"
                  aria-label="차량번호 검색"
                  value={vehicleSearchQuery}
                  onChange={(e) => setVehicleSearchQuery(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                확장 필터
              </button>

              <div className="flex-1" />

              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                캘린더에서 드래그하여 예약을 생성하세요
              </span>

              <span className="text-xs text-gray-500">
                총 <span className="font-semibold text-blue-600">{filteredVehicles.length}</span>대 표시 중
              </span>
            </div>

            {showAdvancedFilters && (
              <div className="flex flex-wrap items-center gap-3 px-3 pb-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="reservations-rental-type-filter" className="text-xs font-semibold text-gray-600">계약유형:</label>
                  <select
                    id="reservations-rental-type-filter"
                    name="rentalTypeFilter"
                    value={rentalTypeFilter}
                    onChange={(event) => handleRentalTypeFilterChange(event.target.value as RentalTypeFilter)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">전체</option>
                    <option value="short_term">단기렌트</option>
                    <option value="long_term">장기렌트</option>
                    <option value="accident_replacement">사고대차</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="reservations-customer-query" className="text-xs font-semibold text-gray-600">예약자:</label>
                  <input
                    id="reservations-customer-query"
                    type="text"
                    placeholder="이름/전화번호"
                    value={customerSearchDraft}
                    onChange={handleCustomerSearchChange}
                    onCompositionStart={handleCustomerSearchCompositionStart}
                    onCompositionEnd={handleCustomerSearchCompositionEnd}
                    onKeyDown={handleCustomerSearchKeyDown}
                    onBlur={(event) => commitCustomerSearchQuery(event.currentTarget.value)}
                    className="w-40 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="reservations-workflow-status-filter" className="text-xs font-semibold text-gray-600">업무상태:</label>
                  <select
                    id="reservations-workflow-status-filter"
                    name="workflowStatusFilter"
                    value={workflowStatusFilter}
                    onChange={(event) => handleWorkflowStatusFilterChange(event.target.value as WorkflowStatusFilter)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">전체</option>
                    {Object.entries(WORKFLOW_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="reservations-closeout-status-filter" className="text-xs font-semibold text-gray-600">정산:</label>
                  <select
                    id="reservations-closeout-status-filter"
                    name="closeoutStatusFilter"
                    value={closeoutStatusFilter}
                    onChange={(event) => handleCloseoutStatusFilterChange(event.target.value as CloseoutStatusFilter)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">전체</option>
                    {Object.entries(CLOSEOUT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="reservations-cancel-status-filter" className="text-xs font-semibold text-gray-600">취소정산:</label>
                  <select
                    id="reservations-cancel-status-filter"
                    name="cancellationSettlementStatusFilter"
                    value={cancellationSettlementStatusFilter}
                    onChange={(event) => handleCancellationSettlementStatusFilterChange(event.target.value as CancellationSettlementStatusFilter)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">전체</option>
                    {Object.entries(CANCELLATION_SETTLEMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {rentalTypeFilter === 'long_term' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="reservations-long-term-status-filter" className="text-xs font-semibold text-gray-600">장기상태:</label>
                    <select
                      id="reservations-long-term-status-filter"
                      name="longTermAccountStatusFilter"
                      value={longTermAccountStatusFilter}
                      onChange={(event) => handleLongTermAccountStatusFilterChange(event.target.value as LongTermAccountStatusFilter)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="all">전체</option>
                      {Object.entries(LONG_TERM_ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {rentalTypeFilter === 'accident_replacement' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="reservations-accident-replacement-status-filter" className="text-xs font-semibold text-gray-600">대차상태:</label>
                    <select
                      id="reservations-accident-replacement-status-filter"
                      name="accidentReplacementStatusFilter"
                      value={accidentReplacementStatusFilter}
                      onChange={(event) => handleAccidentReplacementStatusFilterChange(event.target.value as AccidentReplacementStatusFilter)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="all">전체</option>
                      {Object.entries(ACCIDENT_REPLACEMENT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 가로 스크롤 가능한 컨테이너 */}
          <PageStateBoundary
            isLoading={isCalendarBlockingLoading}
            error={pageError}
            isEmpty={!isCalendarBlockingLoading && !pageError && filteredVehicles.length === 0}
            errorDescription={pageErrorDescription}
            emptyTitle="조건에 맞는 차량이 없습니다"
            emptyDescription="필터를 완화하거나 차량번호 검색어를 지워 다시 확인해 주세요."
            onRetry={handleReservationsRetry}
            errorActionLabel={pageErrorActionLabel}
            onErrorAction={handleReservationsErrorAction}
            emptyActionLabel="필터 초기화"
            onEmptyAction={resetReservationFilters}
            className="m-3 min-h-[320px]"
          >
            <div className="overflow-x-auto flex-1" ref={scrollContainerRef} onScroll={handleScroll}>
              <div style={{ minWidth: `${120 + totalDaysToShow * 85}px` }} className="h-full">
                {/* 날짜 헤더 */}
                <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${totalDaysToShow}, 1fr)` }} className="border-b border-gray-200">
                  <div className="px-3 py-2 bg-gray-50 font-semibold text-sm text-gray-600 border-r border-gray-200 sticky left-0 z-10">
                    차량
                  </div>
                  {dates.map((dayOffset, index) => {
                    const date = toDateFromOffset(dayOffset);
                    const dayOfWeek = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1];
                    const prevDate = index > 0 ? toDateFromOffset(dates[index - 1]) : null;
                    const showMonth = !prevDate || prevDate.getMonth() !== date.getMonth();

                    return (
                      <div
                        key={index}
                        className="px-2 py-2 bg-gray-50 text-center border-r border-gray-200"
                      >
                        {showMonth && (
                          <div className="text-xs font-semibold text-blue-600 mb-0.5">
                            {date.getMonth() + 1}월
                          </div>
                        )}
                        <div className="text-xs text-gray-500">{dayOfWeek}</div>
                        <div className="text-sm font-medium text-gray-900 mt-0.5">
                          {date.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 차량 행 */}
                {filteredVehicles.map((vehicle, vIndex) => {
                  const vehicleReservations = reservationsByVehicle.get(vehicle) ?? [];
                  const vehicleReservationIntervals = reservationIntervalsByVehicle.get(vehicle) ?? [];

                  return (
                  <div key={vIndex} className="relative border-b border-gray-200">
                    <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${totalDaysToShow}, 1fr)` }}>
                      {/* 차량번호 */}
                      <div className="px-3 py-3 bg-gray-50 font-medium text-sm text-gray-900 border-r border-gray-200 flex items-center sticky left-0 z-10">
                        {vehicle}
                      </div>

                      {/* 날짜 셀들 */}
                      {dates.map((dayOffset, dateIndex) => {
                        const cellDate = currentWeekStart + dateIndex;
                        const isInDragSelection = dragStart && dragEnd &&
                          dragStart.vehicle === vehicle &&
                          cellDate >= Math.min(dragStart.date, dragEnd.date) &&
                          cellDate <= Math.max(dragStart.date, dragEnd.date);

                        // 충돌 검증: 이 셀에 기존 예약이 있는지 확인
                        const hasConflict = vehicleReservationIntervals.some((interval) => (
                          cellDate >= interval.start && cellDate <= interval.end
                        ));

                        return (
                          <div
                            key={dateIndex}
                            className={`h-14 border-r border-gray-100 relative cursor-crosshair ${
                              isInDragSelection ? (hasConflict ? 'bg-red-200/50' : 'bg-blue-200/50') : 'hover:bg-blue-50/30'
                            }`}
                            onMouseDown={() => {
                              setIsDragging(true);
                              setDragStart({ vehicle, date: cellDate });
                              setDragEnd({ vehicle, date: cellDate });
                              setDragSelection(null);
                            }}
                            onMouseEnter={() => {
                              if (isDragging && dragStart) {
                                setDragEnd({ vehicle, date: cellDate });
                              }
                            }}
                            onMouseUp={() => {
                              if (isDragging && dragStart && dragEnd) {
                                const startDate = Math.min(dragStart.date, dragEnd.date);
                                const endDate = Math.max(dragStart.date, dragEnd.date);

                                // 충돌 검사
                                const conflicts = vehicleReservations.filter((res) => {
                                  const occupiedEndDate = getReservationOccupiedEndDate(res);
                                  return !(endDate < res.startDate || startDate > occupiedEndDate);
                                });

                                if (conflicts.length > 0) {
                                  setDragConflictPrompt({
                                    vehicleNumber: vehicle,
                                    startDateLabel: toDateLabelFromOffset(startDate),
                                    endDateLabel: toDateLabelFromOffset(endDate),
                                    conflicts: conflicts.map((conflict) => ({
                                      id: conflict.id,
                                      customer: conflict.customer,
                                      startDateFull: conflict.startDateFull,
                                      endDateFull: conflict.endDateFull,
                                    })),
                                  });
                                } else {
                                  if (!canStartReservationMutation) {
                                    toast.error(isPageLoading
                                      ? '예약 데이터를 최신 상태로 불러온 뒤 다시 시도해 주세요.'
                                      : '예약 생성 권한이 없습니다.');
                                    return;
                                  }
                                  setDragSelection({ vehicleNumber: vehicle, startDate, endDate });
                                  setShowModal(true);
                                }
                              }
                              setIsDragging(false);
                              setDragStart(null);
                              setDragEnd(null);
                            }}
                          >
                          </div>
                        );
                      })}
                    </div>

                    {/* 예약 블록 오버레이 - absolute로 전체 행 위에 배치 */}
                    <div className="absolute inset-0 left-[120px] pointer-events-none">
                      {vehicleReservations
                        .filter((res) => (
                          getReservationCalendarSegments(res).some((segment) => (
                            doesReservationSegmentOverlapView(segment, currentWeekStart, currentViewEnd)
                          ))
                        ))
                        .flatMap((res) => {
                          const isHighlighted = searchQuery && res.customer.includes(searchQuery);

                          return getReservationCalendarSegments(res)
                            .filter((segment) => doesReservationSegmentOverlapView(segment, currentWeekStart, currentViewEnd))
                            .map((segment) => {
                              const blockStart = Math.max(segment.startDate, currentWeekStart);
                              const blockEnd = Math.min(segment.endDate, currentViewEnd);
                              const startIndex = blockStart - currentWeekStart;
                              const duration = blockEnd - blockStart + 1;
                              const cellWidth = 100 / totalDaysToShow;
                              const left = startIndex * cellWidth;
                              const width = duration * cellWidth;
                              const segmentIssueLabel = segment.kind === 'overdue'
                                ? '반납 지연'
                                : res.issues?.[0];

                              return (
                                <div
                                  key={`${res.id}-${segment.kind}-${segment.startDate}-${segment.endDate}`}
                                  onClick={() => handleReservationClick(res)}
                                  data-testid={segment.kind === 'overdue'
                                    ? `reservation-overdue-block-${res.id}`
                                    : `reservation-block-${res.id}`}
                                  className={`absolute top-1.5 h-11 ${
                                    segment.kind === 'overdue' && res.type !== 'return' ? 'bg-red-500' : getBlockColor(res)
                                  } rounded px-2 py-1 text-white text-xs flex flex-col justify-between cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto ${
                                    isHighlighted ? 'ring-4 ring-yellow-400' : ''
                                  }`}
                                  style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                  }}
	                                >
	                                  <div className="flex min-w-0 items-center gap-1">
	                                    <span className="rounded bg-white/25 px-1 text-[10px] font-semibold text-white">
	                                      {getRentalTypeBadgeLabel(res.rentalType)}
	                                    </span>
                                      {res.workflowStatus && (
                                        <span className="rounded bg-white/25 px-1 text-[10px] font-semibold text-white">
                                          {getWorkflowStatusLabel(res.workflowStatus, res.workflowStatusLabel)}
                                        </span>
                                      )}
	                                    <span className="min-w-0 truncate font-medium">{res.customer}</span>
	                                  </div>
	                                  {segmentIssueLabel && (
                                    <span className="bg-white/30 px-1 rounded text-[10px]">
                                      {segmentIssueLabel}
                                    </span>
                                  )}
                                </div>
                              );
                            });
                        })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </PageStateBoundary>
        </div>

        {/* 예약 상세 팝업 */}
        {selectedReservation && (
          <div data-testid="reservation-detail-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[700px] max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#1e2939]">
                    {isEditMode ? '예약 수정' : '예약 상세 정보'}
                  </h2>
                  <button
                    onClick={isEditMode ? handleCancelEditMode : closeReservationDetail}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 탭 네비게이션 */}
                <div className={`flex gap-1 mt-4 border-b border-gray-200 ${isEditMode ? 'hidden' : ''}`}>
                  <button
                    onClick={() => setActiveTab('reservation')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'reservation'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4 inline mr-2" />
                    예약 정보
                    {activeTab === 'reservation' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'payment'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    결제 정보
                    {activeTab === 'payment' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('vehicle')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'vehicle'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Car className="w-4 h-4 inline mr-2" />
                    차량 정보
                    {activeTab === 'vehicle' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                </div>

                {isDetailLoading && (
                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    상세 데이터를 불러오는 중입니다.
                  </div>
                )}

                {detailError && (
                  <div className={`mt-4 rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${
                    isDetailNotFound
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{detailError}</span>
                  </div>
                )}
              </div>

              {/* 탭 컨텐츠 */}
              <div className="p-6 flex-1 overflow-y-auto">
                {/* 예약 정보 탭 */}
                {activeTab === 'reservation' && !isEditMode && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">예약번호</label>
                        <p className="text-lg text-gray-900 mt-1 font-bold">{selectedReservation.id}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">고객명</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.customer}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">연락처</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.phone}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">계약 유형</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-slate-100 text-slate-700">
                            {getRentalTypeBadgeLabel(selectedReservation.rentalType)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">진행 상태</label>
                        <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-2 ${
                          selectedReservation.type === 'reservation'
                            ? 'bg-purple-100 text-purple-700'
                            : selectedReservation.type === 'return'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {selectedReservation.type === 'reservation'
                            ? '예약'
                            : selectedReservation.type === 'return'
                              ? '반납'
                              : '대여'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                        <label className="text-xs font-semibold text-blue-700 uppercase">업무 상태</label>
                        <p className="mt-1 text-sm font-bold text-blue-900">
                          {getWorkflowStatusLabel(selectedReservation.workflowStatus, selectedReservation.workflowStatusLabel)}
                        </p>
                      </div>
                      {selectedReservation.closeoutStatus && selectedReservation.closeoutStatus !== 'not_required' && (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <label className="text-xs font-semibold text-emerald-700 uppercase">종료정산</label>
                          <p className="mt-1 text-sm font-bold text-emerald-900">
                            {getCloseoutStatusLabel(selectedReservation.closeoutStatus, selectedReservation.closeoutStatusLabel)}
                          </p>
                        </div>
                      )}
                      {selectedReservation.cancellationSettlementStatus && selectedReservation.cancellationSettlementStatus !== 'not_required' && (
                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                          <label className="text-xs font-semibold text-amber-700 uppercase">취소정산</label>
                          <p className="mt-1 text-sm font-bold text-amber-900">
                            {getCancellationSettlementStatusLabel(
                              selectedReservation.cancellationSettlementStatus,
                              selectedReservation.cancellationSettlementStatusLabel,
                            )}
                          </p>
                        </div>
                      )}
                      {selectedReservation.rentalType === 'long_term' && (
                        <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
                          <label className="text-xs font-semibold text-purple-700 uppercase">장기 상태</label>
                          <p className="mt-1 text-sm font-bold text-purple-900">
                            {getLongTermAccountStatusLabel(
                              selectedReservation.longTermAccountStatus,
                              selectedReservation.longTermAccountStatusLabel,
                            )}
                          </p>
                        </div>
                      )}
                      {selectedReservation.rentalType === 'accident_replacement' && (
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                          <label className="text-xs font-semibold text-sky-700 uppercase">대차 상태</label>
                          <p className="mt-1 text-sm font-bold text-sky-900">
                            {getAccidentReplacementStatusLabel(
                              selectedReservation.accidentReplacementStatus,
                              selectedReservation.accidentReplacementStatusLabel,
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">차량번호</label>
                      <p className="text-lg text-gray-900 mt-1 font-bold">{selectedReservation.vehicleNumber}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">대여 시작일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.startDateFull}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">대여 종료일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.endDateFull}</p>
                      </div>
                    </div>

                    {(activeReservationActionItems.length > 0 || selectedReservation.issues?.length || isActiveActionItemsLoading || activeActionItemsError) && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          이슈
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {isActiveActionItemsLoading && (
                            <span className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">활성 이슈 확인 중</span>
                          )}
                          {activeReservationActionItems.length > 0
                            ? activeReservationActionItems.map((item) => (
                              <span key={item.id} className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                                <span>{item.mainLabel}</span>
                                {item.subLabel && (
                                  <>
                                    <span className="text-red-400">/</span>
                                    <span className="font-semibold">{item.subLabel}</span>
                                  </>
                                )}
                              </span>
                            ))
                            : selectedReservation.issues?.map((issue, idx) => (
                            <span key={idx} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
                              {issue}
                            </span>
                          ))}
                          {activeActionItemsError && (
                            <span className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg font-medium">{activeActionItemsError}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 예약 수정 폼 */}
                {activeTab === 'reservation' && isEditMode && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">예약번호</label>
                        <p className="text-lg text-gray-900 mt-1 font-bold">{selectedReservation.id}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">고객명</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.customer}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">차량 선택</label>
                      <select
                        value={editVin}
                        onChange={(e) => setEditVin(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">차량을 선택하세요</option>
                        {vehicleAssets
                          .filter((a) => a.vin && a.vin !== '-')
                          .map((asset) => (
                            <option key={asset.vin} value={asset.vin}>
                              {asset.vehicleNumber} ({asset.model}) — {asset.vin}
                            </option>
                          ))}
                      </select>
                      {editVin !== (selectedReservation.vin ?? '') && editVin.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          차량이 변경됩니다: {selectedReservation.vehicleNumber} → {vehicleAssets.find((a) => a.vin === editVin)?.vehicleNumber ?? editVin}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">대여 시작일시</label>
                        <input
                          type="datetime-local"
                          value={editStartAt}
                          onChange={(e) => setEditStartAt(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">대여 종료일시</label>
                        <input
                          type="datetime-local"
                          value={editEndAt}
                          onChange={(e) => setEditEndAt(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {editVin !== (selectedReservation.vin ?? '') && editVin.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">변경 사유</label>
                        <textarea
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="차량 변경 사유를 입력하세요 (선택)"
                          maxLength={500}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1 text-right">{editReason.length}/500</p>
                      </div>
                    )}

                    {editSubmitError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{editSubmitError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 결제 정보 탭 */}
                {activeTab === 'payment' && (
                  <div className="space-y-3">
                    {isSelectedReservationLongTerm ? (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">월 렌트료</label>
                          <p className="mt-1 text-xl font-bold text-gray-900">{selectedReservationMonthlyAmountText}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">보증금</label>
                          <p className="mt-1 text-xl font-bold text-gray-900">{selectedReservationDepositText}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">선납금</label>
                          <p className="mt-1 text-xl font-bold text-gray-900">{selectedReservationAdvancePaymentText}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">미수 잔액</label>
                          <p className="mt-1 text-xl font-bold text-red-600">{toCurrencyValue(selectedReservationBillingRemainingAmount)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">대여 요금</label>
                          <p className="text-xl text-gray-900 mt-1 font-bold">{selectedReservation.amount}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">선금</label>
                          <p className="text-xl text-gray-900 mt-1 font-bold">{selectedReservation.deposit}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase">기존 미납 금액</label>
                          <p className="text-xl text-gray-900 mt-1 font-bold">
                            {toCurrencyValue(selectedReservationPrincipalAmount)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">청구/수납 요약</p>
                          <p className="mt-1 text-lg font-bold text-gray-900">{selectedReservationBillingLabel}</p>
                          {isSelectedReservationLongTerm && selectedReservationDefaultPayerType && (
                            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                              기본 청구처:
                              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800">
                                {getPayerTypeLabel(selectedReservationDefaultPayerType)}
                              </span>
                            </span>
                          )}
                        </div>
                        {selectedReservationBillingConfirmationCount > 0 && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            확인 필요 {selectedReservationBillingConfirmationCount}건
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div>
                          <span className="text-xs text-gray-500">총 청구</span>
                          <p className="mt-1 text-sm font-bold text-gray-900">{toCurrencyValue(selectedReservationBillingTotalAmount)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">수납 완료</span>
                          <p className="mt-1 text-sm font-bold text-emerald-700">{toCurrencyValue(selectedReservationBillingPaidAmount)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">잔액</span>
                          <p className="mt-1 text-sm font-bold text-red-600">{toCurrencyValue(selectedReservationBillingRemainingAmount)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">수납/청구 건수</span>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {selectedReservationPaymentRecordCount} / {selectedReservationChargeItemCount}
                          </p>
                        </div>
                      </div>
                      {selectedReservationChargeItems.length > 0 && (
                        <div className="mt-4 rounded-md border border-gray-200">
                          <div className="w-full">
                            <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(104px,0.9fr)_minmax(72px,0.65fr)_minmax(112px,0.9fr)] items-start gap-x-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                              <span>항목</span>
                              <span className="text-right">금액</span>
                              <span className="text-right">상태</span>
                              <span>처리/이력</span>
                            </div>
                            {selectedReservationChargeItems.map((item) => (
                              (() => {
                                const periodLabel = getChargeItemPeriodLabel(item);
                                const isMonthlyCharge = item.chargeType === 'monthly_fee';
                                const payerChangeLabel = getChargeItemPayerChangeLabel(item, selectedReservationDefaultPayerType);
                                return (
                              <div
                                key={item.id}
                                className="grid grid-cols-[minmax(0,2.4fr)_minmax(104px,0.9fr)_minmax(72px,0.65fr)_minmax(112px,0.9fr)] items-start gap-x-3 border-t border-gray-100 px-3 py-3 text-sm text-gray-800"
                              >
                                <span className="min-w-0">
                                  {isMonthlyCharge && periodLabel ? (
                                    <>
                                      <span className="block break-words font-medium leading-5">{periodLabel}</span>
                                      <span className="block break-keep text-xs leading-5 text-gray-500">
                                        {[getChargeTypeLabel(item.chargeType), item.dueDate ? `납부 ${item.dueDate}` : null].filter(Boolean).join(' / ')}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="block break-keep font-medium leading-5">{getChargeTypeLabel(item.chargeType)}</span>
                                      {(periodLabel || item.dueDate) && (
                                        <span className="block break-keep text-xs leading-5 text-gray-500">
                                          {[periodLabel, item.dueDate ? `납부 ${item.dueDate}` : null].filter(Boolean).join(' / ')}
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {payerChangeLabel && (
                                    <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold leading-5 text-amber-700">
                                      <span className="min-w-0 break-words">{payerChangeLabel}</span>
                                    </span>
                                  )}
                                </span>
                                <span className="space-y-1 text-right tabular-nums">
                                  <span className="block whitespace-nowrap font-semibold text-gray-900">{toCurrencyValue(item.amount)}</span>
                                  <span className="block whitespace-nowrap text-xs font-semibold text-red-600">
                                    잔액 {toCurrencyValue(item.remainingAmount)}
                                  </span>
                                </span>
                                <span className="whitespace-nowrap text-right text-gray-600">{getChargeStatusLabel(item.status)}</span>
                                <span className="min-w-0 space-y-1">
                                  {canWritePayments && item.chargeType === 'refund' && item.status === 'refund_due' && (
                                    <span className="flex min-w-0 flex-wrap gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleCompleteRefundChargeItem(item);
                                        }}
                                        disabled={activePaymentRecordMutationId === item.id}
                                        className="whitespace-nowrap rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        환불완료
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleWaiveRefundChargeItem(item);
                                        }}
                                        disabled={activePaymentRecordMutationId === item.id}
                                        className="whitespace-nowrap rounded-md bg-slate-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        환불면제
                                      </button>
                                    </span>
                                  )}
                                  {canWritePayments && item.chargeType !== 'refund' && item.remainingAmount > 0 && !['paid', 'waived', 'refunded', 'disputed'].includes(item.status) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleSettleChargeItem(item);
                                      }}
                                      disabled={activePaymentRecordMutationId === item.id}
                                      className="whitespace-nowrap rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      수납
                                    </button>
                                  )}
                                  {item.changeHistory && item.changeHistory.length > 0 && (
                                    <details className="min-w-0 text-xs text-gray-500">
                                      <summary className="cursor-pointer whitespace-nowrap font-semibold text-gray-600">이력 {item.changeHistory.length}건</summary>
                                      <div className="mt-1 space-y-1">
                                        {item.changeHistory.slice(-3).reverse().map((entry, index) => (
                                          <p key={`${item.id}-history-${index}`} className="break-words rounded bg-gray-50 px-2 py-1 leading-5">
                                            {entry.changedAt ? formatDateTimeKst(entry.changedAt, '-') : '-'} · {entry.changedByName || entry.changedBy || '사용자'} · {entry.action || 'updated'}
                                            {formatBillingChangeSummary(entry.changes) && (
                                              <span className="block text-gray-400">{formatBillingChangeSummary(entry.changes)}</span>
                                            )}
                                          </p>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </span>
                              </div>
                                );
                              })()
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedReservationPaymentRecords.length > 0 && (
                        <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
                          <div className="min-w-[820px]">
                            <div className="grid grid-cols-[0.9fr_0.9fr_0.8fr_1fr_1.2fr_1.1fr] bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                              <span>수납일</span>
                              <span className="text-right">수납액</span>
                              <span>수단</span>
                              <span>확인 상태</span>
                              <span>선택 증빙</span>
                              <span>정정/이력</span>
                            </div>
                            {selectedReservationPaymentRecords.map((record) => (
                              <div
                                key={record.id}
                                className="grid grid-cols-[0.9fr_0.9fr_0.8fr_1fr_1.2fr_1.1fr] border-t border-gray-100 px-3 py-2 text-sm text-gray-800"
                              >
                                <span className="min-w-0 truncate">{record.paidAt ? formatDateKst(record.paidAt, '-') : '-'}</span>
                                <span className="text-right font-semibold">{toCurrencyValue(record.amount)}</span>
                                <span className="min-w-0 truncate text-gray-600">{record.method || '-'}</span>
                                <span className="min-w-0 truncate text-gray-600">{record.status === 'voided' ? 'voided' : record.confirmationStatus}</span>
                                <span className="min-w-0 space-y-1">
                                  {record.evidenceRefs && record.evidenceRefs.length > 0 ? (
                                    record.evidenceRefs.map((evidence) => (
                                      <button
                                        key={evidence.objectName}
                                        type="button"
                                        onClick={() => {
                                          void handleOpenPaymentEvidence(evidence.objectName);
                                        }}
                                        className="block max-w-full truncate text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                                      >
                                        {evidence.fileName || evidence.objectName.split('/').pop() || evidence.objectName}
                                      </button>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">선택 첨부 없음</span>
                                  )}
                                </span>
                                <span className="min-w-0 space-y-1">
                                  {canWritePayments && record.status !== 'voided' && (
                                    <span className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleVoidPaymentRecord(record);
                                        }}
                                        disabled={activePaymentRecordMutationId === record.id}
                                        className="rounded-md bg-slate-700 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        무효
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleCreateRefundChargeItem(record);
                                        }}
                                        disabled={activePaymentRecordMutationId === record.id}
                                        className="rounded-md bg-orange-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        환불예정
                                      </button>
                                    </span>
                                  )}
                                  {record.changeHistory && record.changeHistory.length > 0 && (
                                    <details className="text-xs text-gray-500">
                                      <summary className="cursor-pointer font-semibold text-gray-600">이력 {record.changeHistory.length}건</summary>
                                      <div className="mt-1 space-y-1">
                                        {record.changeHistory.slice(-3).reverse().map((entry, index) => (
                                          <p key={`${record.id}-history-${index}`} className="rounded bg-gray-50 px-2 py-1">
                                            {entry.changedAt ? formatDateTimeKst(entry.changedAt, '-') : '-'} · {entry.changedByName || entry.changedBy || '사용자'} · {entry.action || 'updated'}
                                            {formatBillingChangeSummary(entry.changes) && (
                                              <span className="block text-gray-400">{formatBillingChangeSummary(entry.changes)}</span>
                                            )}
                                          </p>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedReservation.documentChecklist && selectedReservation.documentChecklist.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">문서 상태</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              렌트 유형별 필수/선택 문서
                            </p>
                          </div>
                          <span className="text-xs font-medium text-slate-500">
                            {selectedReservation.documentChecklist.filter((item) => item.required).length}개 필수
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {selectedReservation.documentChecklist.map((item) => {
                            const documentDetails = item.details && item.details.length > 0
                              ? item.details
                              : item.detail
                                ? [item.detail]
                                : [];
                            return (
                              <div key={item.key} className="flex min-h-14 items-start justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900">{item.label}</p>
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {item.required ? '필수 문서' : '선택 문서'}
                                  </p>
                                  {documentDetails.length > 0 && (
                                    <div className="mt-1 space-y-1">
                                      {documentDetails.map((detail, index) => (
                                        <button
                                          key={`${detail.objectName}-${index}`}
                                          type="button"
                                          onClick={() => {
                                            void handleOpenReservationDocument(detail.objectName);
                                          }}
                                          className="block max-w-full truncate text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                                        >
                                          {detail.fileName || detail.objectName.split('/').pop() || detail.objectName}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${reservationDocumentStatusClass(item.status)}`}>
                                  {reservationDocumentStatusLabel(item.status)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedReservation.rentalType === 'accident_replacement' && selectedReservation.accidentClaim && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase text-indigo-700">보험/청구</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                              {selectedReservation.accidentClaim.claimNo || '접수번호 미입력'}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                            {selectedReservation.accidentClaim.claimStatus || 'intake'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div>
                            <span className="text-xs text-indigo-700">보험사</span>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{selectedReservation.accidentClaim.insurerName || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">정비공장</span>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{selectedReservation.accidentClaim.repairShopName || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">청구액</span>
                            <p className="mt-1 text-sm font-bold text-gray-900">{toCurrencyValue(selectedReservation.accidentClaim.billedAmount ?? 0)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">차액</span>
                            <p className="mt-1 text-sm font-bold text-red-600">{toCurrencyValue(selectedReservation.accidentClaim.differenceAmount ?? 0)}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div>
                            <span className="text-xs text-indigo-700">요청자</span>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{selectedReservation.accidentClaim.requesterName || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">피해차량</span>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{selectedReservation.accidentClaim.damagedVehicleNumber || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">문서 상태</span>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{selectedReservation.accidentClaim.documentStatus || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">수리완료일</span>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {formatDateKst(selectedReservation.accidentClaim.repairCompletedAt || selectedReservation.accidentReport?.repairCompletedAt, '-')}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-indigo-700">인정액</span>
                            <p className="mt-1 text-sm font-bold text-emerald-700">{toCurrencyValue(selectedReservation.accidentClaim.recognizedAmount ?? 0)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {!hasSelectedReservationBillingLedger && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">결제 유형</span>
                        {canEditReservationPaymentFields ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={paymentMethodDraft}
                              onChange={(event) => setPaymentMethodDraft(normalizePaymentMethod(event.target.value))}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              aria-label="결제 방법 선택"
                              disabled={isPaymentMethodSaving}
                            >
                              <option value="카드">카드</option>
                              <option value="현금">현금</option>
                              <option value="계좌이체">계좌이체</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                void handleSaveReservationPaymentMethod();
                              }}
                              disabled={isPaymentMethodSaving}
                              className="shrink-0 whitespace-nowrap rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPaymentMethodSaving ? '저장 중...' : '저장'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">
                            {resolveReservationPaymentMethod(selectedReservation, selectedReservationPaymentSync)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">기존 미납 금액</span>
                        <span className="text-sm font-semibold text-gray-900">{toCurrencyValue(selectedReservationPrincipalAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">추가 결제 금액</span>
                        {canEditReservationPaymentFields ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={paymentAmountDraft}
                              onChange={(event) => setPaymentAmountDraft(event.target.value.replace(/[^\d]/g, ''))}
                              className="w-32 rounded-lg border border-amber-300 bg-white px-2 py-1 text-right text-sm font-semibold text-amber-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                              inputMode="numeric"
                              aria-label="추가 결제 금액"
                            />
                            <span className="text-xs font-semibold text-amber-700">원</span>
                            <button
                              type="button"
                              onClick={() => {
                                void handleSaveAdditionalPaymentAmount();
                              }}
                              disabled={isPaymentAmountSaving}
                              className="shrink-0 whitespace-nowrap rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPaymentAmountSaving ? '저장 중...' : '저장'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-amber-700">{toCurrencyValue(selectedReservationAdditionalAmount)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">연체 일수</span>
                        <span className="text-sm font-bold text-red-600">{selectedReservationOverdueDays}일</span>
                      </div>
                      <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between gap-3">
                        <span className="text-base font-bold text-gray-900">총 청구금액</span>
                        <span className="text-lg font-bold text-red-600">{toCurrencyValue(selectedReservationTotalAmount)}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        기존 미납 {toCurrencyValue(selectedReservationPrincipalAmount)} + 추가 결제 {toCurrencyValue(selectedReservationAdditionalAmount)} = 계산 합계 {toCurrencyValue(selectedReservationCalculatedTotalAmount)}
                      </p>
                      {selectedReservationTotalAmountDelta !== 0 && (
                        <p className="text-xs text-amber-700">
                          원장 총액과 계산 합계가 {toCurrencyValue(Math.abs(selectedReservationTotalAmountDelta))} 차이납니다.
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">결제 상태</span>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPaymentStatusColor(selectedReservationPaymentStatus)}`}>
                          {selectedReservationPaymentStatus}
                        </span>
                      </div>
                      {selectedReservationPaymentSync?.status === 'not-found' && selectedReservation.hasPaymentInfo === false && (
                        <p className="text-xs text-amber-700">결제 정보 없음</p>
                      )}
                      {selectedReservationPaymentUpdatedAt && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-500">최근 반영</span>
                          <span className="text-xs text-gray-500">{formatDateTimeKst(selectedReservationPaymentUpdatedAt, '-')}</span>
                        </div>
                      )}
                      {canEditReservationPaymentFields && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => {
                              void handleUpdateReservationPaymentStatus('paid');
                            }}
                            data-testid="reservation-payment-complete-button"
                            disabled={isPaymentCompleting}
                            className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPaymentCompleting ? '처리 중...' : '결제 완료 처리'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleUpdateReservationPaymentStatus('canceled');
                            }}
                            disabled={isPaymentCompleting}
                            className="inline-flex items-center rounded-lg bg-slate-600 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPaymentCompleting ? '처리 중...' : '결제 면제 처리'}
                          </button>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}

                {/* 차량 자산 정보 탭 */}
                {activeTab === 'vehicle' && selectedVehicleAsset && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">차량번호</label>
                        <p className="text-lg text-gray-900 mt-1 font-bold">{selectedVehicleAsset.vehicleNumber}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">모델</label>
                        <p className="text-lg text-gray-900 mt-1 font-medium">{selectedVehicleAsset.model}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">연식</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.year}년</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">차대번호</label>
                        <p className="text-base text-gray-900 mt-1 font-mono">{selectedVehicleAsset.vin}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">차량 상태</label>
                      <p className="mt-2">
                        <span className={`inline-block px-4 py-2 rounded-lg font-medium ${getStatusColor(formatVehicleOperatingStatus(selectedVehicleAsset))}`}>
                          {formatVehicleOperatingStatus(selectedVehicleAsset)}
                        </span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">보험 만료일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.insuranceExpiry}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">다음 점검일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.nextInspection}</p>
                      </div>
                    </div>

                    {selectedVehicleAsset.issues.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          차량 이슈
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedVehicleAsset.issues.map((issue, idx) => (
                            <span key={idx} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
                              {issue}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">소유주</label>
                      <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.owner}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              {isEditMode ? (
                <div className="p-6 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleCancelEditMode}
                    disabled={isEditSubmitting}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    취소
                  </button>
                  <button
                    onClick={() => { void handleSubmitEdit(); }}
                    data-testid="reservation-edit-submit-button"
                    disabled={isEditSubmitting}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isEditSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        저장
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-6 border-t border-gray-200 flex gap-3 flex-wrap">
                  {reservationActionError && (
                    <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{reservationActionError}</span>
                    </div>
                  )}
                  {canWriteReservations && selectedReservation.type !== 'return' && (
                    <button
                      onClick={handleEnterEditMode}
                      data-testid="reservation-edit-button"
                      disabled={activeReservationAction !== null}
                      className="flex-1 min-w-[200px] px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Edit2 className="w-4 h-4" />
                      예약 수정
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!canViewAssets) {
                        navigate('/forbidden');
                        return;
                      }
                      navigate(`/assets?search=${encodeURIComponent(selectedReservation.vehicleNumber)}`);
                    }}
                    disabled={!canViewAssets}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    차량 자산 상세보기
                  </button>
                  <button
                    onClick={() => {
                      if (!canReportAccidentForReservation(selectedReservation)) {
                        return;
                      }
                      setShowAccidentModal(true);
                    }}
                    disabled={!canWriteReservations || !canReportAccidentForReservation(selectedReservation)}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    사고 등록
                  </button>
                  <button
                    onClick={() => {
                      if (!canViewActionRequired) {
                        navigate('/forbidden');
                        return;
                      }
                      navigate(`/action-required?reservationId=${encodeURIComponent(selectedReservation.id)}`);
                    }}
                    disabled={!canViewActionRequired}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    이 차량의 조치항목 보기
                  </button>
                  {selectedReservation.type === 'reservation' && canTransitionReservations && canStartReservationNow(selectedReservation) && (
                    <button
                      onClick={() => {
                        void handleStartReservation();
                      }}
                      data-testid="reservation-start-button"
                      disabled={activeReservationAction !== null}
                      className="flex-1 min-w-[200px] px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {activeReservationAction === 'start' ? '처리 중...' : '차량 인수 처리'}
                    </button>
                  )}
                  {selectedReservation.type === 'reservation' && canTransitionReservations && (
                    <button
                      onClick={() => {
                        void handleCancelReservation();
                      }}
                      data-testid="reservation-cancel-button"
                      disabled={!canTransitionReservations || activeReservationAction !== null}
                      className="flex-1 min-w-[200px] px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {activeReservationAction === 'cancel' ? '처리 중...' : '예약 취소'}
                    </button>
                  )}
                  {selectedReservation.type === 'rental' && (
                    <button
                      onClick={handleReturnClick}
                      data-testid="reservation-return-button"
                      disabled={!canWriteReservations}
                      className="flex-1 min-w-[200px] px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      차량 반납 처리
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 새 계약 등록 모달 */}
        <NewContractModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setDragSelection(null);
          }}
          vehicles={vehicles}
          vehicleAssets={vehicleAssets}
          locationOptions={garageLocationOptions}
          onCreateLocationOption={handleCreateNewContractGarage}
          dragSelection={dragSelection}
          onValidateStepOne={validateNewContractStepOne}
          onSubmit={handleCreateReservation}
        />

        {reservationWarningPrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <p className="whitespace-pre-line text-base font-semibold text-[#1e2939]">{reservationWarningPrompt.message}</p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const resolver = reservationWarningResolverRef.current;
                    reservationWarningResolverRef.current = null;
                    setReservationWarningPrompt(null);
                    resolver?.(reservationWarningPrompt.dismissResult);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {reservationWarningPrompt.cancelLabel}
                </button>
                {reservationWarningPrompt.confirmLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      const resolver = reservationWarningResolverRef.current;
                      reservationWarningResolverRef.current = null;
                      setReservationWarningPrompt(null);
                      resolver?.(true);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {reservationWarningPrompt.confirmLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {dragConflictPrompt && (
          <div data-testid="reservation-drag-conflict-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-full bg-amber-50 p-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1e2939]">중복 예약 구간</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    선택한 기간에 이미 예약이 있어 새 예약을 만들 수 없습니다.
                  </p>
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <p>차량번호: {dragConflictPrompt.vehicleNumber}</p>
                    <p>선택 기간: {dragConflictPrompt.startDateLabel} ~ {dragConflictPrompt.endDateLabel}</p>
                  </div>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
                {dragConflictPrompt.conflicts.map((conflict) => (
                  <div key={conflict.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
                    <p className="text-sm font-semibold text-gray-900">{conflict.customer}</p>
                    <p className="mt-1 text-xs text-gray-600">{conflict.startDateFull} ~ {conflict.endDateFull}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDragConflictPrompt(null)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {showCancelReservationConfirm && selectedReservation && (
          <div data-testid="reservation-cancel-confirm-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-full bg-red-50 p-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1e2939]">예약 취소</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    {selectedReservation.customer}님의 예약을 취소하시겠습니까?
                  </p>
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <p>차량번호: {selectedReservation.vehicleNumber}</p>
                    <p>예약 기간: {selectedReservation.startDateFull} ~ {selectedReservation.endDateFull}</p>
                  </div>
                </div>
              </div>
              {reservationActionError && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {reservationActionError}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelReservationConfirm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={activeReservationAction === 'cancel'}
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelReservation}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={activeReservationAction === 'cancel'}
                >
                  {activeReservationAction === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {activeReservationAction === 'cancel' ? '취소 중...' : '예약 취소'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 반납 확인 모달 */}
        {showReturnConfirm && (
          <div data-testid="reservation-return-confirm-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[400px] max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#1e2939]">
                    {resolvedLateReturnActionItemId
                      ? '반납 지연 이슈 메모'
                      : pendingLateReturnActionItemId
                        ? '반납 지연 이슈 완료'
                        : '차량 반납 확인'}
                  </h2>
                  <button
                    onClick={closeReturnConfirm}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    disabled={isReturnSubmitting || isLateReturnMemoSaving}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {returnSubmitError && (
                  <div data-testid="reservation-return-error" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{returnSubmitError}</span>
                  </div>
                )}

                {resolvedLateReturnActionItemId ? (
                  <>
                    {lateReturnMemoSaveError && (
                      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {lateReturnMemoSaveError}
                      </div>
                    )}
                    {isLateReturnMemoSaved ? (
                      <p className="mb-4 text-sm font-medium text-green-700">메모가 저장되었습니다.</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 mb-4">이슈카드에 추가할 메모가 있으면 남겨주세요.</p>
                        <textarea
                          rows={4}
                          value={lateReturnMemoDraft}
                          onChange={(e) => setLateReturnMemoDraft(e.target.value)}
                          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          placeholder="메모를 입력하세요."
                          disabled={isLateReturnMemoSaving}
                        />
                      </>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={closeReturnConfirm}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        disabled={isLateReturnMemoSaving}
                      >
                        닫기
                      </button>
                      {!isLateReturnMemoSaved && (
                        <button
                          onClick={handleSaveLateReturnMemo}
                          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                          disabled={isLateReturnMemoSaving || !lateReturnMemoDraft.trim()}
                        >
                          {isLateReturnMemoSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isLateReturnMemoSaving ? '저장 중...' : '메모 저장'}
                        </button>
                      )}
                    </div>
                  </>
                ) : pendingLateReturnActionItemId ? (
                  <>
                    <p className="text-sm text-gray-700 mb-4">반납 지연 이슈를 완료하겠습니까?</p>

                    <div className="flex gap-3">
                      <button
                        onClick={handleConfirmLateReturnIssueResolution}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isReturnSubmitting}
                      >
                        {isReturnSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isReturnSubmitting ? '처리 중...' : '예'}
                      </button>
                      <button
                        onClick={closeReturnConfirm}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        disabled={isReturnSubmitting}
                      >
                        아니오
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 mb-4">
                      {`${selectedReservation?.customer}님의 차량(${selectedReservation?.vehicleNumber})을(를) 반납 처리하시겠습니까?`}
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={handleConfirmReturn}
                        data-testid="reservation-return-confirm-button"
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isReturnSubmitting}
                      >
                        {isReturnSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isReturnSubmitting ? '처리 중...' : '예'}
                      </button>
                      <button
                        onClick={closeReturnConfirm}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        disabled={isReturnSubmitting}
                      >
                        아니오
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 사고 등록 모달 */}
        {showAccidentModal && selectedReservation && (
          <AccidentReportModal
            isOpen={showAccidentModal}
            reservationId={selectedReservation.id}
            vehicleNumber={selectedReservation.vehicleNumber}
            customerName={selectedReservation.customer}
            assigneeOptions={accidentAssigneeOptions}
            isAssigneeLoading={isAccidentAssigneeLoading}
            assigneeLoadError={accidentAssigneeLoadError}
            onClose={() => setShowAccidentModal(false)}
            onSubmit={handleAccidentReport}
          />
        )}
      </div>
    </Layout>
  );
}
