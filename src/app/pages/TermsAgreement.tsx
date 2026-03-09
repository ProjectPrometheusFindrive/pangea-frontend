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

type AgreementKey = 'privacy' | 'location' | 'marketing';

interface AgreementDefinition {
  key: AgreementKey;
  title: string;
  required: boolean;
  body: string[];
}

const AGREEMENT_DEFINITIONS: AgreementDefinition[] = [
  {
    key: 'privacy',
    title: '개인정보 처리방침 동의',
    required: true,
    body: [
      '서비스 회원가입 및 관리, 본인 확인, 계약 체결과 유지, 요금 정산을 위해 이름, 휴대전화번호, 이메일, 회사명, 사업자등록번호 등 필수 정보를 수집합니다.',
      '차량 배차, 예약 운영, 고객 상담, 세금계산서 발행, 장애 대응을 위해 수집된 정보를 내부 운영 시스템과 고객 지원 채널에서 처리할 수 있습니다.',
      '관련 법령 또는 회사 정책에서 정한 보관기간이 끝나면 지체 없이 파기하며, 분쟁 대응이나 법적 의무가 있는 경우에만 필요한 범위로 별도 보관합니다.',
    ],
  },
  {
    key: 'location',
    title: '위치정보 이용약관 동의',
    required: true,
    body: [
      '차량 관제, 도난·분실 대응, 운행기록 분석, 사고 대응, 반납 위치 확인, 운영 품질 개선을 위해 차량 및 단말의 위치정보가 처리될 수 있습니다.',
      '수집된 위치정보는 서비스 제공 목적 범위 안에서만 사용되며, 법령상 보존 의무 또는 고객 요청이 없는 경우 목적 달성 후 안전하게 삭제합니다.',
      '이용자는 관계 법령이 허용하는 범위에서 위치정보 제공 동의를 철회하거나 열람을 요청할 수 있습니다.',
    ],
  },
  {
    key: 'marketing',
    title: '마케팅 정보 수신 동의',
    required: false,
    body: [
      '프로모션, 이벤트, 신규 기능, 제휴 혜택, 운영 노하우, 상품 추천 안내를 이메일 또는 문자메시지로 받아보는 데 대한 동의입니다.',
      '마케팅 정보 수신 동의 시 서비스와 관련된 개별 안내 채널의 마케팅 메시지 수신에도 함께 동의한 것으로 처리될 수 있습니다.',
      '선택 항목이며 동의하지 않아도 서비스 이용은 가능하고, 수신 후에도 언제든지 수신 동의를 철회할 수 있습니다.',
    ],
  },
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
                  <div className="space-y-2 px-4 py-3 text-sm leading-6 text-slate-600">
                    {agreement.body.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
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
