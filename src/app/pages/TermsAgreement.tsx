import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  DEFAULT_SIGNUP_AGREEMENTS,
  hasRequiredSignupAgreements,
  loadSignupAgreementState,
  saveSignupAgreementState,
  type SignupAgreementState,
} from './signupAgreementState';
import { buildSignupRouteWithSearch } from './signupInvitationMode';
import { locationHtml, marketingHtml, privacyHtml } from './terms/termsContent';

type AgreementKey = 'privacy' | 'location' | 'marketing';

interface AgreementDefinition {
  key: AgreementKey;
  title: string;
  required: boolean;
  html: string;
}


const AGREEMENT_DEFINITIONS: AgreementDefinition[] = [
  { key: 'privacy',   title: '개인정보 처리방침 동의', required: true,  html: privacyHtml },
  { key: 'location',  title: '위치정보 이용약관 동의', required: true,  html: locationHtml },
  { key: 'marketing', title: '마케팅 정보 수신 동의',  required: false, html: marketingHtml },
];

function toEditableAgreements(state: SignupAgreementState): Omit<SignupAgreementState, 'agreedAt'> {
  return {
    privacy: state.privacy,
    location: state.location,
    marketing: state.marketing,
  };
}

export default function TermsAgreement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [agreements, setAgreements] = useState<Omit<SignupAgreementState, 'agreedAt'>>(() =>
    toEditableAgreements(loadSignupAgreementState()),
  );

  const allAgreed = useMemo(
    () => agreements.privacy && agreements.location && agreements.marketing,
    [agreements.location, agreements.marketing, agreements.privacy],
  );

  const canProceed = useMemo(
    () => hasRequiredSignupAgreements({ ...agreements, agreedAt: null }),
    [agreements],
  );

  const toggleAgreement = (key: AgreementKey) => {
    setAgreements((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const toggleAllAgreements = () => {
    setAgreements((previous) => {
      const shouldCheck = !(previous.privacy && previous.location && previous.marketing);
      return {
        ...previous,
        privacy: shouldCheck,
        location: shouldCheck,
        marketing: shouldCheck,
      };
    });
  };

  const handleNext = () => {
    if (!canProceed) {
      toast.warning('필수 약관에 동의해 주세요.');
      return;
    }

    saveSignupAgreementState({
      ...DEFAULT_SIGNUP_AGREEMENTS,
      ...agreements,
      agreedAt: new Date().toISOString(),
    });
    navigate(buildSignupRouteWithSearch(location.search));
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      <aside className="hidden w-80 border-r border-slate-200 bg-slate-900/95 p-8 text-slate-100 lg:block">
        <p className="text-sm font-medium uppercase tracking-wider text-blue-300">Pangea Console</p>
        <h1 className="mt-4 text-3xl font-bold">회원가입</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">서비스 이용을 위해 약관 동의 단계를 진행해 주세요.</p>

        <ol className="mt-10 space-y-4">
          <li className="flex items-center gap-3 rounded-lg bg-blue-600/20 px-3 py-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold">1</span>
            <span className="text-sm font-medium">약관 동의</span>
          </li>
          <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500 text-sm font-semibold">2</span>
            <span className="text-sm">정보 입력</span>
          </li>
          <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500 text-sm font-semibold">3</span>
            <span className="text-sm">가입 완료</span>
          </li>
        </ol>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <section className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Step 1</p>
              <h2 className="text-2xl font-bold text-slate-900">약관 동의</h2>
              <p className="mt-1 text-sm text-slate-500">필수 약관에 동의해야 다음 단계로 진행할 수 있으며, 전체 동의를 선택하면 마케팅 수신 동의까지 함께 적용됩니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllAgreements}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                {allAgreed ? '전체 동의 해제' : '전체 동의'}
              </button>
            </div>
          </header>

          <div className="space-y-4">
            {AGREEMENT_DEFINITIONS.map((agreement) => {
              const checked = agreements[agreement.key];
              return (
                <article
                  key={agreement.key}
                  className={`rounded-xl border ${checked ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
                    <input
                      id={`agreement-${agreement.key}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgreement(agreement.key)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <label htmlFor={`agreement-${agreement.key}`} className="cursor-pointer text-sm font-semibold text-slate-800">
                      {agreement.title}
                    </label>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                      agreement.required ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                    }`}
                    >
                      {agreement.required ? '필수' : '선택'}
                    </span>
                  </div>
                  <div
                    className="
                      max-h-48 overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-600
                      [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-xs [&_h1]:font-semibold [&_h1]:text-slate-700
                      [&_p]:my-0.5
                      [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                      [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
                      [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1
                    "
                    dangerouslySetInnerHTML={{ __html: agreement.html }}
                  />
                </article>
              );
            })}
          </div>

          <footer className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              다음 단계
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}
