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
      'Pangea 개인정보처리방침 (시행일자: 2026년 1월 12일)',
      '플로(이하 "회사")는 「개인정보보호법」, 「정보통신망법」, 「신용정보법」, 「위치정보법」 등 관련 법령을 준수하며 이용자의 개인정보를 안전하게 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.',
      '[제1조 수집 항목] 회원 가입 시 이름(또는 상호명), 연락처, 이메일, 사업자등록번호(필수), 직책·부서·회사 주소(선택). 차량 관리 시 차량번호·차종·연식·등록일·정비이력, GPS 위치정보·주행거리·속도·운전행태정보, 단말기 식별번호·통신사 정보·펌웨어 버전. 금융서비스 이용 시 사업자 매출정보·재무정보·차량담보 정보(필수).',
      '[제2조 이용 목적] 서비스 제공 및 관리(차량자산 관리, 운행기록, 정비관리), 위치기반 서비스(도난방지, 실시간 모니터링), 금융·보험 중개(대출한도 산출, 보험요율 제안), 고객 상담 및 민원 처리, 서비스 개선, 법령상 의무이행 및 분쟁 대응.',
      '[제3조 보유 기간] 회원정보: 탈퇴 시까지. 운행/위치정보: 수집일로부터 1년 후 파기. 거래정보(금융·보험): 관련 법령에 따른 보존기간(예: 5년). 법령상 의무이행 또는 분쟁 해결 필요 시 별도 보관.',
      '[제4조 제3자 제공] 원칙적으로 외부 제공 없음. 예외: 이용자 사전 동의, 제휴 금융기관·보험사·정비업체와의 연계 서비스 제공, 법령에 근거한 수사기관 등의 요청.',
      '[제5조 처리 위탁] Google Inc — 시스템 인프라 운영 및 데이터 보관 (위탁계약 종료 시까지). Geotab/단말 공급사 — 차량 단말기 연동 및 유지보수 (서비스 종료 시까지).',
      '[제6조 파기] 보유기간 경과 또는 처리 목적 달성 시 즉시 파기. 전자파일은 복구 불가능한 기술적 방법으로 삭제, 문서는 분쇄 또는 소각.',
      '[제7조 이용자 권리] 개인정보의 조회, 수정, 삭제, 처리정지 요청 가능. 고객센터 또는 이메일(prometheus.rok@gmail.com)로 접수.',
      '[제8조 안전성 확보] 접근권한 관리 및 최소화, 데이터 암호화 및 접근기록 보관, 보안프로그램 설치 및 정기 점검, 내부관리계획 수립 및 교육 실시.',
      '[제9조 개인위치정보] 위치정보 이용목적: 차량위치 조회, 도난방지, 운행경로 분석. 보유기간: 1년 후 파기. 이용자는 동의를 철회할 수 있습니다.',
      '[제10조 개인정보 보호책임자] 엄주석 · prometheus.rok@gmail.com',
      '[제11조 고지] 본 방침은 법령·정책·보안기술 변경에 따라 내용이 변경될 수 있으며, 변경 시 회사 웹사이트에 공지합니다.',
    ],
  },
  {
    key: 'location',
    title: '위치정보 이용약관 동의',
    required: true,
    body: [
      'Pangea 위치정보이용약관 (시행일자: 2026년 1월 12일)',
      '플로(이하 "회사")는 「위치정보의 보호 및 이용 등에 관한 법률」에 따라 이용자의 위치정보를 안전하게 관리하고 관련 권리를 보호하기 위하여 본 약관을 제정합니다.',
      '[제1조 목적] 회사가 제공하는 위치기반서비스와 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정합니다.',
      '[제2조 정의] "서비스"란 차량 단말기 또는 모바일 기기를 통해 수집된 위치정보를 이용하는 ① 차량 위치 조회 및 주행이력 확인 ② 도난방지·운행경로 모니터링 ③ 운전행태 분석 및 보험·금융 연계 서비스 ④ 기타 Fleet Management 기능을 말합니다.',
      '[제3조 이용 목적] 차량 단말: 실시간 위치 조회·도난방지·운행점수 분석. ERP/FMS 플랫폼: 운행이력 조회·리스크 스코어링·차량 관리. 제휴 금융·보험사: 운전행태 기반 신용·보험상품 제안. 데이터 분석: 통계·가명처리 데이터 생성 및 서비스 고도화.',
      '[제4조 수집 방법] 차량에 장착된 단말기를 통해 GPS·셀룰러·Wi-Fi 신호 등의 방식으로 수집. 고객 요청 시 소정의 절차를 거쳐 비활성화하거나 동의를 철회할 수 있습니다.',
      '[제5조 보유 기간] 목적 달성 후 또는 동의 철회 시 즉시 파기. 운행기록 등 서비스 이용기록: 1년. 위치정보 이용·제공사실 확인자료: 6개월 (위치정보법 제16조 제2항).',
      '[제6조 제3자 제공] 동의 없이 개인위치정보 제3자 미제공. 동의 시 제공 대상: 제휴 보험사(UBI 기반 요율 산정), 제휴 금융기관(금융서비스 중개), 정비업체/MRO 네트워크(정비 예약·주행거리 검증). 이용자는 언제든지 제3자 제공 동의를 철회할 수 있습니다.',
      '[제7조 확인자료 보유] 위치정보 이용·제공사실 확인자료를 6개월간 보관합니다 (위치정보법 제16조 제2항).',
      '[제8조 이용자 권리] ① 위치정보 이용·제공사실 열람 및 고지 요구 ② 동의 철회 ③ 수집 중단 또는 삭제 요청. 이메일: prometheus.rok@gmail.com',
      '[제9조 법정대리인 권리] 14세 미만 아동으로부터 개인위치정보를 수집하지 않습니다. 부득이한 경우 법정대리인의 사전 동의를 얻습니다.',
      '[제11조 개인위치정보 보호책임자] 엄주석 · prometheus.rok@gmail.com',
      '[제14조 약관 변경] 변경 최소 7일 전(이용자에게 불리한 경우 30일 전) 웹사이트를 통해 공지합니다.',
    ],
  },
  {
    key: 'marketing',
    title: '마케팅 정보 수신 동의',
    required: false,
    body: [
      '마케팅 정보 수신 동의서 (시행일자: 2026년 1월 12일)',
      '본 동의는 선택 사항으로, 동의를 거부하시더라도 Pangea 서비스 이용에는 아무런 제한이 없습니다.',
      '[제1조 수집 항목] 필수: 이름(또는 상호명), 이메일 주소, 연락처(휴대폰 번호). 선택: 회사명, 보유 차량 수, 직책.',
      '[제2조 이용 목적] Pangea 서비스 신규 기능 출시 및 업데이트 안내. 이벤트·프로모션·할인 혜택 정보 제공. 렌터카·모빌리티 업계 동향 및 교육 자료 제공. 서비스 만족도 조사 및 설문 참여 안내. 제휴 서비스(금융, 보험, 단말 등) 관련 안내.',
      '[제3조 보유 기간] 동의일로부터 이용계약 종료 후 1년까지 보관(재동의 시 연장). 동의 철회 시 수신 거부 처리일로부터 30일 이내 발송 중단 및 개인정보 파기.',
      '[제4조 수신 채널] 이메일: 뉴스레터·신기능 안내·이벤트·프로모션 정보. SMS/MMS/카카오톡: 주요 업데이트 알림·파일럿 신청 안내·할인 혜택 안내.',
      '[제5조 제3자 제공 및 처리 위탁] 마케팅 목적으로 수집한 개인정보를 외부에 제공하지 않습니다. 처리 위탁: Google Inc. — 시스템 인프라 운영 및 데이터 보관.',
      '[제6조 거부 권리] 동의를 거부하더라도 Pangea 서비스 이용에 불이익 없음. 단, 거부 시 신규 기능 출시 안내·이벤트·할인 혜택 등 마케팅 정보를 받을 수 없습니다.',
      '[제7조 개인정보 보호책임자] 엄주석 · prometheus.rok@gmail.com',
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
                  <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-600">
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
