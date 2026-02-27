import { apiClient } from './api';

export interface DashboardRequestOptions {
  signal?: AbortSignal;
}

function requestDashboardPayload(path: string, options: DashboardRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path,
    method: 'GET',
    signal: options.signal,
  });
}

export function getAssetsDashboard(options?: DashboardRequestOptions): Promise<unknown> {
  return requestDashboardPayload('/api/v2/assets', options);
}

export function getReservationsDashboard(options?: DashboardRequestOptions): Promise<unknown> {
  return requestDashboardPayload('/api/v2/reservations', options);
}

export function getActionRequiredDashboard(options?: DashboardRequestOptions): Promise<unknown> {
  return requestDashboardPayload('/api/v2/action-items', options);
}

export function getHomeSummaryDashboard(options?: DashboardRequestOptions): Promise<unknown> {
  return requestDashboardPayload('/api/v2/home/summary', options);
}

export function getRevenueSummaryDashboard(options?: DashboardRequestOptions): Promise<unknown> {
  return requestDashboardPayload('/api/v2/revenue/summary', options);
}

export function getSettingsDashboard(options?: DashboardRequestOptions): Promise<unknown> {
  return requestDashboardPayload('/api/v2/settings', options);
}
