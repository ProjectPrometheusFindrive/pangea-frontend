import { apiClient } from './api';

export interface SafetyPolicy { minimumDistanceKm: number; settlementDelayMinutes: number; formulaVersion: string; revision: number; }
export interface SafetyMetrics { distanceKm: number; drivingSeconds: number; speedingSeconds: number; speedingPercent: number; counts: Record<string, number>; components: Record<string, number>; score: number | null; }
export interface SafetyRecord { key: string; sourceId: string; vin: string; start: string; stop: string; excluded: boolean; exclusionReason?: string; category?: string; distanceKm?: number; drivingSeconds?: number; boundary?: boolean; }
export interface SafetyContract {
  contractId: string; representativeName: string; vehicleNumber: string; startedAt?: string; returnedAt?: string;
  status: string; score: number | null; metrics: Partial<SafetyMetrics>; policy: Partial<SafetyPolicy>;
}
export interface SafetyDetail extends SafetyContract {
  events: SafetyRecord[]; trips: SafetyRecord[]; warnings: string[];
  monthly: (SafetyMetrics & { month: string })[];
  history?: { type: string; at: string; actor: string; score?: number | null; beforeScore?: number | null; reason?: string; excluded?: boolean; revision?: number; }[];
}
const path = '/api/v2/safety';
export const getSafetySettings = (companyId: string, signal?: AbortSignal) => apiClient.requestData<SafetyPolicy>({ path: `${path}/settings`, query: { companyId }, signal });
export const saveSafetySettings = (companyId: string, minimumDistanceKm: number, revision: number) => apiClient.requestData<SafetyPolicy>({ path: `${path}/settings`, method: 'PATCH', query: { companyId }, body: { minimumDistanceKm, revision } });
export const listSafetyContracts = (companyId: string, offset: number, signal?: AbortSignal) => apiClient.requestData<{ items: SafetyContract[]; hasMore: boolean; totalCount: number }>({ path: `${path}/contracts`, query: { companyId, offset }, signal });
export const getSafetyContract = (companyId: string, id: string, signal?: AbortSignal) => apiClient.requestData<SafetyDetail>({ path: `${path}/contracts/${encodeURIComponent(id)}`, query: { companyId }, signal });
export const excludeSafetyRecord = (companyId: string, id: string, recordKey: string, excluded: boolean, reason: string) => apiClient.requestData<SafetyDetail>({ path: `${path}/contracts/${encodeURIComponent(id)}/exclusions`, method: 'PATCH', query: { companyId }, body: { recordKey, excluded, reason } });
