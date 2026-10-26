import { expect, test } from '@playwright/test';
import { buildMockUser, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

for (const role of ['admin', 'super_admin'] as const) {
  test(`Home hides contract utilization and skips its request for ${role}`, async ({ page }) => {
    const user = buildMockUser(role);
    await seedAuthSession(page, role, user, ['route.home']);
    let utilizationRequests = 0;
    await installApiMocks(page, { user, handlers: {
      'GET /api/v2/auth/me': async ({ route }) => fulfillSuccess(route, user),
      'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions: ['route.home'] }),
      'GET /api/v2/home/summary': async ({ route }) => fulfillSuccess(route, {
        tenantId: user.companyId,
        kpis: { totalAssets: 2, totalContracts: 1, activeContracts: 1, utilizationRate: 0.5 },
        statusCounts: { contractStatus: {}, rentalType: {}, managementStage: {}, alerts: {} },
        today: {}, recentChanges: [],
      }),
      'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/home/utilization': async ({ route }) => {
        utilizationRequests += 1;
        await fulfillSuccess(route, {});
      },
    }});
    await page.goto('/');
    await expect(page.getByTestId('home-priority-panel')).toBeVisible();
    await expect(page.getByTestId('contract-utilization-panel')).toHaveCount(0);
    await expect(page.getByText('계약 점유율', { exact: true })).toHaveCount(0);
    expect(utilizationRequests).toBe(0);
    if (role === 'admin') {
      await page.screenshot({ path: 'test-results/home-without-contract-utilization.png', fullPage: true });
    }
  });
}
