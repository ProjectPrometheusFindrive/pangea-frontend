import { apiClient } from './api';

export interface BillingRequestOptions {
  signal?: AbortSignal;
}

export interface BillingLedgerRequestParams extends BillingRequestOptions {
  from?: string;
  to?: string;
  reservationId?: string;
  vehicleNumber?: string;
  rentalType?: string;
  payerType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ChargeItemPayload {
  amount: number;
  chargeType?: string;
  payerType?: string;
  status?: string;
  dueDate?: string;
  memo?: string;
  adjustmentReason?: string;
}

export interface PatchChargeItemPayload {
  amount?: number;
  paidAmount?: number;
  status?: string;
  memo?: string;
  adjustmentReason?: string;
  refundCompletedAt?: string;
  refundMethod?: string;
  refundReason?: string;
  evidenceRefs?: PaymentEvidenceRef[];
}

export interface PaymentRecordPayload {
  amount: number;
  method?: string;
  payerType?: string;
  paidAt?: string;
  confirmationStatus?: string;
  depositorName?: string;
  approvalNo?: string;
  allocations?: Array<{
    chargeItemId: string;
    amount: number;
  }>;
  evidenceRefs?: PaymentEvidenceRef[];
  memo?: string;
}

export interface PaymentEvidenceRef {
  objectName: string;
  fileName?: string;
  contentType?: string;
  attachedAt?: string;
  attachedByName?: string;
}

export interface BillingChangeHistoryEntry {
  action?: string;
  changedAt?: string;
  changedByName?: string;
  changedBy?: string;
  changes?: Record<string, { from?: unknown; to?: unknown }>;
}

export interface BillingLedgerEntry {
  entryType: 'charge' | 'payment' | string;
  id: string;
  reservationId?: string;
  vehicleNumber?: string;
  rentalType?: string;
  payerType?: string;
  eventDate?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status?: string;
  method?: string | null;
  memo?: string | null;
}

export interface BillingLedgerTotals {
  chargeAmount: number;
  paymentAmount: number;
  remainingAmount: number;
  chargeCount: number;
  paymentCount: number;
}

export interface BillingLedgerResponse {
  items: BillingLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totals: BillingLedgerTotals;
}

export interface UploadDownloadUrlResponse {
  downloadUrl: string;
  objectName: string;
  expiresIn: number;
}

export interface PatchPaymentRecordPayload {
  amount?: number;
  method?: string;
  payerType?: string;
  paidAt?: string;
  confirmationStatus?: string;
  depositorName?: string;
  approvalNo?: string;
  allocations?: Array<{
    chargeItemId: string;
    amount: number;
  }>;
  evidenceRefs?: PaymentEvidenceRef[];
  status?: 'active' | 'voided' | 'refunded' | 'adjusted';
  memo?: string;
}

export interface AllocatePaymentRecordPayload {
  allocations: Array<{
    chargeItemId: string;
    amount: number;
  }>;
  memo?: string;
}

export function createReservationChargeItem(
  reservationId: string,
  payload: ChargeItemPayload,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/charge-items`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function patchChargeItem(
  chargeItemId: string,
  payload: PatchChargeItemPayload,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/charge-items/${encodeURIComponent(chargeItemId)}`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}

export function createReservationPaymentRecord(
  reservationId: string,
  payload: PaymentRecordPayload,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/payment-records`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function patchPaymentRecord(
  paymentRecordId: string,
  payload: PatchPaymentRecordPayload,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/payment-records/${encodeURIComponent(paymentRecordId)}`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}

export function confirmPaymentRecord(
  paymentRecordId: string,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/payment-records/${encodeURIComponent(paymentRecordId)}/confirm`,
    method: 'POST',
    body: {},
    signal: options.signal,
  });
}

export function voidPaymentRecord(
  paymentRecordId: string,
  memo?: string,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/payment-records/${encodeURIComponent(paymentRecordId)}/void`,
    method: 'POST',
    body: memo ? { memo } : {},
    signal: options.signal,
  });
}

export function allocatePaymentRecord(
  paymentRecordId: string,
  payload: AllocatePaymentRecordPayload,
  options: BillingRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/payment-records/${encodeURIComponent(paymentRecordId)}/allocate`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

function toBillingLedgerQuery(params: BillingLedgerRequestParams): Record<string, string | number | undefined> {
  return {
    from: params.from,
    to: params.to,
    reservationId: params.reservationId,
    vehicleNumber: params.vehicleNumber,
    rentalType: params.rentalType,
    payerType: params.payerType,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export function getBillingLedger(
  params: BillingLedgerRequestParams,
): Promise<BillingLedgerResponse> {
  return apiClient.requestData<BillingLedgerResponse>({
    path: '/api/v2/billing/ledger',
    method: 'GET',
    query: toBillingLedgerQuery(params),
    signal: params.signal,
  });
}

export function getBillingLedgerCsv(
  params: BillingLedgerRequestParams,
): Promise<string> {
  return apiClient.request<string>({
    path: '/api/v2/billing/ledger.csv',
    method: 'GET',
    query: toBillingLedgerQuery(params),
    responseType: 'text',
    signal: params.signal,
  });
}

export function getUploadDownloadUrl(
  objectName: string,
  options: BillingRequestOptions = {},
): Promise<UploadDownloadUrlResponse> {
  return apiClient.requestData<UploadDownloadUrlResponse>({
    path: '/api/v2/uploads/download-url',
    method: 'POST',
    body: { objectName },
    signal: options.signal,
  });
}
