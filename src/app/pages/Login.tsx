import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { consumeStoredReturnUrl, useAuth } from '../context/AuthContext';
import { ApiError } from '../../services/api';

interface LoginUiError {
  message: string;
  canRetry: boolean;
}

function normalizeReturnUrl(returnUrl: string | null): string {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return '/';
  }
  return returnUrl;
}

function toLoginUiError(error: unknown): LoginUiError {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'UNAUTHORIZED') {
      return { message: '아이디 또는 비밀번호가 올바르지 않습니다.', canRetry: false };
    }
    if (error.status === 429) {
      return { message: '요청이 많습니다. 잠시 후 다시 시도해 주세요.', canRetry: false };
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return { message: '네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.', canRetry: true };
    }
    return { message: error.message || '로그인에 실패했습니다.', canRetry: false };
  }

  if (error instanceof Error) {
    return { message: error.message || '로그인에 실패했습니다.', canRetry: false };
  }

  return { message: '로그인에 실패했습니다.', canRetry: false };
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    status,
    isAuthenticated,
    login,
    error: authError,
    isLoading,
  } = useAuth();

  const returnUrl = useMemo(
    () => normalizeReturnUrl(searchParams.get('returnUrl')),
    [searchParams],
  );

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPayload, setLastPayload] = useState<{ userId: string; password: string } | null>(null);
  const [uiError, setUiError] = useState<LoginUiError | null>(null);

  const isBusy = isSubmitting || isLoading;
  const errorMessage = uiError?.message ?? authError;

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (!reason) {
      return;
    }

    if (reason === 'manual') {
      toast.success('로그아웃되었습니다.');
    } else if (reason === 'expired') {
      toast.info('세션이 만료되어 다시 로그인해 주세요.');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('reason');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-blue-600" />
          <h1 className="text-lg font-semibold text-slate-900">세션을 확인하는 중입니다</h1>
          <p className="mt-1 text-sm text-slate-500">잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={returnUrl} replace />;
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      userId: userId.trim(),
      password,
    };

    if (!payload.userId || !payload.password) {
      setUiError({ message: '아이디와 비밀번호를 입력해 주세요.', canRetry: false });
      return;
    }

    setUiError(null);
    setIsSubmitting(true);
    setLastPayload(payload);

    try {
      await login(payload);
      const storedReturnUrl = consumeStoredReturnUrl();
      const targetPath = returnUrl !== '/' ? returnUrl : storedReturnUrl ?? '/';
      navigate(targetPath, { replace: true });
    } catch (error) {
      setUiError(toLoginUiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!lastPayload) {
      return;
    }

    setUiError(null);
    setIsSubmitting(true);

    try {
      await login(lastPayload);
      const storedReturnUrl = consumeStoredReturnUrl();
      const targetPath = returnUrl !== '/' ? returnUrl : storedReturnUrl ?? '/';
      navigate(targetPath, { replace: true });
    } catch (error) {
      setUiError(toLoginUiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mb-6">
          <p className="text-sm font-medium text-blue-600">Pangea Console</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">로그인</h1>
          <p className="mt-2 text-sm text-slate-500">
            {returnUrl === '/' ? '로그인 후 대시보드로 이동합니다.' : '로그인 후 요청한 페이지로 이동합니다.'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="userId" className="mb-1 block text-sm font-medium text-slate-700">
              아이디
            </label>
            <input
              id="userId"
              data-testid="login-user-id"
              type="text"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={isBusy}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              비밀번호
            </label>
            <input
              id="password"
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={isBusy}
            />
          </div>

          {errorMessage && (
            <div data-testid="login-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            data-testid="login-submit"
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            로그인
          </button>
        </form>

        {uiError?.canRetry && (
          <button
            type="button"
            data-testid="login-retry"
            onClick={handleRetry}
            disabled={isBusy}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
