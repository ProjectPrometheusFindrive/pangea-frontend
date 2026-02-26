import { apiClient } from './api';

export interface PermissionsRequestOptions {
  signal?: AbortSignal;
}

export function getMyPermissions(options: PermissionsRequestOptions = {}): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: '/api/v2/permissions/me',
    method: 'GET',
    signal: options.signal,
  });
}

