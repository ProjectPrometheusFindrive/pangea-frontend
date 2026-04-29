import { Layout } from '../components/Layout';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Plus, Car, Calendar, AlertCircle, DollarSign, AlertTriangle, Loader2, RefreshCw, X, Edit2, Save, ArrowLeft } from 'lucide-react';
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
import type { VehicleAsset } from '../types/assets';
import type { Reservation } from '../types/reservations';
import { ApiError } from '../../services/api';
import { getAssetsList } from '../../services/assets';
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
  reportReservationAccident,
  returnReservation,
  transitionReservation,
} from '../../services/reservations';
import { listSettingsGarages, listSettingsMembers, type SettingsMember } from '../../services/settings';

// 드래그 선택 타입 정의
type DragSelection = {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
} | null;
type ReservationWarningPrompt = {
  message: string;
  confirmLabel?: string;
  cancelLabel: string;
  dismissResult: boolean;
};
type ViewFilter = 'all' | 'reservation' | 'rental' | 'return' | 'unpaid' | 'overdue';
type PaymentScope = 'all' | 'delinquent';
type DueFilter = 'pickup' | 'return' | null;

function createTodayBaseDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const CALENDAR_BASE_DATE = createTodayBaseDate();
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const ASSET_FALLBACK_PAGE_SIZE = 500;
const TOTAL_COUNT_KEYS = ['total', 'totalCount', 'count', 'size', 'itemsCount', 'totalElements'];
const RETRY_TOAST_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const ACTIVE_ACTION_STATUS_QUERY = 'open,in_progress';
const EXPIRED_INSURANCE_PICKUP_MESSAGE = '현재 보험 만료 상태로 차량 인수가 불가능합니다.\n보험 만료 이후에 운행을 할 경우 행정처분(과태료, 영업정지)과 형사처벌을 받을 수 있으며 사고 발생시 보험처리가 불가합니다.';
const INSPECTION_PICKUP_FORCE_MESSAGE = '예약 기간내에 정기점검 만료일자가 있습니다.\n수검 가능 기간을 넘기면 과태료(4만원 + 3일당 2만원)가 발생하며, 사고 발생시 보험 처리에 불리합니다.';
const INSPECTION_PICKUP_NOTICE_MESSAGE = '예약 종료 후 수검 만료기간까지 {days}일입니다. \n반납 지연 및 대여 연장 발생시 주의해주세요.';

