import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '../../services/api';
import { getMyPermissions } from '../../services/permissions';
import {
  derivePermissionsFromApiPayload,
  hasPermission,
  KNOWN_APP_PERMISSIONS,
  permissionSetToArray,
  type AppActionPermission,
  type AppPermission,
  type AppRoutePermission,
  type AuthorizationSource,
} from '../authorization';
import { useAuth } from './AuthContext';

type AuthorizationStatus = 'checking' | 'ready';

interface AuthorizationContextType {
  status: AuthorizationStatus;
  isBootstrapping: boolean;
  source: AuthorizationSource | null;
  permissions: ReadonlySet<AppPermission>;
  hasPermission: (permission: AppPermission) => boolean;
  canAccessRoute: (permission: AppRoutePermission) => boolean;
  canPerformAction: (permission: AppActionPermission) => boolean;
  refreshAuthorization: (options?: { force?: boolean }) => Promise<void>;
}

interface AuthorizationCachePayload {
  version: 2;
  userId: string;
  companyId: string;
  role: string;
  source: 'api';
  fetchedAt: number;
  permissions: AppPermission[];
}

const AUTHORIZATION_CACHE_KEY = 'pangea.authorization.v2';
const AUTHORIZATION_CACHE_TTL_MS = 5 * 60 * 1000;
const FOCUS_REFRESH_MIN_INTERVAL_MS = 30 * 1000;
const KNOWN_PERMISSION_SET = new Set<AppPermission>(KNOWN_APP_PERMISSIONS);
const NETWORK_ERROR_CODES = new Set(['NETWORK_ERROR', 'TIMEOUT', 'ABORTED', 'SERVER_ERROR']);

const AuthorizationContext = createContext<AuthorizationContextType | undefined>(undefined);

function removeAuthorizationCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(AUTHORIZATION_CACHE_KEY);
  } catch {
    // localStorage 접근이 제한된 경우 캐시 제거를 건너뛴다.
  }
}

function toNormalizedNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readAuthorizationCache(
  userId: string,
  companyId: string | null,
  role: string,
): AuthorizationCachePayload | null {
  if (!companyId) {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(AUTHORIZATION_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (typeof parsedValue !== 'object' || parsedValue === null) {
      return null;
    }

    const candidate = parsedValue as Partial<AuthorizationCachePayload>;
    if (candidate.version !== 2) {
      return null;
    }
    if (candidate.userId !== userId || candidate.companyId !== companyId || candidate.role !== role) {
      return null;
    }
    if (candidate.source !== 'api') {
      return null;
    }
    if (typeof candidate.fetchedAt !== 'number' || !Number.isFinite(candidate.fetchedAt)) {
      return null;
    }
    if (!Array.isArray(candidate.permissions)) {
      return null;
    }

    const now = Date.now();
    if (now - candidate.fetchedAt > AUTHORIZATION_CACHE_TTL_MS) {
      return null;
    }

    const validPermissions = candidate.permissions.filter((permission): permission is AppPermission => (
      typeof permission === 'string' && KNOWN_PERMISSION_SET.has(permission as AppPermission)
    ));

    return {
      version: 2,
      userId: candidate.userId,
      companyId: candidate.companyId,
      role: candidate.role,
      source: 'api',
      fetchedAt: candidate.fetchedAt,
      permissions: validPermissions,
    };
  } catch {
    return null;
  }
}

function writeAuthorizationCache(payload: AuthorizationCachePayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(AUTHORIZATION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 접근이 제한된 경우 캐시 저장을 건너뛴다.
  }
}

function hasExplicitPermissionShape(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return true;
  }

  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  if (
    'permissions' in record
    || 'permission' in record
    || 'scopes' in record
    || 'authorities' in record
    || 'routes' in record
    || 'actions' in record
  ) {
    return true;
  }

  if (
    typeof record.data === 'object'
    && record.data !== null
  ) {
    return hasExplicitPermissionShape(record.data);
  }

  return false;
}

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const {
    status: authStatus,
    isBootstrapping: isAuthBootstrapping,
    isAuthenticated,
    user,
    refreshSession,
  } = useAuth();
  const [status, setStatus] = useState<AuthorizationStatus>('checking');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [source, setSource] = useState<AuthorizationSource | null>(null);
  const [permissionList, setPermissionList] = useState<AppPermission[]>([]);
  const lastFocusRefreshAtRef = useRef(0);
  const authorizationRequestSequenceRef = useRef(0);
  const authorizationControllerRef = useRef<AbortController | null>(null);

  const permissionSet = useMemo(
    () => new Set<AppPermission>(permissionList),
    [permissionList],
  );

  const applyResolvedPermissions = useCallback((
    nextPermissions: Set<AppPermission>,
    nextSource: AuthorizationSource,
  ) => {
    setPermissionList(permissionSetToArray(nextPermissions));
    setSource(nextSource);
    setStatus('ready');
    setIsBootstrapping(false);
  }, []);

  const refreshAuthorization = useCallback(async (options?: { force?: boolean }) => {
    if (authStatus === 'checking') {
      authorizationRequestSequenceRef.current += 1;
      authorizationControllerRef.current?.abort();
      authorizationControllerRef.current = null;
      if (isBootstrapping) {
        setStatus('checking');
      }
      return;
    }

    if (!isAuthenticated || !user) {
      authorizationRequestSequenceRef.current += 1;
      authorizationControllerRef.current?.abort();
      authorizationControllerRef.current = null;
      setPermissionList([]);
      setSource(null);
      setStatus('ready');
      setIsBootstrapping(false);
      removeAuthorizationCache();
      return;
    }

    const normalizedUserId = toNormalizedNonEmptyString(user.userId);
    const normalizedCompanyId = toNormalizedNonEmptyString(user.companyId);
    const normalizedRoleValue = toNormalizedNonEmptyString(user.role);
    const normalizedRole = normalizedRoleValue?.toLowerCase() ?? null;
    if (!normalizedUserId || !normalizedRole) {
      authorizationRequestSequenceRef.current += 1;
      authorizationControllerRef.current?.abort();
      authorizationControllerRef.current = null;
      applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
      removeAuthorizationCache();
      return;
    }

    const requestSequence = authorizationRequestSequenceRef.current + 1;
    authorizationRequestSequenceRef.current = requestSequence;
    authorizationControllerRef.current?.abort();
    authorizationControllerRef.current = null;

    if (!options?.force) {
      const cachedPermissions = readAuthorizationCache(
        normalizedUserId,
        normalizedCompanyId,
        normalizedRole,
      );
      if (cachedPermissions) {
        applyResolvedPermissions(new Set<AppPermission>(cachedPermissions.permissions), cachedPermissions.source);
        return;
      }
    }

    if (isBootstrapping) {
      setStatus('checking');
    }
    const controller = new AbortController();
    authorizationControllerRef.current = controller;

    const isStaleRequest = (): boolean => (
      controller.signal.aborted
      || authorizationRequestSequenceRef.current !== requestSequence
      || authorizationControllerRef.current !== controller
    );

    try {
      const permissionsPayload = await getMyPermissions({ signal: controller.signal });
      if (isStaleRequest()) {
        return;
      }

      const parsedPermissions = derivePermissionsFromApiPayload(permissionsPayload);
      const hasPermissionShape = hasExplicitPermissionShape(permissionsPayload);

      if (parsedPermissions.size === 0 && !hasPermissionShape) {
        applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
        removeAuthorizationCache();
        return;
      }

      applyResolvedPermissions(parsedPermissions, 'api');
      if (normalizedCompanyId) {
        writeAuthorizationCache({
          version: 2,
          userId: normalizedUserId,
          companyId: normalizedCompanyId,
          role: normalizedRole,
          source: 'api',
          fetchedAt: Date.now(),
          permissions: permissionSetToArray(parsedPermissions),
        });
      } else {
        removeAuthorizationCache();
      }
    } catch (error) {
      if (isStaleRequest()) {
        return;
      }

      if (error instanceof ApiError && error.code === 'ABORTED') {
        applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
        removeAuthorizationCache();
        return;
      }

      if (error instanceof ApiError) {
        if (error.status === 401) {
          if (isBootstrapping) {
            setStatus('checking');
          }
          try {
            await refreshSession({ silent: !isBootstrapping });
          } catch {
            applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
            removeAuthorizationCache();
          }
          return;
        }

        if (error.status === 403) {
          applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
          removeAuthorizationCache();
          return;
        }

        if (error.status === 404 || error.status === 405) {
          applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
          removeAuthorizationCache();
          return;
        }

        if (
          (typeof error.status === 'number' && error.status >= 500)
          || NETWORK_ERROR_CODES.has(String(error.code))
        ) {
          applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
          removeAuthorizationCache();
          return;
        }
      }

      applyResolvedPermissions(new Set<AppPermission>(), 'deny-by-default');
      removeAuthorizationCache();
    } finally {
      if (authorizationControllerRef.current === controller) {
        authorizationControllerRef.current = null;
      }
    }
  }, [
    applyResolvedPermissions,
    authStatus,
    isBootstrapping,
    isAuthenticated,
    refreshSession,
    user,
  ]);

  useEffect(() => {
    return () => {
      authorizationControllerRef.current?.abort();
      authorizationControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (authStatus === 'checking') {
      authorizationRequestSequenceRef.current += 1;
      authorizationControllerRef.current?.abort();
      authorizationControllerRef.current = null;
      if (isAuthBootstrapping) {
        setStatus('checking');
        setIsBootstrapping(true);
      }
      return;
    }

    if (!isAuthenticated || !user) {
      setPermissionList([]);
      setSource(null);
      setStatus('ready');
      setIsBootstrapping(false);
      removeAuthorizationCache();
      return;
    }

    void refreshAuthorization();
  }, [
    authStatus,
    isAuthBootstrapping,
    isAuthenticated,
    refreshAuthorization,
    user?.companyId,
    user?.role,
    user?.userId,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthenticated) {
      return undefined;
    }

    const runRefreshOnFocus = async () => {
      const now = Date.now();
      if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_MIN_INTERVAL_MS) {
        return;
      }
      lastFocusRefreshAtRef.current = now;
      try {
        await refreshSession({ silent: true });
      } finally {
        await refreshAuthorization({ force: true });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void runRefreshOnFocus();
    };

    const handleFocus = () => {
      void runRefreshOnFocus();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, refreshAuthorization, refreshSession]);

  const hasPermissionValue = useCallback((permission: AppPermission) => {
    return hasPermission(permissionSet, permission);
  }, [permissionSet]);

  const canAccessRoute = useCallback((permission: AppRoutePermission) => {
    return hasPermission(permissionSet, permission);
  }, [permissionSet]);

  const canPerformAction = useCallback((permission: AppActionPermission) => {
    return hasPermission(permissionSet, permission);
  }, [permissionSet]);

  const contextValue = useMemo<AuthorizationContextType>(() => ({
    status,
    isBootstrapping,
    source,
    permissions: permissionSet,
    hasPermission: hasPermissionValue,
    canAccessRoute,
    canPerformAction,
    refreshAuthorization,
  }), [
    canAccessRoute,
    canPerformAction,
    hasPermissionValue,
    isBootstrapping,
    permissionSet,
    refreshAuthorization,
    source,
    status,
  ]);

  return (
    <AuthorizationContext.Provider value={contextValue}>
      {children}
    </AuthorizationContext.Provider>
  );
}

export function useAuthorization(): AuthorizationContextType {
  const context = useContext(AuthorizationContext);
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider');
  }
  return context;
}
