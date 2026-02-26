import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { consumeStoredReturnUrl, useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, error, isLoading, isAuthenticated } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = consumeStoredReturnUrl();
      navigate(returnUrl ?? '/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    try {
      await login({ userId, password });
    } catch {
      setSubmitError('로그인에 실패했습니다. 아이디/비밀번호를 확인해 주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
        <p className="mt-1 text-sm text-gray-500">세션이 만료된 경우 다시 로그인해 주세요.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="userId">
              아이디
            </label>
            <input
              id="userId"
              type="text"
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              required
            />
          </div>

          {(submitError || error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError ?? error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
