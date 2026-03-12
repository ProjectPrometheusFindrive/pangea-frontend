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

  test('admin creates and resends pending invitations from the accounts tab', async ({ page }) => {
    let createCount = 0;
    let resendCount = 0;
    let invitations = [
      {
        id: 'INV-001',
        email: 'pending@example.com',
        role: 'member',
        companyId: 'company-001',
        companyName: 'Pangea Mobility',
        status: 'pending',
        invitedBy: 'admin-001',
        invitedAt: '2026-03-07T09:00:00Z',
        updatedAt: '2026-03-07T09:00:00Z',
        expiresAt: '2026-03-14T09:00:00Z',
        resendCount: 0,
        resentAt: null,
      },
    ];

    await installApiMocks(page, {
      user: {
        role: 'admin',
        name: 'E2E Admin',
        email: 'admin@pangea.local',
      },
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, { items: [], total: 0, page: 1, pageSize: 1 });
        },
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, { items: [], total: 0, page: 1, pageSize: 1 });
        },
        'GET /api/v2/settings/geofences': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'GET /api/v2/settings/members': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              {
                userId: 'admin@pangea.local',
                name: 'E2E Admin',
                email: 'admin@pangea.local',
                role: 'admin',
                status: 'approved',
              },
            ],
          });
        },
        'GET /api/v2/invitations': async ({ route }) => {
          await fulfillSuccess(route, { items: invitations });
        },
        'POST /api/v2/invitations': async ({ route, request }) => {
          createCount += 1;
          const payload = request.postDataJSON();
          const createdInvitation = {
            id: 'INV-NEW',
            email: payload.email,
            role: payload.role,
            companyId: 'company-001',
            companyName: 'Pangea Mobility',
            status: 'pending',
            invitedBy: 'admin-001',
            invitedAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
            expiresAt: '2026-03-14T10:00:00Z',
            resendCount: 0,
            resentAt: null,
          };
          invitations = [createdInvitation, ...invitations];
          await fulfillSuccess(route, createdInvitation, 201);
        },
        'POST /api/v2/invitations/INV-001/resend': async ({ route }) => {
          resendCount += 1;
          invitations = invitations.map((invitation) => (
            invitation.id === 'INV-001'
              ? {
                  ...invitation,
                  resendCount: invitation.resendCount + 1,
                  resentAt: '2026-03-07T11:00:00Z',
                  updatedAt: '2026-03-07T11:00:00Z',
                }
              : invitation
          ));
          await fulfillSuccess(route, invitations.find((invitation) => invitation.id === 'INV-001'));
        },
      },
    });

    await loginViaUi(page, 'admin', { returnUrl: '/settings' });

    await page.getByRole('button', { name: '계정 관리' }).click();
    await expect(page.getByText('pending@example.com')).toBeVisible();

    await page.getByRole('button', { name: /^초대$/ }).click();
    await page.getByLabel('초대 이메일').fill('Invitee@Example.com');
    await page.getByLabel('권한').selectOption('admin');
    await page.getByRole('button', { name: '초대 메일 발송' }).click();

    await expect.poll(() => createCount).toBe(1);
    await expect(page.getByText('invitee@example.com')).toBeVisible();

    const pendingRow = page.locator('tr', { hasText: 'pending@example.com' });
    await pendingRow.getByRole('button', { name: '재발송' }).click();

    await expect.poll(() => resendCount).toBe(1);
    await expect(page.getByRole('main').getByText('초대를 재발송했습니다.')).toBeVisible();
    await expect(pendingRow.getByText('1회')).toBeVisible();
  });
});
