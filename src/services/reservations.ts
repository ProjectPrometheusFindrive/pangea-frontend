import { apiClient } from './api';

export interface ReservationsRequestOptions {
  signal?: AbortSignal;
}

export interface GetReservationsListParams extends ReservationsRequestOptions {
  page: number;
  size: number;
  status?: string;
  contractStatus?: string;
  paymentScope?: 'delinquent';
  from?: string;
  to?: string;
  due?: 'pickup' | 'return' | 'overdue';
}

export interface GetReservationDetailOptions extends ReservationsRequestOptions {}

export interface ReservationPartyPayload {
  type?: string;
  source?: string;
  name?: string;
  organizationName?: string;
  contactName?: string;
  phone?: string;
  businessNumber?: string;
  address?: string;
  licenseNumber?: string;
  licenseDocumentObjectName?: string;
  billingAccount?: string;
  insurerName?: string;
  claimNo?: string;
  externalRequestNo?: string;
}

export interface ReservationPartiesPayload {
  contractor?: ReservationPartyPayload;
  driver?: ReservationPartyPayload;
  requester?: ReservationPartyPayload;
  payer?: ReservationPartyPayload;
}

export interface PrepareReservationCreationPayload {
  idempotencyKey?: string;
}

export interface PrepareReservationCreationResponse {
  reservationId?: string;
  idempotencyKey?: string | null;
  existingReservation?: unknown;
}

export interface CreateReservationPayload {
  reservationId?: string;
  idempotencyKey?: string;
  vin: string;
  rentalType?: 'short_term' | 'long_term' | 'accident_replacement';
  creationMode?: 'ui_confirmed' | 'external_intake' | 'migration';
  startAt: string;
  endAt: string;
  contractStatus?: string;
  assetId?: string;
  plate?: string;
  vehicleNumber?: string;
  status?: string;
  parties?: ReservationPartiesPayload;
  payerType?: 'customer' | 'insurer' | 'corporate' | 'repair_shop';
  contractDocumentObjectName?: string;
  contractDocumentType?: 'rental_contract' | 'long_term_contract' | 'payment_schedule' | 'accident_replacement_request';
  initialBilling?: {
    amount?: number;
    deposit?: number;
    chargeType?: string;
    payerType?: 'customer' | 'corporate' | 'insurer' | 'repair_shop';
    status?: string;
    dueDate?: string;
    memo?: string;
    paymentRecord?: {
      amount?: number;
      method?: string;
      payerType?: 'customer' | 'corporate' | 'insurer' | 'repair_shop';
      confirmationStatus?: string;
      depositorName?: string;
      approvalNo?: string;
    };
  };
  billingPlan?: {
    monthlyAmount?: number;
    billingDay?: number;
    billingTiming?: 'prepaid' | 'postpaid';
    cycleMonths?: number;
    graceDays?: number;
    deposit?: number;
    advancePayment?: number;
    payerType?: 'customer' | 'corporate';
  };
  accidentClaim?: {
    requestSource?: string;
    requesterOrganizationName?: string;
    requesterName?: string;
    requesterPhone?: string;
    insurerName?: string;
    claimNo?: string;
    adjusterName?: string;
    adjusterPhone?: string;
    repairShopName?: string;
    repairShopLocation?: string;
    damagedVehicleNumber?: string;
    damagedVehicleModel?: string;
    deliveryLocation?: string;
    billedAmount?: number;
    documentStatus?: string;
    claimStatus?: string;
    approvalRequired?: boolean;
    approvalStatus?: string;
    approvalDocumentObjectName?: string;
  };
  memo?: string;
  pickupLocation?: string;
  returnLocation?: string;
}

export interface ReturnReservationPayload {
  returnedAt?: string;
  memo?: string;
  odometer?: number;
}

export interface TransitionReservationPayload {
  to: '예약중' | '대여중' | '완료';
  reason?: string;
  expectedVersion?: number;
  force?: boolean;
}

