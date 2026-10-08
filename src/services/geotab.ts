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
  collisionConfidenceThreshold: number;
  eventFreshnessMinutes: number;
  locationMaxGapMinutes: number;
}

export interface GeotabRequestOptions { signal?: AbortSignal; companyId?: string; }

export interface GeotabDevice {
  id: string; deviceId: string; sourceDatabase: string; serialNumber?: string;
  name: string; providerVin?: string; providerPlate?: string; deviceType?: string;
  vin?: string | null; vehicleNumber?: string; mapped: boolean; mappedAt?: string;
  revision: number; lastSyncedAt: string; replayedCount?: number;
}

export interface GeotabMappingVehicle {
  vin: string;
  vehicleNumber: string;
  make?: string;
  model?: string;
  year?: number | string;
}

export function getGeotabDevices(options: GeotabRequestOptions = {}) {
  return apiClient.requestData<{ items: GeotabDevice[] }>({ path: '/api/v2/geotab/devices', method: 'GET', query: { companyId: options.companyId }, signal: options.signal });
}

export function getGeotabMappingVehicles(q: string, options: GeotabRequestOptions = {}) {
  return apiClient.requestData<{ items: GeotabMappingVehicle[]; hasMore: boolean }>({ path: '/api/v2/geotab/mapping-vehicles', method: 'GET', query: { companyId: options.companyId, q }, signal: options.signal });
}

export function mapGeotabDevice(deviceId: string, payload: { vin: string | null; revision: number; effectiveFrom?: string }, options: GeotabRequestOptions = {}) {
  return apiClient.requestData<GeotabDevice>({ path: `/api/v2/geotab/devices/${encodeURIComponent(deviceId)}/mapping`, method: 'PATCH', body: payload, query: { companyId: options.companyId }, signal: options.signal });
}

export function lookupInstallationDevice(installationId: string, serial: string, options: GeotabRequestOptions = {}) {
  return apiClient.requestData<{ status: string; message: string; deviceId?: string }>({ path: `/api/v2/device-installations/${encodeURIComponent(installationId)}/geotab-device`, method: 'GET', query: { companyId: options.companyId, serial }, signal: options.signal });
}

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
