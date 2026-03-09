import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiClient, setApiAccessTokenProvider } from '../../services/api';
import {
  getMe,
  postLogin,
  postLogout,
  postRefresh,
  toViewRole,
  type AuthLoginPayload,
  type AuthRefreshData,
  type AuthUser,
  type AuthViewRole,
} from '../../services/auth';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface LogoutOptions {
  silent?: boolean;
  redirectToLogin?: boolean;
}

interface RefreshSessionOptions {
  silent?: boolean;
}

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  viewRole: AuthViewRole | null;
  token: string | null;
  error: string | null;
  isLoading: boolean;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login: (payload: AuthLoginPayload) => Promise<void>;
  refreshSession: (options?: RefreshSessionOptions) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
}

interface AuthSession {
  token: string;
  expiresAt: number;
  user: AuthUser | null;
}

const AUTH_SESSION_KEY = 'pangea.auth.v1';
const AUTH_RETURN_URL_KEY = 'pangea.auth.return-url.v1';
const AUTH_STORAGE_KEYS = [
  AUTH_SESSION_KEY,
  'pangea.auth.token',
  'pangea.refresh.token',
  'accessToken',
  'refreshToken',
];
const LOGIN_PATH = '/login';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isLoginPath(path: string): boolean {
  return path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`) || path.startsWith(`${LOGIN_PATH}#`);
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeReturnUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith('/') || isLoginPath(trimmedValue)) {
    return null;
  }
  return trimmedValue;
}

function buildCurrentPath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function removeStorageItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // storage 접근이 제한된 환경에서는 제거를 건너뛴다.
  }
}

function clearStoredReturnUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }
  removeStorageItem(window.sessionStorage, AUTH_RETURN_URL_KEY);
}

export function rememberReturnUrl(path: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPath = normalizeReturnUrl(path);
  if (!normalizedPath) {
    return;
  }

  try {
    window.sessionStorage.setItem(AUTH_RETURN_URL_KEY, normalizedPath);
  } catch {
    // storage 접근이 제한된 환경에서는 저장을 건너뛴다.
  }
}

export function rememberCurrentPathAsReturnUrl(): void {
  rememberReturnUrl(buildCurrentPath());
}

export function consumeStoredReturnUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(AUTH_RETURN_URL_KEY);
    removeStorageItem(window.sessionStorage, AUTH_RETURN_URL_KEY);

    if (!rawValue) {
      return null;
    }

    return normalizeReturnUrl(rawValue);
  } catch {
    return null;
  }
}

