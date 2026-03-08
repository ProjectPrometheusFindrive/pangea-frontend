import { apiClient } from './api';

export interface SettingsRequestOptions {
  signal?: AbortSignal;
  companyId?: string;
}

export interface SettingsCompanyProfile {
  companyId: string;
  name: string;
  businessNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  updatedAt?: string | null;
  schemaVersion?: string | null;
}

export interface SettingsCompanyUpdateRequest {
  name?: string;
  businessNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  schemaVersion?: string;
}

export interface SettingsGeofence {
  id: string;
  name: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusMeter: number;
  active: boolean;
}

export interface SettingsGeofenceListData {
  items: SettingsGeofence[];
}

export interface SettingsGeofenceCreateRequest {
  name: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusMeter: number;
  active?: boolean;
}

export interface SettingsGeofenceUpdateRequest {
  center?: {
    lat: number;
    lng: number;
  };
  radiusMeter?: number;
  active?: boolean;
}

export type SettingsMemberRole = 'admin' | 'member' | string;
export type SettingsMemberStatus = 'approved' | 'pending' | 'rejected' | 'withdrawn' | string;

export interface SettingsMember {
  userId: string;
  name?: string | null;
  email?: string | null;
  companyId?: string | null;
  role: SettingsMemberRole;
  status: SettingsMemberStatus;
}

export interface SettingsMembersListData {
  items: SettingsMember[];
}

export interface SettingsMemberRolePatchRequest {
  role: 'admin' | 'member';
}

export function getSettingsCompany(options: SettingsRequestOptions = {}): Promise<SettingsCompanyProfile> {
  return apiClient.requestData<SettingsCompanyProfile>({
    path: '/api/v2/settings/company',
    method: 'GET',
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function putSettingsCompany(
  payload: SettingsCompanyUpdateRequest,
  options: SettingsRequestOptions = {},
): Promise<SettingsCompanyProfile> {
  return apiClient.requestData<SettingsCompanyProfile>({
    path: '/api/v2/settings/company',
    method: 'PUT',
    body: payload,
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function listSettingsGeofences(options: SettingsRequestOptions = {}): Promise<SettingsGeofenceListData> {
  return apiClient.requestData<SettingsGeofenceListData>({
    path: '/api/v2/settings/geofences',
    method: 'GET',
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function createSettingsGeofence(
  payload: SettingsGeofenceCreateRequest,
  options: SettingsRequestOptions = {},
): Promise<SettingsGeofence> {
  return apiClient.requestData<SettingsGeofence>({
    path: '/api/v2/settings/geofences',
    method: 'POST',
    body: payload,
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function updateSettingsGeofence(
  geofenceId: string,
  payload: SettingsGeofenceUpdateRequest,
  options: SettingsRequestOptions = {},
): Promise<SettingsGeofence> {
  return apiClient.requestData<SettingsGeofence>({
    path: `/api/v2/settings/geofences/${encodeURIComponent(geofenceId)}`,
    method: 'PUT',
    body: payload,
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function deleteSettingsGeofence(geofenceId: string, options: SettingsRequestOptions = {}): Promise<void> {
  return apiClient.requestData<void>({
    path: `/api/v2/settings/geofences/${encodeURIComponent(geofenceId)}`,
    method: 'DELETE',
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function listSettingsMembers(
  status?: 'approved' | 'pending' | 'rejected' | 'withdrawn',
  options: SettingsRequestOptions = {},
): Promise<SettingsMembersListData> {
  return apiClient.requestData<SettingsMembersListData>({
    path: '/api/v2/settings/members',
    method: 'GET',
    query: {
      status,
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}

export function patchSettingsMemberRole(
  userId: string,
  payload: SettingsMemberRolePatchRequest,
  options: SettingsRequestOptions = {},
): Promise<SettingsMember> {
  return apiClient.requestData<SettingsMember>({
    path: `/api/v2/settings/members/${encodeURIComponent(userId)}/role`,
    method: 'PATCH',
    body: payload,
    query: {
      companyId: options.companyId,
    },
    signal: options.signal,
  });
}
