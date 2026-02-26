import { apiClient } from './api';

export interface AssetsRequestOptions {
  signal?: AbortSignal;
}

export interface GetAssetsListParams extends AssetsRequestOptions {
  page: number;
  size: number;
  status?: string;
  q?: string;
}

export function getAssetsList({
  page,
  size,
  status,
  q,
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
