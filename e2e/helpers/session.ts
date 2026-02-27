import type { Page } from '@playwright/test';
import type { MockUser } from './apiMock';
import { buildMockUser } from './apiMock';

const AUTH_SESSION_KEY = 'pangea.auth.v1';

interface StoredAuthSession {
  token: string;
  expiresAt: number;
  user: MockUser;
}

export async function seedAuthSession(
  page: Page,
  role: MockUser['role'] = 'member',
  overrides: Partial<MockUser> = {},
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

  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: AUTH_SESSION_KEY,
      value: JSON.stringify(session),
    },
  );
}
