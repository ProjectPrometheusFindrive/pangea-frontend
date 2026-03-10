import { ApiError, apiClient } from './api';

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

export interface AuthWithdrawData {
  message?: string;
}

export interface AuthRefreshData {
  token: string;
  expiresIn: number;
  user?: AuthUser | null;
}

export interface AuthCheckUserIdData {
  available: boolean;
}

export interface AuthRegisterAgreements {
  privacy: boolean;
  location: boolean;
  marketing?: boolean;
  agreedAt?: string;
}

export interface AuthRegisterPayload {
  userId: string;
  password: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  company: string;
  companyName?: string;
  bizRegNo: string;
  role?: 'admin' | 'member';
  agreements?: AuthRegisterAgreements;
}

export interface AuthRegisterData {
  userId: string;
  name?: string;
  createdAt?: string;
}

export function toViewRole(role: string | null | undefined): AuthViewRole | null {
  if (role === 'installer') {
    return 'device-installer';
  }
  if (role === 'super_admin' || role === 'admin' || role === 'member') {
    return 'rental-business';
  }
  return null;
}

export function resolveDefaultLandingPath(viewRole: AuthViewRole | null | undefined): string {
  if (viewRole === 'device-installer') {
    return '/device-installation';
  }
  return '/';
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

export function postWithdraw(): Promise<AuthWithdrawData> {
  return apiClient.requestData<AuthWithdrawData>({
    path: '/api/v2/auth/withdraw',
    method: 'POST',
  });
}

export function getCheckUserId(userId: string): Promise<AuthCheckUserIdData> {
  return apiClient.requestData<AuthCheckUserIdData>({
    path: '/api/v2/auth/check-userid',
    method: 'GET',
    query: { userId },
    skipAuth: true,
  });
}

export async function postRegister(payload: AuthRegisterPayload): Promise<AuthRegisterData> {
  try {
    return await apiClient.requestData<AuthRegisterData>({
      path: '/api/v2/auth/register',
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return apiClient.requestData<AuthRegisterData>({
        path: '/api/v2/auth/signup',
        method: 'POST',
        body: payload,
        skipAuth: true,
      });
    }
    throw error;
  }
}
