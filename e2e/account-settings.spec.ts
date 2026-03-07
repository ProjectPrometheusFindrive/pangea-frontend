import { expect, test } from '@playwright/test';

import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

test.describe('Account settings', () => {
  test('withdraws the current user and returns to login', async ({ page }) => {
    let withdrawCount = 0;

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          });
        },
        'POST /api/v2/auth/withdraw': async ({ route }) => {
          withdrawCount += 1;
          await fulfillSuccess(route, { message: 'withdrawn' });
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);

    await page.getByRole('button', { name: /E2E Member/i }).click();
    await page.getByRole('button', { name: '계정 설정' }).click();
    await page.getByRole('button', { name: '계정 삭제' }).click();
    await page.getByTestId('account-delete-confirm').click();

    await expect.poll(() => withdrawCount).toBe(1);
    await expect(page).toHaveURL(/\/login/);
  });
});
