import { Link } from 'react-router';
import { ShieldAlert } from 'lucide-react';

export default function Forbidden() {
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
        <div className="mt-6 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
