import { expect, test, type Page } from '@playwright/test';

import { buildMockUser, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

function getMetricCard(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
}

test.describe('SCRUM-183 Home E2E', () => {
  test('shows overdue returns and unpaid contracts as separate counts', async ({ page }) => {
    const user = buildMockUser('admin');
    const permissions = [
      'route.home',
      'route.action-required',
      'route.assets',
      'route.reservations',
      'route.revenue',
      'route.support-center',
      'route.settings',
      'action.assets.write',
      'action.reservations.write',
      'action.action-required.write',
      'action.revenue.write',
      'action.payments.write',
      'action.support.manage',
      'action.settings.write',
      'action.settings.members.write',
    ];

    await seedAuthSession(page, 'admin', {
      userId: user.userId,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      company: user.company,
      name: user.name,
    });
    await page.addInitScript(
      ({ key, value }: { key: string; value: string }) => {
        window.localStorage.setItem(key, value);
      },
      {
        key: 'pangea.authorization.v2',
        value: JSON.stringify({
          version: 2,
          userId: user.userId,
          companyId: user.companyId,
          role: user.role,
          source: 'api',
          fetchedAt: Date.now(),
          permissions,
        }),
      },
    );

    await installApiMocks(page, {
      user,
      handlers: {
        'GET /api/v2/home/summary': async ({ route }) => {
          await fulfillSuccess(route, {
            tenantId: user.companyId,
            from: '2026-03-01',
            to: '2026-03-07',
            kpis: {
              totalAssets: 8,
              totalContracts: 5,
              activeContracts: 2,
              completedContracts: 1,
              overdueContracts: 3,
              unpaidContracts: 1,
              utilizationRate: 0.42,
            },
            statusCounts: {
              contractStatus: {},
              managementStage: {},
              alerts: {
                overdue: 3,
                stolen: 0,
              },
            },
            today: {
              pickupDueCount: 0,
              returnDueCount: 0,
              overdueCount: 0,
            },
            recentChanges: [],
          });
        },
        'GET /api/v2/auth/me': async ({ route }) => {
          await fulfillSuccess(route, user);
        },
        'GET /api/v2/permissions/me': async ({ route }) => {
          await fulfillSuccess(route, {
            permissions,
          });
        },
        'GET /api/v2/notifications': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
            unreadCount: 0,
          });
        },
        'GET /api/v2/notifications/summary': async ({ route }) => {
          await fulfillSuccess(route, {
            totalCount: 0,
            unreadCount: 0,
          });
        },
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
          });
        },
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
          });
        },
      },
    });

    await page.goto('/');
    await page.waitForResponse((response) => (
      response.url().includes('/api/v2/home/summary')
      && response.request().method() === 'GET'
      && response.ok()
    ));

    const overdueCard = getMetricCard(page, '반납 지연');
    const unpaidCard = getMetricCard(page, '미납/연체 계약');

    await expect(overdueCard.locator('p').first()).toHaveText('3');
    await expect(unpaidCard.locator('p').first()).toHaveText('1');
    await expect(page.getByRole('button', { name: /미납\/연체.*1건/ })).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/reservations\?filter=unpaid&paymentScope=delinquent/),
      unpaidCard.click(),
    ]);
  });
});
