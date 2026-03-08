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
    const user = buildMockUser('member');
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
    ];

    await seedAuthSession(page, 'member', {
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

    const overdueCard = getMetricCard(page, '반납 지연');
    const unpaidCard = getMetricCard(page, '미납/연체 계약');

    await expect(overdueCard).toBeVisible();
    await expect(overdueCard.locator('p').first()).toHaveText('3');
    await expect(unpaidCard.locator('p').first()).toHaveText('1');
    await expect(page.getByRole('button', { name: /미납\/연체.*1건/ })).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/reservations\?filter=unpaid&paymentScope=delinquent/),
      unpaidCard.click(),
    ]);
  });
});

test.describe('SCRUM-184 Home premium CTA E2E', () => {
  test('routes the premium modal CTA into a prefilled support-center inquiry', async ({ page }) => {
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
        'GET /api/v2/support/categories': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              { id: 'billing', name: '결제 문의' },
              { id: 'operations', name: '운영 문의' },
            ],
          });
        },
      },
    });

    await page.goto('/');
    await expect(getMetricCard(page, '단말 OFF')).toBeVisible();
    await page.getByRole('button', { name: '프리미엄 시작하기' }).click();
    await expect(page.getByRole('button', { name: '지금 시작하기' })).toBeVisible();
    await page.getByRole('button', { name: '지금 시작하기' }).click();

    await expect(page).toHaveURL(/\/support-center/);
    await expect(page.getByRole('button', { name: '목록 선택 모드' })).toBeVisible();
    await expect(page.locator('input#support-category')).toHaveValue('프리미엄 단말 문의');
    await expect(page.locator('#support-title')).toHaveValue('프리미엄 단말 도입 상담 요청');
    await expect(page.locator('#support-content')).toHaveValue('홈 대시보드 프리미엄 CTA에서 단말 도입 상담을 요청합니다.');
  });

  test('routes admin users from the layout premium banner into the prefilled submit view', async ({ page }) => {
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
        'GET /api/v2/support/categories': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              { id: 'billing', name: '결제 문의' },
              { id: 'operations', name: '운영 문의' },
            ],
          });
        },
        'GET /api/v2/support/tickets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
            limit: 25,
            offset: 0,
          });
        },
      },
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: '홈 요약' })).toBeVisible();
    await page.getByRole('button', { name: '자세히 보기' }).click();

    await expect(page).toHaveURL(/\/support-center/);
    await expect(page.getByRole('button', { name: '목록 선택 모드' })).toBeVisible();
    await expect(page.locator('input#support-category')).toHaveValue('프리미엄 단말 문의');
    await expect(page.locator('#support-title')).toHaveValue('프리미엄 단말 기능 상담 요청');
    await expect(page.locator('#support-content')).toHaveValue('상단 프리미엄 배너에서 단말 기능과 도입 상담을 요청합니다.');
  });

  test('shows the device-off premium card as a no-data state instead of hardcoded zero', async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: '홈 요약' })).toBeVisible();
    const deviceOffCard = getMetricCard(page, '단말 OFF');

    await expect(deviceOffCard).toBeVisible();
    await expect(deviceOffCard).toContainText('데이터 없음');
  });
});
