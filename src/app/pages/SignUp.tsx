import { FocusEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { postRegister, getCheckUserId } from '../../services/auth';
import { ApiError } from '../../services/api';
import { postAcceptInvitation } from '../../services/invitations';
import { toInvitationRoleLabel } from './settingsInvitations';
import {
  clearSignupAgreementState,
  hasRequiredSignupAgreements,
  loadSignupAgreementState,
  type SignupAgreementState,
} from './signupAgreementState';
import {
  buildInvitationAcceptPayload,
  decodeInvitationToken,
  extractInvitationToken,
  validateInvitationAwareSignUpForm,
} from './signupInvitationMode';

type PositionType = string;

interface SignUpFormState {
  userId: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  email: string;
  position: PositionType;
  company: string;
  bizRegNo: string;
}

type SignUpField = keyof SignUpFormState;
type SignUpErrors = Partial<Record<SignUpField, string>>;

interface UserIdCheckState {
  checking: boolean;
  checkedUserId: string | null;
  available: boolean | null;
  message: string | null;
}

const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

const INITIAL_FORM: SignUpFormState = {
  userId: '',
  password: '',
  confirmPassword: '',
  name: '',
  phone: '010-',
  email: '',
  position: '',
  company: '',
  bizRegNo: '',
};

const INITIAL_USER_ID_CHECK: UserIdCheckState = {
  checking: false,
  checkedUserId: null,
  available: null,
  message: null,
};

function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) {
    return '010-';
  }
  if (digits.length <= 3) {
    return `${digits}-`;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizeBizRegNoInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeBizRegNoDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

function buildTouchedAll(): Record<SignUpField, boolean> {
  return {
    userId: true,
    password: true,
    confirmPassword: true,
    name: true,
    phone: true,
    email: true,
    position: true,
    company: true,
    bizRegNo: true,
  };
}

function toSignUpErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return '이미 사용 중인 아이디입니다. 다른 이메일을 사용해 주세요.';
    }
    if (error.status === 403) {
      return error.message || '가입 권한이 없는 요청입니다.';
    }
    if (error.status === 400) {
      return error.message || '입력값 검증에 실패했습니다. 항목을 다시 확인해 주세요.';
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
    return error.message || '회원가입 처리 중 오류가 발생했습니다.';
  }

  if (error instanceof Error) {
    return error.message || '회원가입 처리 중 오류가 발생했습니다.';
  }

  return '회원가입 처리 중 오류가 발생했습니다.';
}

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState<SignUpFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [touched, setTouched] = useState<Partial<Record<SignUpField, boolean>>>({});
  const [agreements, setAgreements] = useState<SignupAgreementState>(() => loadSignupAgreementState());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [userIdCheck, setUserIdCheck] = useState<UserIdCheckState>(INITIAL_USER_ID_CHECK);

  const invitationToken = useMemo(() => extractInvitationToken(location.search), [location.search]);
  const invitationClaims = useMemo(() => decodeInvitationToken(invitationToken), [invitationToken]);
  const invitationEmail = invitationClaims.email ? normalizeEmail(invitationClaims.email) : null;
  const invitationRole = invitationClaims.role ?? null;
  const isInvitationMode = Boolean(invitationToken && invitationEmail);
  const isInstallerInvitation = isInvitationMode && invitationClaims.role === 'installer';
  const invitationCompanyName = invitationClaims.companyName || invitationClaims.companyId || '';
  const invitationRoleValue = invitationClaims.role || '';
  const normalizedUserId = useMemo(() => normalizeEmail(form.userId), [form.userId]);

  useEffect(() => {
    const latestAgreements = loadSignupAgreementState();
    setAgreements(latestAgreements);

    if (!hasRequiredSignupAgreements(latestAgreements)) {
      toast.warning('회원가입을 위해 먼저 필수 약관 동의가 필요합니다.');
      navigate({ pathname: '/terms', search: location.search }, { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!isInvitationMode || !invitationEmail) {
      return;
    }
    setForm((previous) => ({
      ...previous,
      userId: invitationEmail,
      email: invitationEmail,
      company: previous.company || invitationClaims.companyName || invitationClaims.companyId || '',
    }));
    setUserIdCheck({
      checking: false,
      checkedUserId: invitationEmail,
      available: true,
      message: null,
    });
  }, [invitationClaims.companyId, invitationClaims.companyName, invitationEmail, isInvitationMode]);

  useEffect(() => {
    if (isInvitationMode || !userIdCheck.checkedUserId) {
      return;
    }
    if (userIdCheck.checkedUserId !== normalizedUserId) {
      setUserIdCheck(INITIAL_USER_ID_CHECK);
    }
  }, [isInvitationMode, normalizedUserId, userIdCheck.checkedUserId]);

  const completedFields = useMemo(() => {
    let count = 0;
    if (!isInvitationMode && /.+@.+\..+/.test(normalizedUserId)) count += 1;
    if (form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password)) count += 1;
    if (form.confirmPassword && form.confirmPassword === form.password) count += 1;
    if (form.name.trim()) count += 1;
    if (PHONE_REGEX.test(form.phone)) count += 1;
    if ((isInvitationMode && invitationEmail) || /.+@.+\..+/.test(normalizeEmail(form.email))) count += 1;
    if (!isInstallerInvitation && form.position) count += 1;
    if (!isInvitationMode && form.company.trim()) count += 1;
    if (!isInvitationMode && normalizeBizRegNoDigits(form.bizRegNo).length === 10) count += 1;
    return count;
  }, [form, invitationEmail, isInstallerInvitation, isInvitationMode, normalizedUserId]);

  const totalProgressFields = isInstallerInvitation ? 5 : isInvitationMode ? 6 : 9;
  const progress = Math.round((completedFields / totalProgressFields) * 100);

  const handleFieldChange = (field: SignUpField, value: string) => {
    const nextValue = field === 'phone'
      ? normalizePhoneInput(value)
      : field === 'bizRegNo'
        ? normalizeBizRegNoInput(value)
        : value;
    const nextForm = {
      ...form,
      [field]: nextValue,
    };

    setForm((previous) => ({
      ...previous,
      [field]: nextValue,
    }));

    if (field === 'bizRegNo') {
      setTouched((previous) => ({ ...previous, bizRegNo: true }));
      const bizRegNoError = validateInvitationAwareSignUpForm(nextForm, { invitationEmail, invitationRole }).bizRegNo;
      setErrors((previous) => ({
        ...previous,
        bizRegNo: bizRegNoError,
      }));
      return;
    }

    if (touched[field]) {
      setErrors((previous) => ({
        ...previous,
        [field]: undefined,
      }));
    }
  };

  const handleBlur = (field: SignUpField) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
    const validationErrors = validateInvitationAwareSignUpForm(form, { invitationEmail, invitationRole });
    setErrors((previous) => ({
      ...previous,
      [field]: validationErrors[field],
    }));
  };

  const handlePhoneFocus = (event: FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    window.requestAnimationFrame(() => {
      if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  };

  const handleCheckUserId = async () => {
    if (isInvitationMode) {
      return;
    }
    const userIdError = validateInvitationAwareSignUpForm(form, { invitationEmail, invitationRole }).userId;
    setTouched((previous) => ({ ...previous, userId: true }));

    if (userIdError) {
      setErrors((previous) => ({ ...previous, userId: userIdError }));
      return;
    }

    setServerError(null);
    setUserIdCheck({
      checking: true,
      checkedUserId: null,
      available: null,
      message: null,
    });

    try {
      const result = await getCheckUserId(normalizedUserId);
      if (result.available) {
        setUserIdCheck({
          checking: false,
          checkedUserId: normalizedUserId,
          available: true,
          message: '사용 가능한 아이디입니다.',
        });
        toast.success('사용 가능한 아이디입니다.');
      } else {
        setUserIdCheck({
          checking: false,
          checkedUserId: normalizedUserId,
          available: false,
          message: '이미 사용 중인 아이디입니다.',
        });
        toast.error('이미 사용 중인 아이디입니다.');
      }
    } catch (error) {
      setUserIdCheck({
        checking: false,
        checkedUserId: null,
        available: null,
        message: '중복 확인 중 오류가 발생했습니다.',
      });
      setServerError(toSignUpErrorMessage(error));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const validationErrors = validateInvitationAwareSignUpForm(form, { invitationEmail, invitationRole });
    setErrors(validationErrors);
    setTouched(buildTouchedAll());
    if (Object.keys(validationErrors).length > 0) {
      toast.warning('입력 항목을 다시 확인해 주세요.');
      return;
    }

    if (!hasRequiredSignupAgreements(agreements)) {
      toast.warning('필수 약관 동의가 필요합니다.');
      navigate({ pathname: '/terms', search: location.search });
      return;
    }

    if (!isInvitationMode && (userIdCheck.checkedUserId !== normalizedUserId || userIdCheck.available !== true)) {
      setErrors((previous) => ({
        ...previous,
        userId: '아이디 중복 확인을 완료해 주세요.',
      }));
      setTouched((previous) => ({ ...previous, userId: true }));
      toast.warning('아이디 중복 확인을 먼저 진행해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isInvitationMode) {
        if (!invitationToken) {
          throw new Error('유효한 초대 토큰이 없습니다.');
        }
        await postAcceptInvitation(invitationToken, buildInvitationAcceptPayload(form));
      } else {
        await postRegister({
          userId: normalizedUserId,
          password: form.password,
          name: form.name.trim(),
          phone: form.phone,
          email: normalizeEmail(form.email),
          position: form.position,
          company: form.company.trim(),
          companyName: form.company.trim(),
          bizRegNo: normalizeBizRegNoDigits(form.bizRegNo),
          role: form.position === '대표' ? 'admin' : 'member',
          agreements: {
            privacy: agreements.privacy,
            location: agreements.location,
            marketing: agreements.marketing,
            agreedAt: agreements.agreedAt ?? new Date().toISOString(),
          },
        });
      }
      clearSignupAgreementState();
      setIsSuccess(true);
      toast.success(isInvitationMode ? '초대 수락이 완료되었습니다.' : '회원가입이 완료되었습니다.');
    } catch (error) {
      setServerError(toSignUpErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-medium text-blue-600">{isInvitationMode ? '초대 수락 완료' : '회원가입 완료'}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {isInvitationMode ? '계정 생성이 완료되었습니다.' : '가입 요청이 접수되었습니다.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {isInvitationMode ? '이제 바로 로그인할 수 있습니다.' : '관리자 승인 후 로그인할 수 있습니다.'}
            {!isInvitationMode && (
              <>
                <br />
                승인 상태는 등록한 이메일로 안내됩니다.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            로그인 화면으로 이동
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      <aside className="hidden w-80 border-r border-slate-200 bg-slate-900/95 p-8 text-slate-100 lg:block">
        <p className="text-sm font-medium uppercase tracking-wider text-blue-300">Pangea Console</p>
        <h1 className="mt-4 text-3xl font-bold">{isInvitationMode ? '팀 초대 수락' : '회원가입'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {isInvitationMode ? '초대받은 계정 정보를 확인하고 비밀번호를 설정해 가입을 완료합니다.' : '기본 정보와 회사 정보를 입력해 가입 요청을 제출합니다.'}
        </p>

        <ol className="mt-10 space-y-4">
          <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">✓</span>
            <span className="text-sm">약관 동의</span>
          </li>
          <li className="flex items-center gap-3 rounded-lg bg-blue-600/20 px-3 py-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold">2</span>
            <span className="text-sm font-medium">정보 입력</span>
          </li>
          <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500 text-sm font-semibold">3</span>
            <span className="text-sm">가입 완료</span>
          </li>
        </ol>

        <div className="mt-10 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-300">입력 진행률</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-blue-200">{progress}%</p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <header className="mb-6">
            <p className="text-sm font-medium text-blue-600">Step 2</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{isInvitationMode ? '초대 정보 확인' : '기본 정보 입력'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isInvitationMode
                ? '초대된 이메일과 회사는 고정되며, 나머지 기본 정보만 입력하면 됩니다.'
                : '모든 필수 항목을 입력하고 아이디 중복 확인을 완료해 주세요.'}
            </p>
          </header>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold">약관 동의 상태</p>
            <p className="mt-1">
              개인정보: {agreements.privacy ? '동의' : '미동의'} / 위치정보: {agreements.location ? '동의' : '미동의'} / 마케팅: {agreements.marketing ? '동의' : '미동의'}
            </p>
          </div>

          {isInvitationMode && (
            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">초대 정보</p>
              <p className="mt-1">이메일: {invitationEmail}</p>
              <p className="mt-1">회사: {invitationCompanyName || '-'}</p>
              <p className="mt-1">역할: {invitationRoleValue || '-'}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isInvitationMode && (
              <div>
              <label htmlFor="signup-user-id" className="mb-1 block text-sm font-medium text-slate-700">
                아이디(이메일)
              </label>
              <div className="flex gap-2">
                <input
                  id="signup-user-id"
                  type="email"
                  value={form.userId}
                  onChange={(event) => handleFieldChange('userId', event.target.value)}
                  onBlur={() => handleBlur('userId')}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="user@example.com"
                  autoComplete="username"
                />
                <button
                  type="button"
                  onClick={handleCheckUserId}
                  disabled={isSubmitting || userIdCheck.checking}
                  className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {userIdCheck.checking ? '확인 중...' : '중복 확인'}
                </button>
              </div>
              {touched.userId && errors.userId && <p className="mt-1 text-sm text-red-600">{errors.userId}</p>}
              {!errors.userId && userIdCheck.message && (
                <p className={`mt-1 text-sm ${userIdCheck.available ? 'text-emerald-600' : 'text-red-600'}`}>
                  {userIdCheck.message}
                </p>
              )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-700">
                  비밀번호
                </label>
                <input
                  id="signup-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => handleFieldChange('password', event.target.value)}
                  onBlur={() => handleBlur('password')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoComplete="new-password"
                />
                {touched.password && errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="signup-password-confirm" className="mb-1 block text-sm font-medium text-slate-700">
                  비밀번호 확인
                </label>
                <input
                  id="signup-password-confirm"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => handleFieldChange('confirmPassword', event.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoComplete="new-password"
                />
                {touched.confirmPassword && errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="signup-name" className="mb-1 block text-sm font-medium text-slate-700">
                  이름
                </label>
                <input
                  id="signup-name"
                  type="text"
                  value={form.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  onBlur={() => handleBlur('name')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {touched.name && errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="signup-phone" className="mb-1 block text-sm font-medium text-slate-700">
                  전화번호
                </label>
                <input
                  id="signup-phone"
                  type="text"
                  value={form.phone}
                  onChange={(event) => handleFieldChange('phone', event.target.value)}
                  onFocus={handlePhoneFocus}
                  onBlur={() => handleBlur('phone')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                />
                {touched.phone && errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              </div>
            </div>

            <div className={`grid gap-4 ${isInvitationMode ? '' : 'md:grid-cols-2'}`}>
              <div>
                <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slate-700">
                  {isInvitationMode ? '초대 이메일' : '개인 이메일'}
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => handleFieldChange('email', event.target.value)}
                  onBlur={() => handleBlur('email')}
                  readOnly={isInvitationMode}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="personal@example.com"
                  autoComplete="email"
                />
                {touched.email && errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="signup-position" className="mb-1 block text-sm font-medium text-slate-700">
                  {isInstallerInvitation ? '직책 (선택)' : '직위'}
                </label>
                {isInstallerInvitation ? (
                  <input
                    id="signup-position"
                    type="text"
                    value={form.position}
                    onChange={(event) => handleFieldChange('position', event.target.value)}
                    onBlur={() => handleBlur('position')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="예: 장착 기사"
                  />
                ) : (
                  <div className="flex gap-4 rounded-lg border border-slate-300 px-3 py-2.5">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="position"
                        value="대표"
                        checked={form.position === '대표'}
                        onChange={(event) => handleFieldChange('position', event.target.value)}
                      />
                      대표
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="position"
                        value="직원"
                        checked={form.position === '직원'}
                        onChange={(event) => handleFieldChange('position', event.target.value)}
                      />
                      직원
                    </label>
                  </div>
                )}
                {touched.position && errors.position && <p className="mt-1 text-sm text-red-600">{errors.position}</p>}
              </div>
            </div>

            {isInstallerInvitation && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="signup-invitation-company" className="mb-1 block text-sm font-medium text-slate-700">
                    회사명
                  </label>
                  <input
                    id="signup-invitation-company"
                    type="text"
                    value={invitationCompanyName}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                  />
                </div>

                <div>
                  <label htmlFor="signup-invitation-role" className="mb-1 block text-sm font-medium text-slate-700">
                    권한
                  </label>
                  <input
                    id="signup-invitation-role"
                    type="text"
                    value={toInvitationRoleLabel(invitationRoleValue)}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                  />
                </div>
              </div>
            )}

            {!isInvitationMode && (
              <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="signup-company" className="mb-1 block text-sm font-medium text-slate-700">
                  회사명
                </label>
                <input
                  id="signup-company"
                  type="text"
                  value={form.company}
                  onChange={(event) => handleFieldChange('company', event.target.value)}
                  onBlur={() => handleBlur('company')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {touched.company && errors.company && <p className="mt-1 text-sm text-red-600">{errors.company}</p>}
              </div>

              <div>
                <label htmlFor="signup-biz-reg-no" className="mb-1 block text-sm font-medium text-slate-700">
                  사업자등록번호
                </label>
                <input
                  id="signup-biz-reg-no"
                  type="text"
                  value={form.bizRegNo}
                  onChange={(event) => handleFieldChange('bizRegNo', event.target.value)}
                  onBlur={() => handleBlur('bizRegNo')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="123-45-67890"
                  inputMode="numeric"
                  maxLength={12}
                />
                {touched.bizRegNo && errors.bizRegNo && <p className="mt-1 text-sm text-red-600">{errors.bizRegNo}</p>}
              </div>
              </div>
            )}

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => navigate({ pathname: '/terms', search: location.search })}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting
                  ? (isInvitationMode ? '초대 수락 중...' : '가입 요청 중...')
                  : (isInvitationMode ? '초대 수락' : '회원가입')}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
