import { apiClient } from './api';

export interface AccidentClaimRequestOptions {
  signal?: AbortSignal;
}

export interface AccidentClaimPatchPayload {
  claimNo?: string;
  insurerName?: string;
  repairShopName?: string;
  repairCompletedAt?: string;
  billingAccount?: string;
  contactName?: string;
  contactPhone?: string;
  billedAmount?: number;
  recognizedAmount?: number;
  differencePayerType?: string;
  approvalRequired?: boolean;
  approvalStatus?: string;
  approvalDocumentObjectName?: string;
  approvalDocumentObjectNames?: string[];
  approvalMemo?: string;
  documentObjectNames?: string[];
  submittedAt?: string;
  supplementMemo?: string;
  memo?: string;
}

export function getAccidentClaim(
  reservationId: string,
  options: AccidentClaimRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/accident-claim`,
    method: 'GET',
    signal: options.signal,
  });
}

export function patchAccidentClaim(
  reservationId: string,
  payload: AccidentClaimPatchPayload,
  options: AccidentClaimRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/accident-claim`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}

export function submitAccidentClaim(
  reservationId: string,
  payload: AccidentClaimPatchPayload = {},
  options: AccidentClaimRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/accident-claim/submit`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function recognizeAccidentClaim(
  reservationId: string,
  payload: AccidentClaimPatchPayload,
  options: AccidentClaimRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}/accident-claim/recognize`,
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}
