import { apiClient } from './api';

export interface ReservationsRequestOptions {
  signal?: AbortSignal;
}

export interface GetReservationsListParams extends ReservationsRequestOptions {
  page: number;
  size: number;
  status?: string;
  contractStatus?: string;
  from?: string;
  to?: string;
  due?: 'pickup' | 'return' | 'overdue';
}

export interface GetReservationDetailOptions extends ReservationsRequestOptions {}

export interface CreateReservationPayload {
  reservationId: string;
  vin: string;
  startAt: string;
  endAt: string;
  contractStatus?: string;
  assetId?: string;
  plate?: string;
  vehicleNumber?: string;
  status?: string;
  customerName?: string;
  phone?: string;
  memo?: string;
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
}

export interface ReportReservationAccidentPayload {
  accidentReport: AccidentReportPayload;
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
