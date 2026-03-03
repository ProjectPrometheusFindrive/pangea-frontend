import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { resolveRoutePermissionForPath, type AppRoutePermission } from '../authorization';
import type { AuthViewRole } from '../../services/auth';
import { PageFallback } from './PageStateBoundary';

interface RequireAuthProps {
  allowedRoles?: AuthViewRole[];
  requiredPermission?: AppRoutePermission;
}

const ROUTE_FORBIDDEN_REDIRECT_PATH = '/forbidden';

export function RequireAuth({ allowedRoles, requiredPermission }: RequireAuthProps) {
  const location = useLocation();
  const { isBootstrapping: isAuthBootstrapping, isAuthenticated, viewRole } = useAuth();
  const {
    isBootstrapping: isAuthorizationBootstrapping,
    source: authorizationSource,
    canAccessRoute,
  } = useAuthorization();
  const isAuthorizationResolving = isAuthenticated && (
    isAuthorizationBootstrapping
    || authorizationSource === null
  );

  if (isAuthBootstrapping || isAuthorizationResolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <PageFallback
          variant="loading"
          title={
            isAuthBootstrapping
              ? '인증 상태를 확인하는 중입니다'
              : '권한 상태를 확인하는 중입니다'
          }
          description="잠시만 기다려 주세요."
          className="w-full max-w-lg bg-white"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (allowedRoles && (!viewRole || !allowedRoles.includes(viewRole))) {
    return <Navigate to={ROUTE_FORBIDDEN_REDIRECT_PATH} replace />;
  }

  const routePermission = requiredPermission ?? resolveRoutePermissionForPath(location.pathname);
  if (routePermission && !canAccessRoute(routePermission)) {
    // Route-level permission denial policy: always move to /forbidden.
    return <Navigate to={ROUTE_FORBIDDEN_REDIRECT_PATH} replace />;
  }

  return <Outlet />;
}
