import { apiClient } from './api';

export interface AssetsRequestOptions {
  signal?: AbortSignal;
}

export interface GetAssetsListParams extends AssetsRequestOptions {
  page: number;
  size: number;
  status?: string;
  q?: string;
  model?: string;
}

export interface CreateAssetPayload {
  vin: string;
  plate: string;
  vehicleNumber?: string;
  companyId?: string;
  owner?: string;
  category?: string;
  color?: string;
  model?: string;
  year?: number;
  insuranceExpiry?: string | null;
  nextInspection?: string | null;
}

export interface PatchAssetPayload {
  version: number;
  companyId?: string;
  plate?: string;
  vehicleNumber?: string;
  owner?: string;
  category?: string;
  color?: string;
  model?: string;
  vehicleType?: string;
  year?: number;
  status?: string;
  contractStatus?: string;
  memo?: string;
  make?: string;
  fuelType?: string;
  vehicleValue?: string | number | null;
  registrationStatus?: string;
  registrationDate?: string | null;
  purchaseDate?: string | null;
  insuranceExpiry?: string | null;
  nextInspection?: string | null;
}

export interface GetAssetHistoryParams extends AssetsRequestOptions {
  page?: number;
  pageSize?: number;
}

export function getAssetsList({
  page,
  size,
  status,
  q,
  model,
  signal,
}: GetAssetsListParams): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/assets',
    method: 'GET',
    query: {
      page,
      size,
      status,
      q,
      model,
    },
    signal,
  });
}

export function getAssetDetail(assetId: string, options: AssetsRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/assets/${encodeURIComponent(assetId)}`,
    method: 'GET',
    signal: options.signal,
  });
}

export function createAsset(payload: CreateAssetPayload, options: AssetsRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/assets',
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function patchAsset(
  assetId: string,
  payload: PatchAssetPayload,
  options: AssetsRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/assets/${encodeURIComponent(assetId)}`,
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  });
}

export function deleteAsset(assetId: string, options: AssetsRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/assets/${encodeURIComponent(assetId)}`,
    method: 'DELETE',
    signal: options.signal,
  });
}

export function getAssetHistory(
  assetId: string,
  { page, pageSize, signal }: GetAssetHistoryParams = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/assets/${encodeURIComponent(assetId)}/history`,
    method: 'GET',
    query: {
      page,
      pageSize,
    },
    signal,
  });
}

export interface GetAssetReservationsParams extends AssetsRequestOptions {
  page?: number;
  size?: number;
}

export function getAssetReservations(
  assetId: string,
  { page, size, signal }: GetAssetReservationsParams = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/assets/${encodeURIComponent(assetId)}/reservations`,
    method: 'GET',
    query: { page, size },
    signal,
  });
}
