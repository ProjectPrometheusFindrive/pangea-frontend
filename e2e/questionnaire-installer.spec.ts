import { expect, test } from '@playwright/test';
import { buildMockUser, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { TEST_IMAGE_FILE } from './helpers/files';
import { loginViaUi } from './helpers/session';
import { seedAuthSession } from './helpers/session';

const assigned = {
  id: 'DI-Q05-001', vin: 'VIN-Q05-001', status: 'scheduled',
  scheduledAt: '2026-09-16T01:00:00Z', installer: 'installer-001', photos: [],
};

test('Q05/Q08 installer completes assigned task with two-photo PATCH and never POSTs', async ({ page }) => {
  const patchBodies: unknown[] = [];
  let postCount = 0;
  let row = { ...assigned };
  await installApiMocks(page, {
    user: { role: 'installer', userId: 'installer-001', companyId: 'C1', name: 'Installer' },
    handlers: {
      'POST /api/v2/device-installations': async ({ route }) => { postCount += 1; await fulfillSuccess(route, assigned); },
      'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [{ vin: row.vin, vehicleNumber: row.vin, model: 'Test', year: 2026 }] }),
      'GET /api/v2/device-installations/tasks': async ({ route }) => fulfillSuccess(route, { items: [row], total: 1, page: 1, pageSize: 10 }),
      'PATCH /api/v2/device-installations/DI-Q05-001/status': async ({ route, request }) => {
        patchBodies.push(request.postDataJSON());
        const body = request.postDataJSON() as { status: string; photos?: string[]; deviceSerial?: string };
        row = { ...row, ...body, status: body.status as typeof row.status };
        await fulfillSuccess(route, row);
      },
    },
  });
  await loginViaUi(page, 'installer', { returnUrl: '/device-installation' });
  await page.getByTestId('device-installation-vin-input').selectOption(row.vin);
  await page.getByTestId('device-installation-serial-input').fill('DEV-Q05-001');
  await page.getByTestId('device-installation-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('device-installation-serial-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('device-installation-submit').click();
  await expect(page.getByTestId('device-installation-action-message')).toContainText('장착 완료');
  expect(patchBodies).toHaveLength(2);
  expect((patchBodies[0] as { status: string }).status).toBe('in_progress');
  expect((patchBodies[1] as { status: string; photos: string[] }).status).toBe('completed');
  expect((patchBodies[1] as { photos: string[] }).photos).toHaveLength(2);
  expect(postCount).toBe(0);
});

test('Q08 cancelled task sends explicit cancelReason', async ({ page }) => {
  let cancelBody: unknown;
  await installApiMocks(page, {
    user: { role: 'installer', userId: 'installer-001', companyId: 'C1' },
    handlers: {
      'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [] }),
      'GET /api/v2/device-installations/tasks': async ({ route }) => fulfillSuccess(route, { items: [{ ...assigned, status: 'in_progress' }], total: 1, page: 1, pageSize: 10 }),
      'PATCH /api/v2/device-installations/DI-Q05-001/status': async ({ route, request }) => { cancelBody = request.postDataJSON(); await fulfillSuccess(route, { ...assigned, status: 'cancelled', cancelReason: '사진 훼손' }); },
    },
  });
  await loginViaUi(page, 'installer', { returnUrl: '/device-installation' });
  page.once('dialog', async (dialog) => dialog.accept('사진 훼손'));
  await page.getByRole('button', { name: '취소' }).first().click();
  await expect.poll(() => cancelBody).toBeTruthy();
  expect((cancelBody as { cancelReason?: string }).cancelReason).toBe('사진 훼손');
});

test('Q05 super scope creates once, then retries completion without a second POST', async ({ page }) => {
  let row = { ...assigned, id: '' };
  let postCount = 0;
  let completeAttempts = 0;
  const requests: Array<{ method: string; url: string; body: any }> = [];
  // AuthContext requires a string companyId; empty means no selected scope.
  const superUser = { ...buildMockUser('super_admin'), userId: 'boss-001', companyId: '', name: 'Boss' };
  await installApiMocks(page, {
    user: superUser,
    handlers: {
      'GET /api/v2/auth/me': async ({ route }) => fulfillSuccess(route, superUser),
      'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions: ['route.device-installation', 'action.device-installation.write'] }),
      'GET /api/v2/settings/company': async ({ route }) => fulfillSuccess(route, { items: [] }),
      'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
      'GET /api/v2/home/summary': async ({ route }) => fulfillSuccess(route, { kpis: {}, statusCounts: {}, today: {}, recentChanges: [] }),
      'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [{ vin: row.vin, vehicleNumber: row.vin, model: 'Test', year: 2026 }] }),
      'GET /api/v2/device-installations/tasks': async ({ route }) => fulfillSuccess(route, { items: row.id ? [row] : [], total: row.id ? 1 : 0, page: 1, pageSize: 10 }),
      'POST /api/v2/device-installations': async ({ route, request }) => { postCount += 1; requests.push({ method: 'POST', url: request.url(), body: request.postDataJSON() }); row = { ...row, id: 'DI-Q05-001', status: 'scheduled' }; await fulfillSuccess(route, row, 201); },
      'PATCH /api/v2/device-installations/DI-Q05-001/status': async ({ route, request }) => {
        const body = request.postDataJSON();
        requests.push({ method: 'PATCH', url: request.url(), body });
        if (body.status === 'completed' && completeAttempts++ === 0) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: { type: 'SERVER_ERROR', message: 'temporary' } }) }); return; }
        row = { ...row, ...body, status: body.status, ...(body.status === 'completed' ? { completedBy: 'boss-001', completedAt: '2026-09-16T02:00:00Z' } : {}) };
        await fulfillSuccess(route, row);
      },
    },
  });
  await seedAuthSession(page, 'super_admin', superUser, ['route.device-installation', 'action.device-installation.write']);
  await page.goto('/device-installation');
  await page.getByTestId('device-installation-company-input').fill('C1');
  await page.getByTestId('device-installation-vin-input').selectOption(row.vin);
  await page.getByTestId('device-installation-installer-input').fill('installer-001');
  await page.getByTestId('device-installation-submit').click();
  await expect(page.getByTestId('device-installation-action-message')).toContainText('작업이 생성');
  await page.getByTestId('device-installation-serial-input').fill('DEV-SUPER-001');
  await page.getByTestId('device-installation-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('device-installation-serial-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('device-installation-submit').click();
  await expect(page.getByTestId('device-installation-action-error')).toBeVisible();
  await page.getByTestId('device-installation-submit').click();
  await expect(page.getByTestId('device-installation-action-message')).toContainText('장착 완료');
  expect(postCount).toBe(1);
  expect(requests.filter((r) => r.method === 'PATCH').map((r) => r.body.status)).toEqual(['in_progress', 'completed', 'completed']);
  expect(requests.every((r) => r.url.includes('companyId=C1') || r.method === 'POST')).toBeTruthy();
  await expect(page.getByRole('cell', { name: 'boss-001', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '2026-09-16 11:00', exact: true })).toBeVisible();
});
