import type { Page } from '@playwright/test';
import type { MockUser } from './apiMock';
import { buildMockUser, E2E_ROLE_DEFAULT_PERMISSIONS } from './apiMock';

const AUTH_SESSION_KEY = 'pangea.auth.v1';
const AUTHORIZATION_CACHE_KEY = 'pangea.authorization.v2';

interface StoredAuthSession {
  token: string;
  expiresAt: number;
  user: MockUser;
}

function buildAuthorizationCache(user: MockUser, permissions?: readonly string[]) {
  return {
    version: 2,
    userId: user.userId,
    companyId: user.companyId,
    role: user.role,
    source: 'api',
    fetchedAt: Date.now(),
    permissions: [...(permissions ?? E2E_ROLE_DEFAULT_PERMISSIONS[user.role] ?? E2E_ROLE_DEFAULT_PERMISSIONS.member)],
  };
}

export async function seedAuthSession(
  page: Page,
  role: MockUser['role'] = 'member',
  overrides: Partial<MockUser> = {},
  permissions?: readonly string[],
): Promise<void> {
  const user = {
    ...buildMockUser(role),
    ...overrides,
  } satisfies MockUser;

  const session: StoredAuthSession = {
    token: 'e2e-access-token',
    expiresAt: Date.now() + 60 * 60 * 1000,
    user,
  };
  const authorization = buildAuthorizationCache(user, permissions);

  await page.addInitScript(
    ({ authKey, authValue, authorizationKey, authorizationValue }: { authKey: string; authValue: string; authorizationKey: string; authorizationValue: string }) => {
      window.localStorage.setItem(authKey, authValue);
      window.localStorage.setItem(authorizationKey, authorizationValue);
    },
    {
      authKey: AUTH_SESSION_KEY,
      authValue: JSON.stringify(session),
      authorizationKey: AUTHORIZATION_CACHE_KEY,
      authorizationValue: JSON.stringify(authorization),
    },
  );
}

interface LoginViaUiOptions {
  returnUrl: string;
  userId?: string;
  password?: string;
  user?: Partial<MockUser>;
  permissions?: readonly string[];
}

export async function loginViaUi(
  page: Page,
  role: MockUser['role'],
  options: LoginViaUiOptions,
): Promise<void> {
  const user = {
    ...buildMockUser(role),
    ...options.user,
  } satisfies MockUser;
  const session: StoredAuthSession = {
    token: `e2e-access-token-${options.userId ?? user.userId}`,
    expiresAt: Date.now() + 60 * 60 * 1000,
    user,
  };
  const authorization = buildAuthorizationCache(user, options.permissions);

  await page.addInitScript(
    ({ authKey, authValue, authorizationKey, authorizationValue }: { authKey: string; authValue: string; authorizationKey: string; authorizationValue: string }) => {
      window.localStorage.setItem(authKey, authValue);
      window.localStorage.setItem(authorizationKey, authorizationValue);
    },
    {
      authKey: AUTH_SESSION_KEY,
      authValue: JSON.stringify(session),
      authorizationKey: AUTHORIZATION_CACHE_KEY,
      authorizationValue: JSON.stringify(authorization),
    },
  );
  await page.goto(options.returnUrl);
}
