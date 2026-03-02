export interface SignupAgreementState {
  privacy: boolean;
  location: boolean;
  marketing: boolean;
  agreedAt: string | null;
}

const SIGNUP_AGREEMENTS_STORAGE_KEY = 'signup-agreements-v1';

export const DEFAULT_SIGNUP_AGREEMENTS: SignupAgreementState = {
  privacy: false,
  location: false,
  marketing: false,
  agreedAt: null,
};

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

export function hasRequiredSignupAgreements(state: SignupAgreementState): boolean {
  return state.privacy && state.location;
}

export function loadSignupAgreementState(): SignupAgreementState {
  if (!hasWindow()) {
    return { ...DEFAULT_SIGNUP_AGREEMENTS };
  }

  const raw = window.sessionStorage.getItem(SIGNUP_AGREEMENTS_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_SIGNUP_AGREEMENTS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SignupAgreementState>;
    return {
      privacy: Boolean(parsed.privacy),
      location: Boolean(parsed.location),
      marketing: Boolean(parsed.marketing),
      agreedAt: typeof parsed.agreedAt === 'string' ? parsed.agreedAt : null,
    };
  } catch {
    return { ...DEFAULT_SIGNUP_AGREEMENTS };
  }
}

export function saveSignupAgreementState(state: SignupAgreementState): void {
  if (!hasWindow()) {
    return;
  }
  window.sessionStorage.setItem(SIGNUP_AGREEMENTS_STORAGE_KEY, JSON.stringify(state));
}

export function clearSignupAgreementState(): void {
  if (!hasWindow()) {
    return;
  }
  window.sessionStorage.removeItem(SIGNUP_AGREEMENTS_STORAGE_KEY);
}
