import { apiClient } from './api';

export type DemoSimulationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type DemoSimulationRunMode = 'reset_generate' | 'advance' | 'dry_run';

export interface DemoSimulationRun {
  id: string;
  companyId: string;
  mode: DemoSimulationRunMode;
  seed: number;
  status: DemoSimulationRunStatus;
  stage: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  deletedCounts?: Record<string, number>;
  createdCounts?: Record<string, number>;
  validationSummary?: {
    success: boolean;
    failureCount: number;
    checks: Array<{ name: string; ok: boolean; actual?: unknown; expected?: unknown }>;
  };
  error?: { type?: string; message?: string };
  lastSimulatedDate?: string;
  windowStart?: string;
  windowEnd?: string;
}

export interface DemoSimulationTenant {
  companyId: string;
  name: string;
  lastRun?: DemoSimulationRun | null;
}

export interface DemoSimulationProfileValidationError {
  path?: string;
  name?: string;
  reason?: string;
  message?: string;
  actual?: unknown;
  expected?: unknown;
  [key: string]: unknown;
}

export interface DemoSimulationProfileValidation {
  valid: boolean;
  errors: DemoSimulationProfileValidationError[];
}

export interface DemoSimulationProfileResponse {
  profile: Record<string, unknown>;
  source?: 'saved' | 'default';
  validation?: DemoSimulationProfileValidation;
}

export interface DemoSimulationTenantsResponse {
  items: DemoSimulationTenant[];
}

export interface DemoSimulationRunResponse {
  run: DemoSimulationRun;
}

export interface DemoSimulationRunPayload {
  companyId: string;
  mode: DemoSimulationRunMode;
  seed?: number;
  resetConfirmed?: boolean;
  async?: boolean;
  profile?: Record<string, unknown>;
}

export function getDefaultDemoSimulationProfile(companyId?: string, signal?: AbortSignal): Promise<DemoSimulationProfileResponse> {
  return apiClient.requestData<DemoSimulationProfileResponse>({
    path: '/api/v2/demo-simulation/profile/default',
    method: 'GET',
    query: { companyId },
    signal,
  });
}

export function getSavedDemoSimulationProfile(companyId: string, signal?: AbortSignal): Promise<DemoSimulationProfileResponse> {
  return apiClient.requestData<DemoSimulationProfileResponse>({
    path: '/api/v2/demo-simulation/profile',
    method: 'GET',
    query: { companyId },
    signal,
  });
}

export function validateDemoSimulationProfile(
  companyId: string,
  profile: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<DemoSimulationProfileResponse> {
  return apiClient.requestData<DemoSimulationProfileResponse>({
    path: '/api/v2/demo-simulation/profile/validate',
    method: 'POST',
    body: { companyId, profile },
    signal,
  });
}

export function saveDemoSimulationProfile(
  companyId: string,
  profile: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<DemoSimulationProfileResponse> {
  return apiClient.requestData<DemoSimulationProfileResponse>({
    path: '/api/v2/demo-simulation/profile',
    method: 'PUT',
    body: { companyId, profile },
    signal,
  });
}

export function listDemoSimulationTenants(signal?: AbortSignal): Promise<DemoSimulationTenantsResponse> {
  return apiClient.requestData<DemoSimulationTenantsResponse>({
    path: '/api/v2/demo-simulation/tenants',
    method: 'GET',
    signal,
  });
}

export function startDemoSimulationRun(payload: DemoSimulationRunPayload, signal?: AbortSignal): Promise<DemoSimulationRunResponse> {
  return apiClient.requestData<DemoSimulationRunResponse>({
    path: '/api/v2/demo-simulation/runs',
    method: 'POST',
    body: payload,
    signal,
    timeoutMs: 30_000,
  });
}

export function getDemoSimulationRun(runId: string, signal?: AbortSignal): Promise<DemoSimulationRunResponse> {
  return apiClient.requestData<DemoSimulationRunResponse>({
    path: `/api/v2/demo-simulation/runs/${encodeURIComponent(runId)}`,
    method: 'GET',
    signal,
  });
}
