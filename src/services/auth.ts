import { apiClient } from './api';

export type KnownAuthRole = 'super_admin' | 'admin' | 'member' | 'installer';
export type AuthViewRole = 'rental-business' | 'device-installer';

export interface AuthUser {
  userId: string;
  name?: string;
  email?: string;
  role: KnownAuthRole | string;
  companyId: string;
  company?: string;
  position?: string;
}

export interface AuthLoginPayload {
  userId: string;
  password: string;
}

export interface AuthLoginData {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

export interface AuthLogoutData {
  message: string;
}

export interface AuthRefreshData {
  token: string;
  expiresIn: number;
  user?: AuthUser | null;
}

export function toViewRole(role: string | null | undefined): AuthViewRole {
  if (role === 'installer') {
    return 'device-installer';
  }
  return 'rental-business';
}

export function postLogin(payload: AuthLoginPayload): Promise<AuthLoginData> {
  return apiClient.requestData<AuthLoginData>({
    path: '/api/v2/auth/login',
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}

export function getMe(): Promise<AuthUser> {
  return apiClient.requestData<AuthUser>({
    path: '/api/v2/auth/me',
    method: 'GET',
  });
}

export function postRefresh(): Promise<AuthRefreshData> {
  return apiClient.requestData<AuthRefreshData>({
    path: '/api/v2/auth/refresh',
    method: 'POST',
    skipAuthRefresh: true,
  });
}

export function postLogout(): Promise<AuthLogoutData> {
  return apiClient.requestData<AuthLogoutData>({
    path: '/api/v2/auth/logout',
    method: 'POST',
  });
}
