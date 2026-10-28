import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { postForgotPassword, postResetPassword } from '../../services/auth';

export default function AccountRecovery() {
  const { pathname } = useLocation();
  const isReset = pathname === '/reset-password';
  const isHelp = pathname === '/forgot-id';
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    if (isReset) window.history.replaceState(null, '', window.location.pathname);
    return () => meta.remove();
  }, [isReset]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (isReset && (password !== confirm || !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password) || password !== password.trim())) {
      setError(password !== confirm ? '비밀번호가 일치하지 않습니다.' : '영문과 숫자를 포함한 8~128자로 입력해주세요. 앞뒤 공백은 사용할 수 없습니다.');
      return;
    }
    setBusy(true);
    try {
      const result = isReset ? await postResetPassword(token, password) : await postForgotPassword(email);
      setMessage(result.message);
      if (isReset) { setDone(true); setPassword(''); setConfirm(''); }
      else setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다. 다시 시도해주세요.');
    } finally { setBusy(false); }
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 p-3';
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">{isHelp ? '가입 이메일을 잊으셨나요?' : isReset ? (done ? '비밀번호 변경 완료' : '새 비밀번호 설정') : '비밀번호 재설정'}</h1>
        {isHelp ? <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
          <p>Pangea 아이디는 가입할 때 사용한 이메일입니다.</p>
          <p>사용 중인 메일함에서 Pangea 또는 Prometheus 가입·초대 메일을 찾아보세요.</p>
          <p>이메일을 찾을 수 없거나 메일함에 접근할 수 없다면 소속 회사 관리자에게 문의해주세요. 회사 관리자를 통해 Pangea 운영자에게 계정 확인을 요청할 수 있습니다.</p>
          <p>관리자는 기존에 등록된 연락 수단 등으로 본인을 확인한 후 계정을 안내합니다.</p>
          <Link className="block text-blue-700 underline" to="/forgot-password">가입 이메일을 알고 있어요</Link>
        </div> : <>
          {!done && <p className="mt-4 text-sm leading-6 text-slate-600">{isReset ? '영문과 숫자를 포함해 8~128자로 설정해주세요. 변경 후 모든 기기에서 다시 로그인해야 합니다.' : '가입 이메일로 15분 동안 사용할 수 있는 재설정 링크를 보내드립니다. 새 비밀번호를 설정하기 전까지 기존 비밀번호는 유지됩니다.'}</p>}
          {isReset && !token && <p role="alert" className="mt-4 text-red-700">재설정 링크가 없습니다. 메일의 링크를 다시 열거나 새 링크를 요청해주세요.</p>}
          {!done && (!isReset || token) && <form onSubmit={submit} className="mt-6 space-y-4">
            {isReset ? <>
              <label className="block text-sm">새 비밀번호<input className={inputClass} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
              <label className="block text-sm">새 비밀번호 확인<input className={inputClass} type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} /></label>
            </> : <label className="block text-sm">가입 이메일<input className={inputClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>}
            <button className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white disabled:opacity-50" disabled={busy || cooldown > 0}>{busy ? '처리 중…' : isReset ? '비밀번호 변경' : cooldown ? `${cooldown}초 후 재발송 가능` : '재설정 메일 보내기'}</button>
          </form>}
          {message && <p role="status" className="mt-4 text-sm text-green-800">{message}</p>}
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          {isReset && !done && <Link className="mt-4 block text-sm text-blue-700 underline" to="/forgot-password">새 링크 요청</Link>}
          {!isReset && <><p className="mt-4 text-sm text-slate-600">메일이 오지 않으면 스팸함을 확인해주세요.</p><Link className="mt-4 block text-sm text-blue-700 underline" to="/forgot-id">가입 이메일을 잊으셨나요?</Link></>}
        </>}
        <Link to="/login" className="mt-6 block text-center text-sm text-blue-700 underline">로그인으로 돌아가기</Link>
      </section>
    </main>
  );
}