export interface PatchReservationPayload {
  vin?: string;
  assetId?: string;
  plate?: string;
  vehicleNumber?: string;
  startAt?: string;
  endAt?: string;
  parties?: ReservationPartiesPayload;
  pickupLocation?: string;
  returnLocation?: string;
  contractDocumentObjectName?: string;
  contractDocumentType?: 'rental_contract' | 'long_term_contract' | 'payment_schedule' | 'accident_replacement_request';
  memo?: string;
  reason?: string;
}

export interface CancelReservationPayload {
  reason?: string;
}

export interface AccidentReportPayload {
  accidentDate: string;
  accidentHour: string;
  accidentMinute: string;
  accidentSecond: string;
  accidentDateTime: string;
  accidentDisplayTime: string;
  blackboxFileName: string;
  blackboxGcsObjectName?: string;
  handlerName?: string;
  recordedAt?: string;
  accidentLocation?: string;
  opponentInfo?: string;
  insuranceClaimNo?: string;
  evidenceStatus?: string;
  accidentEvidenceDocuments?: Record<string, string>;
  insuranceProcessStatus?: string;
  customerChargeAmount?: number;
  customerChargeStatus?: string;
  followupUpdatedAt?: string;
}

export interface ReportReservationAccidentPayload {
  accidentReport: AccidentReportPayload;
  memo?: string;
}

export interface AccidentFollowupPayload {
  accidentLocation?: string;
  opponentInfo?: string;
  insuranceClaimNo?: string;
  evidenceStatus?: string;
  insuranceProcessStatus?: string;
  customerChargeAmount?: number;
  customerChargeStatus?: string;
  memo?: string;
}

function toContractStatus(statusValue?: string): string | undefined {
  if (!statusValue) {
    return undefined;
  }

  const normalized = statusValue.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'reservation' || normalized === '예약' || normalized === '예약중') {
    return '예약중';
  }
  if (normalized === 'rental' || normalized === '대여' || normalized === '대여중') {
    return '대여중';
  }
  if (normalized === 'return' || normalized === '반납' || normalized === '완료' || normalized === '반납완료') {
    return '완료';
  }
  if (normalized === 'overdue' || normalized === '연체' || normalized === 'late') {
    return '대여중';
  }

  return undefined;
}

export function getReservationsList({
  page,
  size,
  status,
  contractStatus,
  paymentScope,
  from,
  to,
  due,
  signal,
}: GetReservationsListParams): Promise<unknown> {
  const normalizedContractStatus = contractStatus ?? toContractStatus(status);

  return apiClient.requestData<unknown>({
    path: '/api/v2/reservations',
    method: 'GET',
    query: {
      page,
      size,
      status,
      contractStatus: normalizedContractStatus,
      paymentScope,
      from,
      to,
      due,
    },
    signal,
  });
}

export function getReservationDetail(
  reservationId: string,
  options: GetReservationDetailOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}`,
    method: 'GET',
    signal: options.signal,
  });
}

export function createReservation(
  payload: CreateReservationPayload,
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/reservations',
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function prepareReservationCreation(
  payload: PrepareReservationCreationPayload = {},
  options: ReservationsRequestOptions = {},
): Promise<PrepareReservationCreationResponse> {
  return apiClient.requestData<PrepareReservationCreationResponse>({
    path: '/api/v2/reservations/prepare',
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function patchReservation(
  reservationId: string,
  payload: PatchReservationPayload,
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}

export function transitionReservation(
  reservationId: string,
  payload: TransitionReservationPayload,
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/transitions`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function returnReservation(
  reservationId: string,
  payload: ReturnReservationPayload,
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/return`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function cancelReservation(
  reservationId: string,
  payload: CancelReservationPayload = {},
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/cancel`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function reportReservationAccident(
  reservationId: string,
  payload: ReportReservationAccidentPayload,
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/accident`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function patchReservationAccidentFollowup(
  reservationId: string,
  payload: AccidentFollowupPayload,
  options: ReservationsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/accident-followup`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}
