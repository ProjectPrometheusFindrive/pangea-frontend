import { Navigate, Outlet, useLocation } from 'react-router';
import { rememberReturnUrl, useAuth } from '../context/AuthContext';

export function AuthRequiredRoute() {
  const location = useLocation();
  const { status, isAuthenticated } = useAuth();

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 text-sm text-gray-600 shadow-sm">
          세션 정보를 확인하고 있습니다...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    rememberReturnUrl(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
