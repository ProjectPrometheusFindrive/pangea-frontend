import { apiClient } from './api';

export interface PaymentsRequestOptions {
  signal?: AbortSignal;
}

export interface GetPaymentsListOptions extends PaymentsRequestOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  reservationId?: string;
}

export interface PatchPaymentStatusPayload {
  status: string;
  reservationId?: string;
}

export interface PatchPaymentStatusOptions extends PaymentsRequestOptions {}

export function getPaymentStatusByReservation(
  reservationId: string,
  options: PaymentsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/payments/status',
    method: 'GET',
    query: {
      reservationId,
    },
    signal: options.signal,
  });
}

export function getPaymentById(paymentId: string, options: PaymentsRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/payments/${encodeURIComponent(paymentId)}`,
    method: 'GET',
    signal: options.signal,
  });
}

export function getPaymentsList(options: GetPaymentsListOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/payments',
    method: 'GET',
    query: {
      page: options.page,
      pageSize: options.pageSize,
      status: options.status,
      reservationId: options.reservationId,
    },
    signal: options.signal,
  });
}

export function patchPaymentStatus(
  paymentId: string,
  payload: PatchPaymentStatusPayload,
  options: PatchPaymentStatusOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/payments/${encodeURIComponent(paymentId)}`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}

export function getUnpaidPaymentsSummary(options: PaymentsRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/payments/unpaid-summary',
    method: 'GET',
    signal: options.signal,
  });
}
