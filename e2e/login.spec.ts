import { expect, test } from '@playwright/test';
import {
  buildMockUser,
  delay,
  fulfillSuccess,
  installApiMocks,
} from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

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
});
