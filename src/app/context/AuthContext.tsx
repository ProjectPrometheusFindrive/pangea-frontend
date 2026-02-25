import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, setApiAccessTokenProvider } from '../../services/api';
import {
  getMe,
  postLogin,
  postLogout,
  toViewRole,
  type AuthLoginPayload,
  type AuthUser,
  type AuthViewRole,
} from '../../services/auth';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface LogoutOptions {
  silent?: boolean;
}

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  viewRole: AuthViewRole | null;
  token: string | null;
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: AuthLoginPayload) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
}

interface AuthSession {
  token: string;
  expiresAt: number;
  user: AuthUser | null;
}

const AUTH_SESSION_KEY = 'pangea.auth.v1';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.userId === 'string'
    && typeof value.companyId === 'string'
    && typeof value.role === 'string'
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  const sessionUser = value.user;
  const hasValidUser = sessionUser === null || isAuthUser(sessionUser);

  return (
    typeof value.token === 'string'
    && typeof value.expiresAt === 'number'
    && Number.isFinite(value.expiresAt)
    && hasValidUser
  );
}

function readStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isAuthSession(parsedValue)) {
      return null;
    }

    if (parsedValue.expiresAt <= Date.now()) {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage 접근이 제한된 환경에서는 캐시를 건너뛴다.
  }
}

function clearStoredSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // localStorage 접근이 제한된 환경에서는 캐시 제거를 건너뛴다.
  }
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

function calculateExpiresAt(expiresInSeconds: number): number {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return Date.now() + 60 * 60 * 1000;
  }
  return Date.now() + expiresInSeconds * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((session: AuthSession) => {
    setToken(session.token);
    setUser(session.user);
    setStatus('authenticated');
    writeStoredSession(session);
    setApiAccessTokenProvider(() => session.token);
  }, []);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    setStatus('unauthenticated');
    setApiAccessTokenProvider(undefined);
  }, []);

  const refreshSession = useCallback(async () => {
    const storedSession = readStoredSession();

    if (!storedSession) {
      clearSession();
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);
    setStatus('checking');
    setToken(storedSession.token);
    setUser(storedSession.user);
    setApiAccessTokenProvider(() => storedSession.token);

    try {
      const nextUser = await getMe();
      applySession({
        ...storedSession,
        user: nextUser,
      });
    } catch (refreshError) {
      clearSession();
      setError(toErrorMessage(refreshError, '세션 정보를 확인하지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, [applySession, clearSession]);

  const login = useCallback(async (payload: AuthLoginPayload) => {
    setError(null);
    setIsLoading(true);
    setStatus('checking');

    try {
      const loginData = await postLogin(payload);
      const initialSession: AuthSession = {
        token: loginData.token,
        expiresAt: calculateExpiresAt(loginData.expiresIn),
        user: loginData.user ?? null,
      };

      applySession(initialSession);

      try {
        const profile = await getMe();
        applySession({
          ...initialSession,
          user: profile,
        });
      } catch {
        // /me 실패 시 login 응답의 user를 fallback으로 유지한다.
      }
    } catch (loginError) {
      clearSession();
      setError(toErrorMessage(loginError, '로그인에 실패했습니다.'));
      throw loginError;
    } finally {
      setIsLoading(false);
    }
  }, [applySession, clearSession]);

  const logout = useCallback(async (options?: LogoutOptions) => {
    setError(null);
    setIsLoading(true);

    try {
      if (token) {
        await postLogout();
      }
    } catch (logoutError) {
      if (!options?.silent) {
        setError(toErrorMessage(logoutError, '로그아웃 처리 중 오류가 발생했습니다.'));
      }
    } finally {
      clearSession();
      setIsLoading(false);
    }
  }, [clearSession, token]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const viewRole = useMemo<AuthViewRole | null>(() => {
    if (!user) {
      return null;
    }
    return toViewRole(user.role);
  }, [user]);

  const contextValue = useMemo<AuthContextType>(() => ({
    status,
    user,
    viewRole,
    token,
    error,
    isLoading,
    isAuthenticated: status === 'authenticated',
    login,
    refreshSession,
    logout,
  }), [error, isLoading, login, logout, refreshSession, status, token, user, viewRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
