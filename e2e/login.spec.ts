import { expect, test } from '@playwright/test';
import {
  buildMockUser,
  delay,
  fulfillSuccess,
  installApiMocks,
} from './helpers/apiMock';
import { loginViaUi, seedAuthSession } from './helpers/session';

test.describe('BK-091 Login E2E', () => {
  test('로그인 성공 시 loading 이후 자산 화면으로 이동한다', async ({ page }) => {
    await installApiMocks(page, {
      user: buildMockUser('member'),
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await delay(350);
          await fulfillSuccess(route, {
            items: [
              {
                id: 'ASSET-001',
                vehicleNumber: '12가3456',
                plate: '12가3456',
                model: '아반떼',
                status: '가용',
                vin: 'KMH12A34560000001',
                year: '2024',
                owner: '홍길동',
                insuranceExpiry: '2026-12-31',
                nextInspection: '2026-06-30',
                issues: [],
                version: 1,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await page.goto('/login?returnUrl=%2Fassets');
    await expect(page.getByTestId('login-user-id')).toBeVisible();

    await page.getByTestId('login-user-id').fill('member-001');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '차량 자산' })).toBeVisible();
    await expect(page.getByText('12가3456')).toBeVisible();
  });

  test('로그인 401 오류 시 인증 실패 문구를 표시한다', async ({ page }) => {
    await installApiMocks(page, {
      auth: {
        login: 'unauthorized',
      },
    });

    await page.goto('/login');
    await expect(page.getByTestId('login-user-id')).toBeVisible();

    await page.getByTestId('login-user-id').fill('member-001');
    await page.getByTestId('login-password').fill('wrong-password');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toContainText('아이디 또는 비밀번호가 올바르지 않습니다.');
  });

  test('권한 없는 설정 메뉴는 비노출되고 직접 접근 시 /forbidden으로 이동한다', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/permissions/me': async ({ route }) => {
          await fulfillSuccess(route, {
            permissions: [
              'route.home',
              'route.assets',
              'route.reservations',
            ],
          });
        },
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              {
                id: 'ASSET-001',
                vehicleNumber: '12가3456',
                plate: '12가3456',
                model: '아반떼',
                status: '가용',
                vin: 'KMH12A34560000001',
                year: '2024',
                owner: '홍길동',
                insuranceExpiry: '2026-12-31',
                nextInspection: '2026-06-30',
                issues: [],
                version: 1,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '차량 자산' })).toBeVisible();

    await expect(page.locator('a[href="/settings"]')).toHaveCount(0);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeVisible();
  });

  test('keeps assets view visible during background auth refresh on focus', async ({ page }) => {
    await installApiMocks(page, {
      user: buildMockUser('member'),
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              {
                id: 'ASSET-001',
                vehicleNumber: '12A3456',
                plate: '12A3456',
                model: 'avante',
                status: 'available',
                vin: 'KMH12A34560000001',
                year: '2024',
                owner: 'owner-1',
                insuranceExpiry: '2026-12-31',
                nextInspection: '2026-06-30',
                issues: [],
                version: 1,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      let authMeFetchCount = 0;

      Object.defineProperty(window, '__e2eGetAuthMeFetchCount', {
        configurable: true,
        value: () => authMeFetchCount,
      });

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const requestUrl = (
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
        );
        const path = new URL(requestUrl, window.location.origin).pathname;

        if (method === 'GET' && path === '/api/v2/auth/me') {
          authMeFetchCount += 1;
          if (authMeFetchCount >= 2) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 700);
            });
          }
        }

        return originalFetch(input, init);
      };
    });

    await page.goto('/login?returnUrl=%2Fassets');
    await expect(page.getByTestId('login-user-id')).toBeVisible();

    await page.getByTestId('login-user-id').fill('member-001');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.locator('table')).toBeVisible();

    const getAuthMeFetchCount = async (): Promise<number> => {
      return page.evaluate(() => {
        const getter = (window as typeof window & { __e2eGetAuthMeFetchCount?: () => number }).__e2eGetAuthMeFetchCount;
        return typeof getter === 'function' ? getter() : 0;
      });
    };

    const callCountBeforeFocus = await getAuthMeFetchCount();
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new FocusEvent('focus'));
    });

    let didRefreshQuickly = true;
    try {
      await expect.poll(getAuthMeFetchCount, { timeout: 2_000 }).toBeGreaterThan(callCountBeforeFocus);
    } catch {
      didRefreshQuickly = false;
    }

    if (!didRefreshQuickly) {
      const expectedCallCount = (await getAuthMeFetchCount()) + 1;
      await page.waitForTimeout(30_100);
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new FocusEvent('focus'));
      });
      await expect.poll(getAuthMeFetchCount, { timeout: 15_000 }).toBeGreaterThanOrEqual(expectedCallCount);
    }

    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('does not get stuck on authorization loading when /auth/me omits companyId', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/auth/me': async ({ route }) => {
          await fulfillSuccess(route, {
            userId: 'member-001',
            role: 'member',
            name: 'E2E Member',
            email: 'member@pangea.local',
          });
        },
        'GET /api/v2/permissions/me': async ({ route }) => {
          await fulfillSuccess(route, {
            permissions: [
              'route.home',
              'route.assets',
            ],
          });
        },
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              {
                id: 'ASSET-001',
                vehicleNumber: '12가3456',
                plate: '12가3456',
                model: '아반떼',
                status: '가용',
                vin: 'KMH12A34560000001',
                year: '2024',
                owner: '홍길동',
                insuranceExpiry: '2026-12-31',
                nextInspection: '2026-06-30',
                issues: [],
                version: 1,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await page.goto('/login?returnUrl=%2Fassets');
    await expect(page.getByTestId('login-user-id')).toBeVisible();

    await page.getByTestId('login-user-id').fill('member-001');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('does not request settings/company before authentication on the login page', async ({ page }) => {
    let companyRequestCount = 0;

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/settings/company': async ({ route }) => {
          companyRequestCount += 1;
          await fulfillSuccess(route, {
            id: 'company-001',
            name: 'Pangea Mobility',
            businessNumber: '123-45-67890',
            contactName: '홍길동',
            contactPhone: '010-1111-2222',
            address: '서울특별시 강남구',
            timezone: 'Asia/Seoul',
            currency: 'KRW',
          });
        },
      },
    });

    await page.goto('/login');
    await expect(page.getByTestId('login-user-id')).toBeVisible();
    await page.waitForTimeout(300);

    expect(companyRequestCount).toBe(0);
  });

  test('allows login interaction after redirecting to /login from an expired session', async ({ page }) => {
    await installApiMocks(page, {
      auth: {
        me: 'unauthorized',
      },
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await seedAuthSession(page);
    await page.goto('/assets');

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByTestId('login-user-id')).toBeVisible();

    await page.getByTestId('login-user-id').fill('member-001');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
  });

  test('refreshes permissions as well as session on window focus', async ({ page }) => {
    let permissionsFetchCount = 0;

    await installApiMocks(page, {
      user: buildMockUser('member'),
      handlers: {
        'GET /api/v2/permissions/me': async ({ route }) => {
          permissionsFetchCount += 1;
          await fulfillSuccess(route, {
            permissions: [
              'route.home',
              'route.assets',
              'route.support-center',
            ],
          });
        },
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await page.goto('/login?returnUrl=%2Fassets');
    await expect(page.getByTestId('login-user-id')).toBeVisible();
    await page.getByTestId('login-user-id').fill('member-001');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);

    const beforeFocus = permissionsFetchCount;
    await page.waitForTimeout(30_100);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new FocusEvent('focus'));
    });

    await expect.poll(() => permissionsFetchCount, { timeout: 15_000 }).toBeGreaterThan(beforeFocus);
  });
});
