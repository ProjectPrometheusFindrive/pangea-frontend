import { expect, test } from '@playwright/test';
import { buildMockUser, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

test('Home renders contract utilization rows in rate order and requests selected range', async ({ page }) => {
  const user = buildMockUser('admin');
  await seedAuthSession(page, 'admin', user);
  await page.addInitScript(() => localStorage.setItem('pangea.authorization.v2', JSON.stringify({ version: 2, userId: 'admin-001', companyId: 'company-001', role: 'admin', source: 'api', fetchedAt: Date.now(), permissions: ['route.home'] })));
  let utilizationUrl = '';
  await installApiMocks(page, { user, handlers: {
    'GET /api/v2/auth/me': async ({ route }) => fulfillSuccess(route, user),
    'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions: ['route.home'] }),
    'GET /api/v2/home/summary': async ({ route }) => fulfillSuccess(route, { tenantId: user.companyId, kpis: { totalAssets: 2, totalContracts: 1, activeContracts: 1, completedContracts: 0, overdueContracts: 0, unpaidContracts: 0, utilizationRate: 0 }, statusCounts: { contractStatus: {}, rentalType: {}, managementStage: {}, alerts: {} }, today: {}, recentChanges: [] }),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
    'GET /api/v2/home/utilization': async ({ route, request }) => { utilizationUrl = request.url(); await fulfillSuccess(route, { formulaVersion: 'contract-occupancy-v1', timezone: 'Asia/Seoul', from: '2026-09-01', to: '2026-09-30', kpi: { assetCount: 2, usedSeconds: 1, capacitySeconds: 2, utilizationRate: 0.5 }, rows: [{ assetId: 'A0', vin: 'LOW', usedSeconds: 0, utilizationRate: 0 }, { assetId: 'A1', vin: 'HIGH', usedSeconds: 1, utilizationRate: 0.5 }], excludedCounts: { maintenance: 2 }, limitations: ['실제 주행률이 아닌 계약 점유율입니다.'] }); },
  }});
  await page.goto('/');
  const panel = page.getByTestId('contract-utilization-panel');
  await expect(panel).toContainText('LOW');
  await expect(panel).toContainText('HIGH');
  await expect(panel.locator('div.border-b').first()).toContainText('LOW');
  await expect(panel).toContainText('제외: maintenance: 2건');
  await panel.locator('input[type="date"]').first().fill('2026-09-01');
  await panel.locator('input[type="date"]').nth(1).fill('2026-09-30');
  await expect.poll(() => utilizationUrl).toContain('from=2026-09-01');
  await expect.poll(() => utilizationUrl).toContain('to=2026-09-30');
});

async function installUtilizationPageMocks(page: import('@playwright/test').Page, user: ReturnType<typeof buildMockUser>, utilization: (route: import('@playwright/test').Route, request: import('@playwright/test').Request) => Promise<void>) {
  await installApiMocks(page, { user, handlers: {
    'GET /api/v2/auth/me': async ({ route }) => fulfillSuccess(route, user),
    'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions: ['route.home'] }),
    'GET /api/v2/home/summary': async ({ route }) => fulfillSuccess(route, { tenantId: user.companyId, kpis: { totalAssets: 1, totalContracts: 1 }, statusCounts: { contractStatus: {}, rentalType: {}, managementStage: {}, alerts: {} }, today: {}, recentChanges: [] }),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
    'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0, unreadCount: 0 }),
    'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { totalCount: 0, unreadCount: 0 }),
    'GET /api/v2/home/utilization': async ({ route, request }) => utilization(route, request),
  }});
}

test('Home utilization shows error then succeeds after retry', async ({ page }) => {
  const user = buildMockUser('admin');
  await seedAuthSession(page, 'admin', user);
  let calls = 0;
  await installUtilizationPageMocks(page, user, async (route) => {
    calls += 1;
    if (calls === 1) return fulfillError(route, 500, 'SERVER_ERROR', 'temporary');
    return fulfillSuccess(route, { formulaVersion: 'contract-occupancy-v1', timezone: 'Asia/Seoul', from: '2026-09-01', to: '2026-09-30', kpi: { assetCount: 1, usedSeconds: 1, capacitySeconds: 2, utilizationRate: 0.5 }, rows: [{ assetId: 'A1', vin: 'RETRY-VIN', usedSeconds: 1, utilizationRate: 0.5 }], excludedCounts: {}, limitations: [] });
  });
  await page.goto('/');
  const panel = page.getByTestId('contract-utilization-panel');
  await expect(panel).toContainText('조회에 실패했습니다.');
  await panel.getByRole('button', { name: '다시 시도' }).click();
  await expect(panel).toContainText('RETRY-VIN');
  expect(calls).toBe(2);
});

test('super admin utilization requires and then sends explicit company scope', async ({ page }) => {
  const user = buildMockUser('super_admin');
  await seedAuthSession(page, 'super_admin', user);
  let requested = '';
  await installUtilizationPageMocks(page, user, async (route, request) => {
    requested = request.url();
    return fulfillSuccess(route, { formulaVersion: 'contract-occupancy-v1', timezone: 'Asia/Seoul', from: '2026-09-01', to: '2026-09-30', kpi: { assetCount: 0, usedSeconds: 0, capacitySeconds: 0, utilizationRate: 0 }, rows: [], excludedCounts: {}, limitations: [] });
  });
  await page.goto('/');
  const panel = page.getByTestId('contract-utilization-panel');
  await expect(panel).toContainText('회사를 선택하면 조회할 수 있습니다.');
  await panel.getByLabel('회사 ID').fill('company-002');
  await expect.poll(() => requested).toContain('companyId=company-002');
});
