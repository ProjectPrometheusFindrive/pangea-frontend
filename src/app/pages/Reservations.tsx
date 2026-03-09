import { Layout } from '../components/Layout';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Plus, Car, Calendar, AlertCircle, DollarSign, AlertTriangle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  AccidentReportModal,
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
} from './reservationsViewModel';
import {
  isUnpaidPaymentStatus,
  toCanonicalPaymentStatus,
  toReservationPaymentStatus,
  type PaymentStatusSnapshot,
} from '../utils/paymentStatusSync';
import { useAuthorization } from '../context/AuthorizationContext';
import { ACTION_PERMISSIONS, ROUTE_PERMISSIONS } from '../authorization';
import type { VehicleAsset } from '../types/assets';
import type { Reservation } from '../types/reservations';
import { ApiError } from '../../services/api';
import { getAssetsList } from '../../services/assets';
import {
  cancelReservation,
  createReservation,
  getReservationDetail,
  getReservationsList,
  reportReservationAccident,
  returnReservation,
  transitionReservation,
} from '../../services/reservations';

// 드래그 선택 타입 정의
type DragSelection = {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
} | null;
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
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const TOTAL_COUNT_KEYS = ['total', 'totalCount', 'count', 'size', 'itemsCount', 'totalElements'];
const RETRY_TOAST_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

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

