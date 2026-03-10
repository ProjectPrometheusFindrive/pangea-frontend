export interface InvitationAwareSignUpFormValues {
  userId: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  company: string;
  bizRegNo: string;
}

export type InvitationAwareSignUpErrors = Partial<Record<keyof InvitationAwareSignUpFormValues, string>>;

export interface InvitationTokenClaims {
  typ?: string;
  act?: string;
  invitationId?: string;
  email?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeBizRegNoDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

function decodeBase64Url(input: string): string | null {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf-8');
    }
    if (typeof atob === 'function') {
      return decodeURIComponent(
        Array.from(atob(`${normalized}${padding}`))
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      );
    }
  } catch {
    return null;
  }
  return null;
}

export function extractInvitationToken(search: string): string | null {
  const params = new URLSearchParams(search);
  const token = params.get('invitationToken');
  return token?.trim() || null;
}

export function buildSignupRouteWithSearch(search: string): string {
  return search ? `/signup${search}` : '/signup';
}

export function decodeInvitationToken(token: string | null | undefined): InvitationTokenClaims {
  const raw = (token || '').trim();
  if (!raw) {
    return {};
  }
  const [, payload = ''] = raw.split('.');
  const decoded = decodeBase64Url(payload);
  if (!decoded) {
    return {};
  }
  try {
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return parsed as InvitationTokenClaims;
  } catch {
    return {};
  }
}

export function validateInvitationAwareSignUpForm(
  values: InvitationAwareSignUpFormValues,
  options: {
    invitationEmail?: string | null;
    invitationRole?: string | null;
  } = {},
): InvitationAwareSignUpErrors {
  const errors: InvitationAwareSignUpErrors = {};
  const invitationEmail = normalizeEmail(options.invitationEmail || '');
  const invitationRole = (options.invitationRole || '').trim().toLowerCase();
  const isInvitationMode = Boolean(invitationEmail);
  const isInstallerInvitation = invitationRole === 'installer';

  const userId = normalizeEmail(values.userId);
  if (!isInvitationMode) {
    if (!userId) {
      errors.userId = '아이디(이메일)를 입력해 주세요.';
    } else if (!EMAIL_REGEX.test(userId)) {
      errors.userId = '올바른 이메일 형식이 아닙니다.';
    }
  }

  if (!values.password) {
    errors.password = '비밀번호를 입력해 주세요.';
  } else if (values.password.length < 8 || !/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = '비밀번호는 8자 이상, 영문/숫자를 포함해야 합니다.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = '비밀번호 확인을 입력해 주세요.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
  }

  if (!values.name.trim()) {
    errors.name = '이름을 입력해 주세요.';
  }

  if (!PHONE_REGEX.test(values.phone)) {
    errors.phone = '전화번호는 010-0000-0000 형식으로 입력해 주세요.';
  }

  if (!isInvitationMode) {
    const email = normalizeEmail(values.email);
    if (!email) {
      errors.email = '개인 이메일을 입력해 주세요.';
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = '올바른 개인 이메일 형식이 아닙니다.';
    }
  }

  if (!values.position && !isInstallerInvitation) {
    errors.position = '직위를 선택해 주세요.';
  }

  if (!isInvitationMode) {
    if (!values.company.trim()) {
      errors.company = '회사명을 입력해 주세요.';
    }
    if (normalizeBizRegNoDigits(values.bizRegNo).length !== 10) {
      errors.bizRegNo = '사업자등록번호 10자리를 입력해 주세요.';
    }
  }

  return errors;
}

export function buildInvitationAcceptPayload(values: InvitationAwareSignUpFormValues) {
  return {
    password: values.password,
    name: values.name.trim(),
    phone: values.phone,
    position: values.position.trim() || undefined,
  };
}
