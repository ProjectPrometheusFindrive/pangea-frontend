import { apiClient } from './api';

export interface GeotabPosition {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKph?: number | null;
  address?: string | null;
}

export interface GeotabRecentPositionsResponse {
  vehicleId: string;
  vehicleNumber?: string | null;
  positions: GeotabPosition[];
}

export interface GeotabThresholdConfig {
  theftDwellMinutes: number;
  geofenceRadiusMeters: number;
  accidentDeltaV: number;
}

export interface GeotabRequestOptions { signal?: AbortSignal; companyId?: string; }

/** MVP contract: GET /api/v2/geotab/vehicles/{vehicleId}/positions?limit=50 */
export function getGeotabRecentPositions(
  vehicleId: string,
  options: GeotabRequestOptions = {},
): Promise<GeotabRecentPositionsResponse> {
  return apiClient.requestData<GeotabRecentPositionsResponse>({
    path: `/api/v2/geotab/vehicles/${encodeURIComponent(vehicleId)}/positions`,
    method: 'GET',
    query: { limit: 50, companyId: options.companyId },
    signal: options.signal,
  });
}

/** MVP contract: GET/PATCH /api/v2/settings/geotab-thresholds */
export function getGeotabThresholds(options: GeotabRequestOptions = {}): Promise<GeotabThresholdConfig> {
  return apiClient.requestData<GeotabThresholdConfig>({
    path: '/api/v2/settings/geotab-thresholds', method: 'GET',
    query: { companyId: options.companyId }, signal: options.signal,
  });
}

export function updateGeotabThresholds(
  payload: GeotabThresholdConfig,
  options: GeotabRequestOptions = {},
): Promise<GeotabThresholdConfig> {
  return apiClient.requestData<GeotabThresholdConfig>({
    path: '/api/v2/settings/geotab-thresholds', method: 'PATCH', body: payload,
    query: { companyId: options.companyId }, signal: options.signal,
  });
}
