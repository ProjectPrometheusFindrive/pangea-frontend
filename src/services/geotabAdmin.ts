import { apiClient } from './api';
import type { GeotabPosition } from './geotab';

export interface PlatformVehicle { vin: string; companyId: string; vehicleNumber?: string; model?: string; }
export interface PlatformDevice {
  id: string; sourceDatabase: string; deviceId: string; serialNumber?: string; providerVin?: string;
  providerPlate?: string; name?: string; deviceType?: string; companyId: string | null; revision: number;
  vehicle: PlatformVehicle | null; registeredCandidate: PlatformVehicle | null;
  connectionStatus: 'online' | 'offline' | 'unknown'; collectionStatus: 'healthy' | 'delayed';
  isDriving: boolean | null; lastCollectedAt: string | null; lastDataAt: string | null;
  tenantAssignedAt?: string; latestPosition: GeotabPosition | null;
  feeds: { entity: string; updatedAt: string | null }[];
}
export interface PlatformTrip {
  id: string; start: string; stop: string | null; distanceKm: number | null; drivingDuration?: string;
  stopPoint: GeotabPosition | null;
}
export interface PlatformDeviceDetail extends PlatformDevice {
  positions: GeotabPosition[]; trips: PlatformTrip[]; from: string; to: string;
  routeSampled: boolean; routeTruncated: boolean; tripsTruncated: boolean;
  assignmentHistory: { fromCompanyId: string | null; toCompanyId: string | null; at: string; actor: string }[];
}
const base = '/api/v2/admin/geotab';
export const listPlatformDevices = (offset = 0, signal?: AbortSignal) => apiClient.requestData<{ items: PlatformDevice[]; hasMore: boolean; inventoryCapped: boolean }>({ path: `${base}/devices`, query: { offset }, signal });
export const listGeotabTenants = (signal?: AbortSignal) => apiClient.requestData<{ items: { companyId: string; name: string }[] }>({ path: `${base}/tenants`, signal });
export const getPlatformDevice = (id: string, range: { from?: string; to?: string } = {}, signal?: AbortSignal) => apiClient.requestData<PlatformDeviceDetail>({ path: `${base}/devices/${encodeURIComponent(id)}`, query: range, signal });
export const assignPlatformDevice = (id: string, companyId: string | null, revision: number) => apiClient.requestData<PlatformDevice>({ path: `${base}/devices/${encodeURIComponent(id)}/tenant`, method: 'PATCH', body: { companyId, revision } });
