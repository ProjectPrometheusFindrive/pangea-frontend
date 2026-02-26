import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../context/AuthContext';
import type { AuthViewRole } from '../../services/auth';
import { PageFallback } from './PageStateBoundary';

interface RequireAuthProps {
  allowedRoles?: AuthViewRole[];
}

export function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const location = useLocation();
  const { status, isAuthenticated, viewRole } = useAuth();

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <PageFallback
          variant="loading"
          title="인증 상태를 확인하는 중입니다"
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
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