type FieldErrorMap<TField extends string> = Partial<Record<TField, string>>;
type ReservationsHydrationPayload = {
  reservationsPayload: unknown;
  assetPayload?: unknown;
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
    : withoutIssueLabel(reservation.issues, '미납/결제 문제');

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
    issues: withoutIssueLabel(reservation.issues, '미납/결제 문제'),
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
    searchQuery: string;
  },
): boolean {
  const { viewFilter, paymentScope, searchQuery } = options;

  if (viewFilter === 'unpaid' && !isDelinquentPaymentScopeActive(viewFilter, paymentScope) && !(reservation.issues && reservation.issues.includes('미납/결제 문제'))) {
    return false;
  }
  if (!searchQuery) {
    return true;
  }
  return reservation.customer.includes(searchQuery) || reservation.vehicleNumber.includes(searchQuery);
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

  const customer = toStringValue(row.customerName) ?? toStringValue(row.customer) ?? toStringValue(row.userName) ?? '고객 미확인';
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

  const paymentMethodSource = toStringValue(row.paymentMethod)
    ?? toStringValue(row.paymentType)
    ?? parseReservationMemoValue(row.memo, 'paymentMethod');
  const paymentStatusSource = toStringValue(row.paymentStatus)
    ?? parseReservationMemoValue(row.memo, 'paymentStatus');
  const hasPaymentInfo = (
    paymentMethodSource !== null
    || paymentStatusSource !== null
    || toCurrencyNumberValue(row.amount) !== null
    || toCurrencyNumberValue(row.deposit) !== null
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
    type: normalizeReservationType(contractStatus ?? toStringValue(row.type) ?? toStringValue(row.status)),
    issues,
    phone: (
      toStringValue(row.phone)
      ?? toStringValue(row.customerPhone)
      ?? parseReservationMemoValue(row.memo, 'phone')
      ?? '-'
    ),
    paymentMethod: normalizePaymentMethod(paymentMethodSource),
    amount: toCurrencyValue(row.amount),
    deposit: toCurrencyValue(row.deposit),
    paymentStatus: normalizeReservationPaymentStatus(paymentStatusSource),
    hasPaymentInfo: hasPaymentInfo || Boolean(paymentInfo),
    additionalPaymentAmount: additionalPaymentAmount ?? undefined,
    paymentInfo,
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

  const [currentWeekStart, setCurrentWeekStart] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedVehicleAsset, setSelectedVehicleAsset] = useState<VehicleAsset | null>(null);
  const [modelFilter, setModelFilter] = useState('all');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'reservation' | 'payment' | 'vehicle'>('reservation');
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showAccidentModal, setShowAccidentModal] = useState(false);
  const [accidentAssigneeOptions, setAccidentAssigneeOptions] = useState<AccidentReportAssigneeOption[]>([]);
  const [isAccidentAssigneeLoading, setIsAccidentAssigneeLoading] = useState(false);
  const [accidentAssigneeLoadError, setAccidentAssigneeLoadError] = useState<string | null>(null);
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [vehicleAssets, setVehicleAssets] = useState<VehicleAsset[]>([]);
  const [garageLocationOptions, setGarageLocationOptions] = useState<string[]>([]);
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
  const [activeReservationAction, setActiveReservationAction] = useState<'start' | 'cancel' | null>(null);
  const [reservationActionError, setReservationActionError] = useState<string | null>(null);
  const [reservationWarningPrompt, setReservationWarningPrompt] = useState<ReservationWarningPrompt | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editVin, setEditVin] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

  // 동적 날짜 로딩을 위한 상태
  const [totalDaysToShow, setTotalDaysToShow] = useState(42); // 초기 6주
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const detailRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);
  const reservationWarningResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection>(null);

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

    nextParams.delete('filter');
    nextParams.delete('contractStatus');
    nextParams.delete('page');
    nextParams.delete('size');
    nextParams.delete('pageSize');
    nextParams.delete('search');

    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

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
    const legacyFilter = searchParams.get('filter');
    const legacyContractStatus = searchParams.get('contractStatus');
    const legacySearch = searchParams.get('search');
    const canonicalStatus = searchParams.get('status');
    const canonicalQ = searchParams.get('q');
    const canonicalSize = searchParams.get('size');
    const legacyPageSize = searchParams.get('pageSize');
    const currentDue = searchParams.get('due');
    const normalizedDue = normalizeDueFilter(currentDue);
    const currentPaymentScope = searchParams.get('paymentScope');
    const normalizedPaymentScope = normalizePaymentScope(currentPaymentScope);
    const normalizedFromDate = normalizeDateParam(searchParams.get('from'));
    const normalizedToDate = normalizeDateParam(searchParams.get('to'));
    const currentFromDate = searchParams.get('from');
    const currentToDate = searchParams.get('to');
    const normalizedStatus = normalizeViewFilter(canonicalStatus ?? legacyFilter ?? legacyContractStatus);
    const shouldNormalizeStatus = normalizedStatus !== 'all';

    const currentPage = searchParams.get('page');
    const needsNormalization = (
      Boolean(legacyFilter)
      || Boolean(legacyContractStatus)
      || Boolean(legacySearch)
      || Boolean(canonicalSize)
      || Boolean(legacyPageSize)
      || Boolean(currentFromDate && normalizedFromDate && currentFromDate !== normalizedFromDate)
      || Boolean(currentToDate && normalizedToDate && currentToDate !== normalizedToDate)
      || Boolean(currentDue && currentDue !== normalizedDue)
      || Boolean(currentPaymentScope && (
        normalizedPaymentScope !== currentPaymentScope
        || !isDelinquentPaymentScopeActive(normalizedStatus, normalizedPaymentScope)
      ))
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

      if (legacySearch && !canonicalQ) {
        params.set('q', legacySearch);
      }
      if (legacyPageSize && !canonicalSize) {
        params.set('size', legacyPageSize);
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
    }, true);
  }, [searchParams, updateReservationSearchParams]);

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
        const mergedReservationRows: unknown[] = [];
        let nextPage = DEFAULT_PAGE;
        let totalCount = 0;

        while (true) {
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          const payload = await getReservationsList({
            page: nextPage,
            size: pageSize,
            status: toStatusQueryValue(viewFilter, dueFilter),
            contractStatus: toApiContractStatus(viewFilter, dueFilter),
            paymentScope: isDelinquentPaymentScopeActive(viewFilter, paymentScope) ? 'delinquent' : undefined,
            from: fromDate ?? undefined,
            to: toDate ?? undefined,
            due: viewFilter === 'overdue' ? 'overdue' : (dueFilter ?? undefined),
            signal,
          });

          const pageRows = getCollectionFromPayload(payload, ['reservations', 'items', 'rows', 'list']) ?? [];
          mergedReservationRows.push(...pageRows);
          totalCount = Math.max(totalCount, toTotalCount(payload, mergedReservationRows.length));

          if (pageRows.length === 0 || mergedReservationRows.length >= totalCount || pageRows.length < pageSize) {
            return {
              ...(isRecord(payload) ? payload : {}),
              items: mergedReservationRows,
              total: totalCount || mergedReservationRows.length,
              page: DEFAULT_PAGE,
              size: pageSize,
            };
          }

          nextPage += 1;
        }
      })();
      const assetRequest = canViewAssets
        ? getAssetsList({
          page: 1,
          size: ASSET_FALLBACK_PAGE_SIZE,
          signal,
        }).catch(() => undefined)
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
  }, [canViewAssets, dueFilter, fromDate, page, pageSize, paymentScope, toDate, viewFilter]);

  const handleReservationsSuccess = useCallback((payload: ReservationsHydrationPayload) => {
    const reservationRows = toReservationRows(payload.reservationsPayload);
    const vehicleRows = mergeVehicleRows(payload.assetPayload ?? payload.reservationsPayload, reservationRows);

    setReservationsData(reservationRows);
    setVehicleAssets(vehicleRows);
    setTotalReservationCount(toTotalCount(payload.reservationsPayload, reservationRows.length));
    setPageErrorStatus(null);
  }, []);

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
    void hydrateReservationsData();
  }, [hydrateReservationsData]);

  useEffect(() => {
    listSettingsGarages().then((payload) => {
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        setGarageLocationOptions(payload.items.map((g) => g.name));
      }
    }).catch(() => {
      // garage loading is best-effort; fall back to free-text input
    });
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
    setTargetDate(toDateLabelFromOffset(currentWeekStart));
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
    updateReservationSearchParams((params) => {
      params.delete('status');
      params.delete('from');
      params.delete('to');
      params.delete('q');
      params.delete('due');
      params.delete('paymentScope');
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
    } finally {
      if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  }, [vehicleAssets]);

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
  const vehicles = vehicleAssets.map(v => v.vehicleNumber);
  
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
  const uniqueModels = Array.from(new Set(vehicleAssets.map(v => v.model))).sort();

  // 먼저 예약 필터링 (상태 필터 + 검색어 적용)
  const filteredReservations = reservations.filter((reservation) => matchesReservationFilters(reservation, {
    viewFilter,
    paymentScope,
    searchQuery,
  }));
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

  const totalPages = Math.max(1, Math.ceil((totalReservationCount || 0) / pageSize));
  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;
  const pageErrorActionLabel = pageErrorStatus === 400 ? '조건 초기화' : getPageErrorActionLabel(pageErrorKind);
  const pageErrorDescription = pageErrorStatus === 400
    ? '기간 또는 필터 조건이 올바르지 않습니다. 기간을 확인하거나 필터를 초기화해 주세요.'
    : '예약 캘린더 데이터를 불러오는 중 문제가 발생했습니다.';

  // 차량 필터링 로직 (차종 + 상태 필터 AND 조건)
  const filteredVehicles = vehicles.filter(vehicleNumber => {
    const asset = vehicleAssets.find(a => a.vehicleNumber === vehicleNumber);
    
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
  });

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
    if (reservation.issues && reservation.issues.includes('미납/결제 문제')) {
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
      case '예약':
      case '예약됨':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
  const canEditReservationPaymentFields = selectedReservation
    ? canWritePayments && canManageReservationPaymentIssue(selectedReservation, selectedReservationPaymentSync)
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

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return {
        formError: '반납 일시는 픽업 일시보다 빠를 수 없습니다.',
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

    const reservationId = `R-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const startDateOffset = toDateOffset(startAt) ?? 0;
    const endDateOffset = toDateOffset(endAt) ?? startDateOffset;
    const fallbackAmount = toCurrencyNumberFromInput(formValues.amount);
    const fallbackDeposit = toCurrencyNumberFromInput(formValues.deposit);
    const fallbackReservation: Reservation = {
      id: reservationId,
      vehicleNumber: formValues.selectedVehicle,
      customer: formValues.customerName.trim(),
      startDate: Math.min(startDateOffset, endDateOffset),
      endDate: Math.max(startDateOffset, endDateOffset),
      scheduledStartAt: startAt,
      contractStatus: '예약중',
      type: 'reservation',
      issues: [],
      phone: formValues.customerPhone.trim(),
      paymentMethod: formValues.paymentMethod,
      amount: toCurrencyDisplayFromInput(formValues.amount),
      deposit: toCurrencyDisplayFromInput(formValues.deposit),
      paymentStatus: formValues.paymentStatus,
      hasPaymentInfo: true,
      additionalPaymentAmount: Math.max(fallbackAmount - fallbackDeposit, 0),
      startDateFull: formValues.startDate,
      endDateFull: formValues.endDate,
    };

    try {
      const payload = await createReservation({
        reservationId,
        vin,
        startAt,
        endAt,
        contractStatus: '예약중',
        vehicleNumber: formValues.selectedVehicle,
        plate: formValues.selectedVehicle,
        customerName: formValues.customerName.trim(),
        phone: formValues.customerPhone.trim(),
        licenseNumber: formValues.customerLicense.trim() || undefined,
        address: formValues.customerAddress.trim() || undefined,
        paymentMethod: formValues.paymentMethod,
        paymentStatus: formValues.paymentStatus,
        amount: fallbackAmount,
        deposit: fallbackDeposit,
        pickupLocation: formValues.pickupLocation.trim() || undefined,
        returnLocation: formValues.returnLocation.trim() || undefined,
        memo: [
          `pickup=${formValues.pickupLocation.trim()}`,
          `return=${formValues.returnLocation.trim()}`,
          `paymentMethod=${formValues.paymentMethod}`,
          `paymentStatus=${formValues.paymentStatus}`,
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
    hydrateReservationDetail,
    isPaymentMethodSaving,
    paymentMethodDraft,
    refreshReservationsAfterMutation,
    selectedReservation,
    selectedReservationPaymentSync,
  ]);

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

    const confirmed = window.confirm(
      `${selectedReservation.customer}님의 예약을 취소하시겠습니까?\n\n차량번호: ${selectedReservation.vehicleNumber}\n예약 기간: ${selectedReservation.startDateFull} ~ ${selectedReservation.endDateFull}`,
    );
    if (!confirmed) {
      return;
    }

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
    const blackboxGcsObjectName = `rentals/${selectedReservation.id}/blackbox/${blackboxFileName}`;

    try {
      const payload = await reportReservationAccident(selectedReservation.id, {
        accidentReport: {
          accidentDate,
          accidentHour,
          accidentMinute,
          accidentSecond,
          accidentDateTime,
          accidentDisplayTime,
          blackboxFileName,
          blackboxGcsObjectName,
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
        navigate('/action-required?filter=사고 접수');
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
                if (!canWriteReservations) {
                  toast.error('예약 생성 권한이 없습니다.');
                  return;
                }
                setShowModal(true);
              }}
              data-testid="reservation-new-contract-button"
              disabled={!canWriteReservations}
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
              onClick={() => setCurrentWeekStart(0)}
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
                    setCurrentWeekStart(diffDays);
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
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
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

            <div className="flex-1" />
            
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              💡 캘린더에서 드래그하여 예약을 생성하세요
            </span>
            
            <span className="text-xs text-gray-500">
              총 <span className="font-semibold text-blue-600">{filteredVehicles.length}</span>대 표시 중
            </span>
          </div>
          
          {/* 가로 스크롤 가능한 컨테이너 */}
          <PageStateBoundary
            isLoading={isPageLoading}
            error={pageError}
            isEmpty={!isPageLoading && !pageError && filteredVehicles.length === 0}
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
                        const hasConflict = vehicleReservations.some((res) => {
                          const occupiedEndDate = getReservationOccupiedEndDate(res);
                          return cellDate >= res.startDate && cellDate <= occupiedEndDate;
                        });

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
                                  alert(`선택한 기간에 이미 예약이 있습니다.\\n\\n${conflicts.map(c => `${c.customer}: ${c.startDateFull} ~ ${c.endDateFull}`).join('\\n')}`);
                                } else {
                                  if (!canWriteReservations) {
                                    toast.error('예약 생성 권한이 없습니다.');
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
                                  <span className="font-medium truncate">{res.customer}</span>
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
                        <label className="text-xs font-semibold text-gray-500 uppercase">예약 유형</label>
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

                    {selectedReservation.issues && selectedReservation.issues.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          이슈
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedReservation.issues.map((issue, idx) => (
                            <span key={idx} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
                              {issue}
                            </span>
                          ))}
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
                        <span className={`inline-block px-4 py-2 rounded-lg font-medium ${getStatusColor(selectedVehicleAsset.status)}`}>
                          {selectedVehicleAsset.status}
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
                      navigate(`/action-required?search=${encodeURIComponent(selectedReservation.vehicleNumber)}`);
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
          dragSelection={dragSelection}
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