function toAccidentDisplayTime(value: Date): string {
  return `${value.getFullYear()}.${pad2(value.getMonth() + 1)}.${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
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
  return mapFieldErrors<NewContractField>(toErrorFieldEntries(error), {
    reservationId: 'selectedVehicle',
    vin: 'selectedVehicle',
    vehicleNumber: 'selectedVehicle',
    plate: 'selectedVehicle',
    startAt: 'startDate',
    endAt: 'endDate',
    customerName: 'customerName',
  });
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

function applySyncedPaymentStatusToReservation(
  reservation: Reservation,
  syncedPaymentStatus: PaymentStatusSnapshot,
): Reservation {
  const nextPaymentStatus = toReservationPaymentStatus(syncedPaymentStatus.status);
  const nextIssues = isUnpaidPaymentStatus(syncedPaymentStatus.status)
    ? withIssueLabel(reservation.issues, '미납/결제 문제')
    : withoutIssueLabel(reservation.issues, '미납/결제 문제');

  return {
    ...reservation,
    paymentStatus: nextPaymentStatus,
    issues: nextIssues,
  };
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

function toStatusQueryValue(filterValue: ViewFilter): string | undefined {
  if (filterValue === 'all' || filterValue === 'unpaid' || filterValue === 'overdue') {
    return undefined;
  }
  return filterValue;
}

function toApiContractStatus(filterValue: ViewFilter): string | undefined {
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
  const accidentReported = row.accidentReported === true || toStringValue(row.accidentReported)?.toLowerCase() === 'true';
  if (accidentReported && !issues.includes('사고 접수')) {
    issues.unshift('사고 접수');
  }

  return {
    id: reservationId,
    vehicleNumber: fallbackVehicleNumber,
    customer,
    startDate: startDateOffset,
    endDate: endDateOffset,
    type: normalizeReservationType(
      toStringValue(row.type) ?? toStringValue(row.contractStatus) ?? toStringValue(row.status),
    ),
    issues,
    phone: (
      toStringValue(row.phone)
      ?? toStringValue(row.customerPhone)
      ?? parseReservationMemoValue(row.memo, 'phone')
      ?? '-'
    ),
    paymentMethod: normalizePaymentMethod(toStringValue(row.paymentMethod) ?? toStringValue(row.paymentType)),
    amount: toCurrencyValue(row.amount),
    deposit: toCurrencyValue(row.deposit),
    paymentStatus: normalizeReservationPaymentStatus(toStringValue(row.paymentStatus)),
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
  const canTransitionReservations = canWriteReservations
    && ['admin', 'super_admin'].includes((user?.role ?? '').trim().toLowerCase());
  const canViewAssets = canAccessRoute(ROUTE_PERMISSIONS.assets);
  const canViewActionRequired = canAccessRoute(ROUTE_PERMISSIONS.actionRequired);
  const page = toPositiveInteger(searchParams.get('page'), DEFAULT_PAGE);
  const pageSize = toPositiveInteger(searchParams.get('size') ?? searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
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
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [vehicleAssets, setVehicleAssets] = useState<VehicleAsset[]>([]);
  const [targetDate, setTargetDate] = useState(() => toDateLabelFromOffset(0));
  const [totalReservationCount, setTotalReservationCount] = useState(0);
  const [pageErrorStatus, setPageErrorStatus] = useState<number | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailNotFound, setIsDetailNotFound] = useState(false);
  const [isReturnSubmitting, setIsReturnSubmitting] = useState(false);
  const [returnSubmitError, setReturnSubmitError] = useState<string | null>(null);
  const [activeReservationAction, setActiveReservationAction] = useState<'start' | 'cancel' | null>(null);
  const [reservationActionError, setReservationActionError] = useState<string | null>(null);

  // 동적 날짜 로딩을 위한 상태
  const [totalDaysToShow, setTotalDaysToShow] = useState(42); // 초기 6주
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const detailRequestSequenceRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection>(null);

  const paymentSyncTargets = useMemo(
    () => buildPaymentSyncTargets(reservationsData),
    [reservationsData],
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

    if (!nextParams.get('page')) {
      nextParams.set('page', String(DEFAULT_PAGE));
    }
    if (!nextParams.get('size')) {
      nextParams.set('size', String(DEFAULT_PAGE_SIZE));
    }

    const nextPage = toPositiveInteger(nextParams.get('page'), DEFAULT_PAGE);
    const nextPageSize = toPositiveInteger(nextParams.get('size'), DEFAULT_PAGE_SIZE);
    nextParams.set('page', String(nextPage));
    nextParams.set('size', String(nextPageSize));

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
    nextParams.delete('pageSize');
    nextParams.delete('search');

    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

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

    const needsNormalization = (
      Boolean(legacyFilter)
      || Boolean(legacyContractStatus)
      || Boolean(legacySearch)
      || Boolean(legacyPageSize && !canonicalSize)
      || Boolean(currentFromDate && normalizedFromDate && currentFromDate !== normalizedFromDate)
      || Boolean(currentToDate && normalizedToDate && currentToDate !== normalizedToDate)
      || Boolean(currentDue && currentDue !== normalizedDue)
      || Boolean(currentPaymentScope && (
        normalizedPaymentScope !== currentPaymentScope
        || !isDelinquentPaymentScopeActive(normalizedStatus, normalizedPaymentScope)
      ))
      || Boolean(canonicalStatus && normalizeViewFilter(canonicalStatus) !== canonicalStatus)
      || Boolean(!searchParams.get('page'))
      || Boolean(!canonicalSize)
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
      const reservationsRequest = getReservationsList({
        page,
        size: pageSize,
        status: toStatusQueryValue(viewFilter),
        contractStatus: toApiContractStatus(viewFilter),
        paymentScope: isDelinquentPaymentScopeActive(viewFilter, paymentScope) ? 'delinquent' : undefined,
        from: fromDate ?? undefined,
        to: toDate ?? undefined,
        due: viewFilter === 'overdue' ? 'overdue' : (dueFilter ?? undefined),
        signal,
      });
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
    setReservationActionError(null);
    setActiveReservationAction(null);
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
      const hasMatchingReservation = filteredReservations.some(res => res.vehicleNumber === vehicleNumber);
      if (!hasMatchingReservation) {
        return false;
      }
    }
    
    return matchesModel && matchesSearch;
  });

  const getBlockColor = (reservation: Reservation) => {
    const endDate = toDateFromOffset(reservation.endDate);
    
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

  const openReservationDetail = useCallback((reservation: Reservation) => {
    setSelectedReservation(reservation);
    const asset = vehicleAssets.find((entry) => entry.vehicleNumber === reservation.vehicleNumber);
    setSelectedVehicleAsset(asset ?? createReservationFallbackVehicleAsset(reservation));
    setActiveTab('reservation');
    setShowReturnConfirm(false);
    setIsReturnSubmitting(false);
    setReturnSubmitError(null);
    setReservationActionError(null);
    setActiveReservationAction(null);
    void hydrateReservationDetail(reservation.id, reservation);
  }, [hydrateReservationDetail, vehicleAssets]);

  const refreshReservationsAfterMutation = useCallback((warningMessage: string) => {
    void hydrateReservationsData().catch(() => {
      toast.error(warningMessage);
    });
  }, [hydrateReservationsData]);

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

    const reservationId = `R-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const startDateOffset = toDateOffset(startAt) ?? 0;
    const endDateOffset = toDateOffset(endAt) ?? startDateOffset;
    const fallbackReservation: Reservation = {
      id: reservationId,
      vehicleNumber: formValues.selectedVehicle,
      customer: formValues.customerName.trim(),
      startDate: Math.min(startDateOffset, endDateOffset),
      endDate: Math.max(startDateOffset, endDateOffset),
      type: 'reservation',
      issues: [],
      phone: formValues.customerPhone.trim(),
      paymentMethod: formValues.paymentMethod,
      amount: toCurrencyDisplayFromInput(formValues.amount),
      deposit: toCurrencyDisplayFromInput(formValues.deposit),
      paymentStatus: formValues.paymentStatus,
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
  }, [canWriteReservations, hydrateReservationsData, openReservationDetail, vehicleAssets]);

  const handleStartReservation = useCallback(async () => {
    if (!canTransitionReservations) {
      setReservationActionError('대여 시작 처리 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (!selectedReservation || selectedReservation.type !== 'reservation' || activeReservationAction) {
      return;
    }

    setActiveReservationAction('start');
    setReservationActionError(null);

    try {
      const payload = await transitionReservation(selectedReservation.id, {
        to: '대여중',
        reason: '차량 인수 처리',
      });
      const fallbackReservation: Reservation = {
        ...selectedReservation,
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
    selectedReservation,
    vehicleAssets,
  ]);

  const handleCancelReservation = useCallback(async () => {
    if (!canWriteReservations) {
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
    canWriteReservations,
    closeReservationDetail,
    hydrateReservationDetail,
    refreshReservationsAfterMutation,
    selectedReservation,
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

    setIsReturnSubmitting(true);
    setReturnSubmitError(null);

    try {
      const payload = await returnReservation(selectedReservation.id, {
        returnedAt: new Date().toISOString(),
      });
      const fallbackReservation: Reservation = {
        ...selectedReservation,
        type: 'return',
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

      setShowReturnConfirm(false);
      await hydrateReservationsData();
      void hydrateReservationDetail(updatedReservation.id, updatedReservation);
      toast.success('차량이 반납 처리되었습니다.');
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
  }, [canWriteReservations, hydrateReservationDetail, hydrateReservationsData, isReturnSubmitting, selectedReservation, vehicleAssets]);

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
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    viewFilter === 'reservation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  예약
                </button>
                <button
                  onClick={() => handleViewFilterChange('rental')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    viewFilter === 'rental'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  대여
                </button>
                <button
                  onClick={() => handleViewFilterChange('return')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    viewFilter === 'return'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  반납
                </button>
                <button
                  onClick={() => handleViewFilterChange('unpaid')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    viewFilter === 'unpaid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  미납
                </button>
                <button
                  onClick={() => handleViewFilterChange('overdue')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    viewFilter === 'overdue'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  연체
                </button>
              </div>

              <div className="ml-2 flex items-center gap-1">
                <label className="text-xs text-gray-600">기간:</label>
                <input
                  type="date"
                  value={fromDate ?? ''}
                  onChange={(event) => handleFromDateChange(event.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">~</span>
                <input
                  type="date"
                  value={toDate ?? ''}
                  onChange={(event) => handleToDateChange(event.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-600">
              현재 페이지 <span className="font-semibold text-blue-700">{reservationsData.length}</span>건 ·
              {' '}
              서버 집계 <span className="font-semibold text-blue-700">{totalReservationCount}</span>건
            </span>
            <div className="flex items-center gap-2">
              <select
                value={String(pageSize)}
                onChange={(event) => {
                  const nextSize = Number(event.target.value);
                  handlePageSizeChange(Number.isFinite(nextSize) && nextSize > 0 ? nextSize : DEFAULT_PAGE_SIZE);
                }}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}개
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={!hasPrevPage || isPageLoading}
                className="px-2 py-1 text-xs rounded-md border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-xs text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNextPage || isPageLoading}
                className="px-2 py-1 text-xs rounded-md border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>

          {(paymentSyncError || isPaymentSyncing) && (
            <div className={`mt-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
              paymentSyncError
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}>
              <span>
                {paymentSyncError
                  ? (
                    isPaymentSyncUsingLastKnown
                      ? '결제 상태 동기화에 실패해 마지막 정상 상태를 표시 중입니다.'
                      : paymentSyncError
                  )
                  : '결제 상태를 동기화하는 중입니다.'}
              </span>
              {paymentSyncError && (
                <button
                  type="button"
                  onClick={retryPaymentSync}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                >
                  다시 시도
                </button>
              )}
            </div>
          )}
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

            <div className="flex-1" />
            
            <span className="text-xs text-blue-700 font-semibold">
              {toDateFromOffset(currentWeekStart).toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} ~
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
                {filteredVehicles.map((vehicle, vIndex) => (
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
                        const hasConflict = filteredReservations.some(res =>
                          res.vehicleNumber === vehicle &&
                          cellDate >= res.startDate &&
                          cellDate <= res.endDate
                        );

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
                                const conflicts = filteredReservations.filter(res =>
                                  res.vehicleNumber === vehicle &&
                                  !(endDate < res.startDate || startDate > res.endDate)
                                );

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
                      {filteredReservations
                        .filter(res => res.vehicleNumber === vehicle)
                        .filter(res => {
                          // 현재 보이는 범위와 겹치는 예약만 표시
                          const viewEnd = currentWeekStart + totalDaysToShow - 1;
                          return !(res.endDate < currentWeekStart || res.startDate > viewEnd);
                        })
                        .map(res => {
                          // 블록의 시작 위치 계산 (현재 뷰 기준)
                          const blockStart = Math.max(res.startDate, currentWeekStart);
                          const blockEnd = Math.min(res.endDate, currentWeekStart + totalDaysToShow - 1);
                          const startIndex = blockStart - currentWeekStart;
                          const duration = blockEnd - blockStart + 1;

                          // 셀 너비 계산
                          const cellWidth = 100 / totalDaysToShow;
                          const left = startIndex * cellWidth;
                          const width = duration * cellWidth;

                          const isHighlighted = searchQuery && res.customer.includes(searchQuery);

                          return (
                            <div
                              key={res.id}
                              onClick={() => handleReservationClick(res)}
                              data-testid={`reservation-block-${res.id}`}
                              className={`absolute top-1.5 h-11 ${getBlockColor(res)} rounded px-2 py-1 text-white text-xs flex flex-col justify-between cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto ${
                                isHighlighted ? 'ring-4 ring-yellow-400' : ''
                              }`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                            >
                              <span className="font-medium truncate">{res.customer}</span>
                              {res.issues && res.issues.length > 0 && (
                                <span className="bg-white/30 px-1 rounded text-[10px]">
                                  {res.issues[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PageStateBoundary>
        </div>

        {/* 범례 */}
        <div className="flex gap-4 mt-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-xs text-gray-600">예약</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-xs text-gray-600">대여중</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span className="text-xs text-gray-600">반납 완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-xs text-gray-600">미납</span>
          </div>
        </div>

        {/* 예약 상세 팝업 */}
        {selectedReservation && (
          <div data-testid="reservation-detail-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[700px] max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#1e2939]">예약 상세 정보</h2>
                  <button
                    onClick={closeReservationDetail}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex gap-1 mt-4 border-b border-gray-200">
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
                {activeTab === 'reservation' && (
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

                {/* 결제 정보 탭 */}
                {activeTab === 'payment' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">대여 요금</label>
                        <p className="text-2xl text-gray-900 mt-1 font-bold">{selectedReservation.amount}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">선금</label>
                        <p className="text-2xl text-gray-900 mt-1 font-bold">{selectedReservation.deposit}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">결제 방법</label>
                      <p className="text-lg text-gray-900 mt-1">{selectedReservation.paymentMethod}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">결제 상태</label>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPaymentStatusColor(selectedReservation.paymentStatus)}`}>
                          {selectedReservation.paymentStatus}
                        </span>
                        {selectedReservationPaymentSync?.status === 'not-found' && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                            결제 정보 없음
                          </span>
                        )}
                      </div>
                      {selectedReservationPaymentSync?.updatedAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          최근 반영: {new Date(selectedReservationPaymentSync.updatedAt).toLocaleString('ko-KR')}
                        </p>
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
              <div className="p-6 border-t border-gray-200 flex gap-3 flex-wrap">
                {reservationActionError && (
                  <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{reservationActionError}</span>
                  </div>
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
                  onClick={() => setShowAccidentModal(true)}
                  disabled={!canWriteReservations}
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
                {selectedReservation.type === 'reservation' && canTransitionReservations && (
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
                {selectedReservation.type === 'reservation' && (
                  <button
                    onClick={() => {
                      void handleCancelReservation();
                    }}
                    data-testid="reservation-cancel-button"
                    disabled={!canWriteReservations || activeReservationAction !== null}
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
          dragSelection={dragSelection}
          onSubmit={handleCreateReservation}
        />

        {/* 반납 확인 모달 */}
        {showReturnConfirm && (
          <div data-testid="reservation-return-confirm-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[400px] max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#1e2939]">차량 반납 확인</h2>
                  <button
                    onClick={() => {
                      setShowReturnConfirm(false);
                      setReturnSubmitError(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    disabled={isReturnSubmitting}
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

                <p className="text-sm text-gray-700 mb-4">
                  {selectedReservation?.customer}님의 차량({selectedReservation?.vehicleNumber})을(를) 반납 처리하시겠습니까?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmReturn}
                    data-testid="reservation-return-confirm-button"
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={isReturnSubmitting}
                  >
                    {isReturnSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isReturnSubmitting ? '처리 중...' : '확인'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReturnConfirm(false);
                      setReturnSubmitError(null);
                    }}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    disabled={isReturnSubmitting}
                  >
                    취소
                  </button>
                </div>
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
            onClose={() => setShowAccidentModal(false)}
            onSubmit={handleAccidentReport}
          />
        )}
      </div>
    </Layout>
  );
}
