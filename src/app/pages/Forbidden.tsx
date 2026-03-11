import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShieldAlert } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { resolveDefaultLandingPath } from '../../services/auth';

const REDIRECT_DELAY_SECONDS = 3;

export default function Forbidden() {
  const { viewRole } = useAuth();
  const navigate = useNavigate();
  const defaultLandingPath = resolveDefaultLandingPath(viewRole);
  const [countdownSeconds, setCountdownSeconds] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    setCountdownSeconds(REDIRECT_DELAY_SECONDS);

    const redirectTimeout = window.setTimeout(() => {
      navigate(defaultLandingPath, { replace: true });
    }, REDIRECT_DELAY_SECONDS * 1000);

    const countdownInterval = window.setInterval(() => {
      setCountdownSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(countdownInterval);
          return 1;
        }
        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimeout);
      window.clearInterval(countdownInterval);
    };
  }, [defaultLandingPath, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">접근 권한이 없습니다</h1>
        <p className="mt-2 text-sm text-slate-500">
          현재 계정 권한으로는 요청한 화면에 접근할 수 없습니다.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-600">
          {countdownSeconds}초 후 접근 가능한 초기 화면으로 자동 이동합니다.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to={defaultLandingPath}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