function redirectToLogin(reason: 'manual' | 'expired'): void {
  if (typeof window === 'undefined') {
    return;
  }

  const targetUrl = new URL(LOGIN_PATH, window.location.origin);
  targetUrl.searchParams.set('reason', reason);
  const nextPath = `${targetUrl.pathname}${targetUrl.search}`;
  window.history.replaceState(window.history.state, '', nextPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

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

function parseStoredSession(rawValue: string | null): AuthSession | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isAuthSession(parsedValue)) {
      removeStorageItem(window.localStorage, AUTH_SESSION_KEY);
      return null;
    }

    if (parsedValue.expiresAt <= Date.now()) {
      removeStorageItem(window.localStorage, AUTH_SESSION_KEY);
      removeStorageItem(window.sessionStorage, AUTH_SESSION_KEY);
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function readStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const session = parseStoredSession(window.localStorage.getItem(AUTH_SESSION_KEY));
  if (!session) {
    clearStoredSession();
  }

  return session;
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

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of AUTH_STORAGE_KEYS) {
      removeStorageItem(storage, key);
    }
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

function toSessionFromTokenResponse(
  payload: Pick<AuthRefreshData, 'token' | 'expiresIn'> & Partial<Pick<AuthRefreshData, 'user'>>,
  fallbackUser: AuthUser | null,
): AuthSession {
  return {
    token: payload.token,
    expiresAt: calculateExpiresAt(payload.expiresIn),
    user: payload.user ?? fallbackUser,
  };
}

function toRequestPath(path: string): string {
  if (isAbsoluteUrl(path)) {
    try {
      return new URL(path).pathname;
    } catch {
      return path;
    }
  }
  return path;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSessionExpiredModalOpen, setIsSessionExpiredModalOpen] = useState(false);
  const refreshPromiseRef = useRef<Promise<AuthSession | null> | null>(null);
  const sessionExpiredHandledRef = useRef(false);
  const authRequestVersionRef = useRef(0);
  const statusRef = useRef<AuthStatus>('checking');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

  const handleSessionExpired = useCallback(() => {
    if (sessionExpiredHandledRef.current) {
      return;
    }

    sessionExpiredHandledRef.current = true;
    refreshPromiseRef.current = null;
    rememberCurrentPathAsReturnUrl();
    clearSession();
    setError('세션이 만료되었습니다. 다시 로그인해 주세요.');
    setIsLoading(false);
    setIsBootstrapping(false);
    setIsSessionExpiredModalOpen(true);
  }, [clearSession]);

  const handleBootstrapSessionExpired = useCallback(() => {
    refreshPromiseRef.current = null;
    clearSession();
    setError('세션이 만료되었습니다. 다시 로그인해 주세요.');
    setIsLoading(false);
    setIsBootstrapping(false);
    setIsSessionExpiredModalOpen(false);
  }, [clearSession]);

  const refreshAccessToken = useCallback(async (): Promise<AuthSession | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const storedSession = readStoredSession();
    if (!storedSession) {
      return null;
    }

    const refreshPromise = (async () => {
      try {
        const refreshData = await postRefresh();
        const nextToken = typeof refreshData.token === 'string' && refreshData.token.trim().length > 0
          ? refreshData.token
          : storedSession.token;

        const refreshedSession = toSessionFromTokenResponse(
          {
            ...refreshData,
            token: nextToken,
          },
          storedSession.user,
        );
        applySession(refreshedSession);
        return refreshedSession;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [applySession]);

  const refreshSession = useCallback(async (options?: RefreshSessionOptions) => {
    const requestVersion = authRequestVersionRef.current;
    const isStaleRequest = () => requestVersion !== authRequestVersionRef.current;
    const storedSession = readStoredSession();
    const isSilentRefresh = options?.silent === true;

    if (!storedSession) {
      clearSession();
      setIsLoading(false);
      setIsBootstrapping(false);
      return;
    }

    setError(null);
    if (!isSilentRefresh) {
      setIsLoading(true);
      setStatus('checking');
    }
    setToken(storedSession.token);
    setUser(storedSession.user);
    setApiAccessTokenProvider(() => storedSession.token);

    try {
      const nextUser = await getMe();
      if (isStaleRequest()) {
        return;
      }
      applySession({
        ...storedSession,
        user: nextUser,
      });
    } catch (refreshError) {
      if (isStaleRequest()) {
        return;
      }

      if (refreshError instanceof ApiError && refreshError.status === 401) {
        const refreshedSession = await refreshAccessToken();
        if (isStaleRequest()) {
          return;
        }

        if (!refreshedSession) {
          if (isSilentRefresh || statusRef.current === 'authenticated') {
            handleSessionExpired();
          } else {
            handleBootstrapSessionExpired();
          }
          return;
        }

        try {
          const refreshedUser = await getMe();
          if (isStaleRequest()) {
            return;
          }
          applySession({
            ...refreshedSession,
            user: refreshedUser,
          });
        } catch {
          if (isStaleRequest()) {
            return;
          }
          if (isSilentRefresh || statusRef.current === 'authenticated') {
            handleSessionExpired();
          } else {
            handleBootstrapSessionExpired();
          }
          return;
        }
      } else {
        if (isStaleRequest()) {
          return;
        }
        clearSession();
        setError(toErrorMessage(refreshError, '세션 정보를 확인하지 못했습니다.'));
      }
    } finally {
      setIsLoading(false);
      setIsBootstrapping(false);
    }
  }, [applySession, clearSession, handleBootstrapSessionExpired, handleSessionExpired, refreshAccessToken]);

  const login = useCallback(async (payload: AuthLoginPayload) => {
    authRequestVersionRef.current += 1;
    setError(null);
    setIsLoading(true);
    setStatus('checking');

    try {
      const loginData = await postLogin(payload);
      const initialSession = toSessionFromTokenResponse(loginData, null);

      sessionExpiredHandledRef.current = false;
      setIsSessionExpiredModalOpen(false);
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
      setIsBootstrapping(false);
    }
  }, [applySession, clearSession]);

  const logout = useCallback(async (options?: LogoutOptions) => {
    authRequestVersionRef.current += 1;
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
      clearStoredReturnUrl();
      refreshPromiseRef.current = null;
      sessionExpiredHandledRef.current = false;
      setIsSessionExpiredModalOpen(false);
      clearSession();
      setIsLoading(false);
      setIsBootstrapping(false);

      if (options?.redirectToLogin !== false) {
        redirectToLogin('manual');
      }
    }
  }, [clearSession, token]);

  const handleSessionExpiredConfirm = useCallback(() => {
    setIsSessionExpiredModalOpen(false);
    redirectToLogin('expired');
  }, []);

  useEffect(() => {
    const removeInterceptor = apiClient.useResponseInterceptor(async (context) => {
      const requestVersion = authRequestVersionRef.current;
      const isStaleRequest = () => requestVersion !== authRequestVersionRef.current;

      if (context.response.status !== 401 || context.request.config.skipAuth) {
        return context;
      }

      if (!readStoredSession()) {
        return context;
      }

      if (sessionExpiredHandledRef.current) {
        return context;
      }

      const requestPath = toRequestPath(context.request.config.path);
      if (requestPath === '/api/v2/auth/login' || requestPath === '/api/v2/auth/refresh') {
        return context;
      }

      if (requestPath === '/api/v2/auth/logout') {
        return context;
      }

      if (context.request.config.internal?.hasRetriedAuth) {
        if (!isStaleRequest()) {
          handleSessionExpired();
        }
        return context;
      }

      const refreshedSession = await refreshAccessToken();
      if (isStaleRequest()) {
        return context;
      }
      if (!refreshedSession) {
        handleSessionExpired();
        return context;
      }

      try {
        const retriedBody = await apiClient.request<unknown>({
          ...context.request.config,
          internal: {
            ...context.request.config.internal,
            hasRetriedAuth: true,
          },
        });

        return {
          ...context,
          response: new Response(null, { status: 200, statusText: 'OK' }),
          body: retriedBody,
        };
      } catch (retryError) {
        if (!isStaleRequest() && retryError instanceof ApiError && retryError.status === 401) {
          handleSessionExpired();
        }
        throw retryError;
      }
    });

    return removeInterceptor;
  }, [handleSessionExpired, refreshAccessToken]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SESSION_KEY) {
        return;
      }

      const nextSession = parseStoredSession(event.newValue);
      if (!nextSession) {
        clearSession();
        sessionExpiredHandledRef.current = false;
        setIsSessionExpiredModalOpen(false);
        setError(null);
        setIsLoading(false);
        setIsBootstrapping(false);
        return;
      }

      sessionExpiredHandledRef.current = false;
      setIsSessionExpiredModalOpen(false);
      applySession(nextSession);
      setError(null);
      setIsLoading(false);
      setIsBootstrapping(false);
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      };
  }, [applySession, clearSession]);

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
    isBootstrapping,
    isAuthenticated: status === 'authenticated',
    login,
    refreshSession,
    logout,
  }), [error, isBootstrapping, isLoading, login, logout, refreshSession, status, token, user, viewRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {isSessionExpiredModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">세션이 만료되었습니다</h2>
            <p className="mt-2 text-sm text-gray-600">
              보안을 위해 로그인 세션이 종료되었습니다. 다시 로그인해 주세요.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSessionExpiredConfirm}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                로그인으로 이동
              </button>
            </div>
          </div>
        </div>
      )}
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
