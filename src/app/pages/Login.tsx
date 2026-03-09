import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { consumeStoredReturnUrl, useAuth } from '../context/AuthContext';
import { ApiError } from '../../services/api';

interface LoginUiError {
  message: string;
  canRetry: boolean;
}

function LoginBrandIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 220"
      className="h-auto w-full max-w-[360px]"
    >
      <defs>
        <linearGradient id="login-road" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.28)" />
        </linearGradient>
      </defs>

      <path
        d="M24 162C88 150 188 148 336 162L336 198C228 184 122 184 24 198Z"
        fill="url(#login-road)"
      />
      <path d="M38 177L56 175" stroke="rgba(255,255,255,0.24)" strokeWidth="3" strokeLinecap="round" />
      <path d="M104 171L122 171" stroke="rgba(255,255,255,0.24)" strokeWidth="3" strokeLinecap="round" />
      <path d="M170 170L188 171" stroke="rgba(255,255,255,0.24)" strokeWidth="3" strokeLinecap="round" />
      <path d="M236 171L254 173" stroke="rgba(255,255,255,0.24)" strokeWidth="3" strokeLinecap="round" />
      <path d="M302 174L320 176" stroke="rgba(255,255,255,0.24)" strokeWidth="3" strokeLinecap="round" />

      <g transform="translate(92 98)">
        <rect x="0" y="26" width="116" height="42" rx="10" fill="#f5f7fb" />
        <path d="M18 26L34 8H86L102 26Z" fill="#d9e2f2" />
        <rect x="18" y="13" width="30" height="22" rx="4" fill="#9eb5dc" />
        <rect x="56" y="13" width="30" height="22" rx="4" fill="#9eb5dc" />
        <circle cx="30" cy="70" r="17" fill="#45618d" />
        <circle cx="30" cy="70" r="8" fill="#243851" />
        <circle cx="92" cy="70" r="17" fill="#45618d" />
        <circle cx="92" cy="70" r="8" fill="#243851" />
        <rect x="2" y="42" width="10" height="7" rx="3.5" fill="#ff6b6b" />
        <rect x="104" y="42" width="10" height="7" rx="3.5" fill="#f6c344" />
      </g>

      <g transform="translate(60 76)">
        <circle cx="0" cy="0" r="8" fill="#9fbaf7" opacity="0.22" />
        <path d="M0 8V28" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="4" fill="#f6c344" />
      </g>
      <g transform="translate(228 54)">
        <circle cx="0" cy="0" r="12" fill="#9fbaf7" opacity="0.22" />
        <path d="M0 12V42" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="6" fill="#f5f7fb" />
      </g>
      <g transform="translate(276 84)">
        <circle cx="0" cy="0" r="10" fill="#9fbaf7" opacity="0.22" />
        <path d="M0 10V32" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="5" fill="#6fd4a6" />
      </g>
    </svg>
  );
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
    <div
      data-testid="login-shell"
      className="min-h-screen bg-[#eef2f6] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]"
    >
      <section
        data-testid="login-brand-panel"
        className="relative overflow-hidden bg-gradient-to-br from-[#0f56dd] via-[#1f4bb2] to-[#13265d] px-6 py-10 text-white sm:px-10 lg:flex lg:min-h-screen lg:items-center lg:px-16"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.08),_transparent_44%)]" />
        <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center text-center lg:items-start lg:text-left">
          <div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Pangea</h1>
            <p className="mt-3 text-base font-medium text-white/80 sm:text-lg">
              차량 관리의 새로운 기준
            </p>
          </div>
          <div className="mt-8 w-full lg:mt-14">
            <LoginBrandIllustration />
          </div>
        </div>
      </section>

      <section
        data-testid="login-form-panel"
        className="flex min-h-[48vh] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-10"
      >
        <div className="w-full max-w-[440px] rounded-[32px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-950">로그인</h2>
            <p className="mt-3 text-sm text-slate-500">
              {returnUrl === '/' ? '로그인 후 대시보드로 이동합니다.' : '로그인 후 요청한 페이지로 이동합니다.'}
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="userId" className="mb-2 block text-sm font-semibold text-slate-700">
                아이디
              </label>
              <input
                id="userId"
                data-testid="login-user-id"
                type="text"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                autoComplete="username"
                placeholder="아이디"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                disabled={isBusy}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                비밀번호
              </label>
              <input
                id="password"
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="비밀번호"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                disabled={isBusy}
              />
            </div>

            {errorMessage && (
              <div data-testid="login-error" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              data-testid="login-submit"
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0f56dd] to-[#2247b9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,86,221,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              로그인
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>또는</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/terms"
              className="inline-flex items-center justify-center rounded-2xl bg-[#e9eef9] px-5 py-3 text-sm font-semibold text-[#2247b9] transition hover:bg-[#dfe8fb]"
            >
              회원가입
            </Link>
          </div>

          {uiError?.canRetry && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                data-testid="login-retry"
                onClick={handleRetry}
                disabled={isBusy}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                다시 시도
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
