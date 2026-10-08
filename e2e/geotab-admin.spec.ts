import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

const position = { latitude: 37.5, longitude: 127.1, recordedAt: '2026-10-02T01:00:00Z' };
const device = { id: 'test-device', deviceId: 'b1', sourceDatabase: 'fleet', serialNumber: 'GO-TEST-ONLY', providerVin: 'TEST-VIN',
  companyId: null, revision: 0, vehicle: null, registeredCandidate: null, connectionStatus: 'online', collectionStatus: 'healthy',
  isDriving: false, lastCollectedAt: '2026-10-02T01:00:00Z', lastDataAt: '2026-10-02T01:00:00Z', latestPosition: position, feeds: [] };
const detail = { ...device, positions: [position, { ...position, latitude: 37.51, longitude: 127.11 }],
  trips: [{ id: 't1', start: '2026-10-02T00:00:00Z', stop: '2026-10-02T01:00:00Z', distanceKm: 12.5, drivingDuration: '01:00:00', stopPoint: position }],
  assignmentHistory: [], routeSampled: false, routeTruncated: false, tripsTruncated: false };

test('super admin sees unregistered device, maps and trip; tenant save requires confirmation', async ({ page }) => {
  let saved: unknown;
  let tripQuery = '';
  await seedAuthSession(page, 'super_admin');
  await installApiMocks(page, { user: { role: 'super_admin' }, handlers: {
    'GET /api/v2/admin/geotab/devices': async ({ route }) => fulfillSuccess(route, { items: [device], hasMore: false }),
    'GET /api/v2/admin/geotab/tenants': async ({ route }) => fulfillSuccess(route, { items: [{ companyId: 'A', name: '테스트 테넌트' }] }),
    'GET /api/v2/admin/geotab/devices/test-device': async ({ route, request }) => { tripQuery = new URL(request.url()).search; await fulfillSuccess(route, detail); },
    'GET /api/v2/geotab/mapping-vehicles': async ({ route }) => fulfillSuccess(route, { items: [], hasMore: false }),
    'PATCH /api/v2/admin/geotab/devices/test-device/tenant': async ({ route, request }) => { saved = request.postDataJSON(); await fulfillSuccess(route, { ...device, companyId: 'A', revision: 1 }); },
  } });
  await page.goto('/admin/geotab');
  await expect(page.getByTestId('app-page-content').getByRole('heading', { name: 'Geotab 수집 모니터', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '최근 위치', exact: true }).getByTestId('telemetry-latest-marker')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trip 및 주행 경로' }).getByTestId('telemetry-route-line')).toBeVisible();
  await page.getByRole('button', { name: /12.5 km/ }).click();
  await expect.poll(() => tripQuery).toContain('from=');
  await page.getByLabel('단말 소속 테넌트').selectOption('A');
  await page.getByRole('button', { name: '테넌트 설정 저장', exact: true }).click();
  expect(saved).toBeUndefined();
  await page.getByRole('button', { name: '변경 확인', exact: true }).click();
  await expect.poll(() => saved).toEqual({ companyId: 'A', revision: 0 });
  await expect(page.getByRole('status')).toContainText('테넌트 설정을 저장했습니다');
  await page.screenshot({ path: 'test-results/geotab-admin-desktop.png', fullPage: true });
});

test('tenant admin is denied direct route and cannot fetch platform data', async ({ page }) => {
  let platformRequests = 0;
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/admin/geotab/devices': async ({ route }) => { platformRequests++; await fulfillSuccess(route, { items: [] }); },
  } });
  await page.goto('/admin/geotab');
  await expect(page).toHaveURL(/\/forbidden/);
  expect(platformRequests).toBe(0);
  await expect(page.getByRole('link', { name: 'Geotab 수집 모니터' })).toHaveCount(0);
});

test('mobile registered device shows plate, stale status and empty trip without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const registered = { ...device, companyId: 'A', connectionStatus: 'unknown', collectionStatus: 'delayed', vehicle: { vin: 'TEST-VIN', companyId: 'A', vehicleNumber: '12가3456', model: '테스트 차량' } };
  await seedAuthSession(page, 'super_admin');
  await installApiMocks(page, { user: { role: 'super_admin' }, handlers: {
    'GET /api/v2/admin/geotab/devices': async ({ route }) => fulfillSuccess(route, { items: [registered] }),
    'GET /api/v2/admin/geotab/tenants': async ({ route }) => fulfillSuccess(route, { items: [{ companyId: 'A', name: '테스트 테넌트' }] }),
    'GET /api/v2/admin/geotab/devices/test-device': async ({ route }) => fulfillSuccess(route, { ...detail, ...registered, trips: [], positions: [] }),
  } });
  await page.goto('/admin/geotab');
  await expect(page.getByRole('heading', { name: '12가3456', exact: true })).toBeVisible();
  await expect(page.getByLabel('단말 소속 테넌트')).toBeDisabled();
  await expect(page.getByText('해당 기간에 수집된 Trip이 없습니다.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/geotab-admin-mobile.png', fullPage: true });
});

test('assignment conflict does not claim success and offers refresh', async ({ page }) => {
  await seedAuthSession(page, 'super_admin');
  await installApiMocks(page, { user: { role: 'super_admin' }, handlers: {
    'GET /api/v2/admin/geotab/devices': async ({ route }) => fulfillSuccess(route, { items: [device] }),
    'GET /api/v2/admin/geotab/tenants': async ({ route }) => fulfillSuccess(route, { items: [{ companyId: 'A', name: '테스트 테넌트' }] }),
    'GET /api/v2/admin/geotab/devices/test-device': async ({ route }) => fulfillSuccess(route, detail),
    'PATCH /api/v2/admin/geotab/devices/test-device/tenant': async ({ route }) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: { code: 'ASSIGNMENT_CONFLICT', message: '설정이 변경되었습니다. 새로고침 후 다시 저장해 주세요.' } }) }),
  } });
  await page.goto('/admin/geotab');
  await page.getByLabel('단말 소속 테넌트').selectOption('A');
  await page.getByRole('button', { name: '테넌트 설정 저장', exact: true }).click();
  await page.getByRole('button', { name: '변경 확인', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('새로고침');
  await expect(page.getByText('테넌트 설정을 저장했습니다.', { exact: false })).toHaveCount(0);
});

test('super admin sees provider metadata and can bind only a registered tenant asset', async ({ page }) => {
  let bindBody: Record<string, unknown> | null = null;
  const assigned = {
    ...device,
    companyId: 'A',
    revision: 1,
    providerVin: 'KMHLN41EERU575890',
    providerMake: 'Hyundai',
    providerModel: 'Elantra',
    providerYear: '2024',
  };
  await seedAuthSession(page, 'super_admin');
  await installApiMocks(page, { user: { role: 'super_admin' }, handlers: {
    'GET /api/v2/admin/geotab/devices': async ({ route }) => fulfillSuccess(route, { items: [assigned], hasMore: false }),
    'GET /api/v2/admin/geotab/tenants': async ({ route }) => fulfillSuccess(route, { items: [{ companyId: 'A', name: '테스트회사' }] }),
    'GET /api/v2/admin/geotab/devices/test-device': async ({ route }) => fulfillSuccess(route, { ...detail, ...assigned }),
    'GET /api/v2/geotab/mapping-vehicles': async ({ route }) => fulfillSuccess(route, { items: [{ vin: assigned.providerVin, companyId: 'A', vehicleNumber: '282누7485', model: 'Elantra' }], hasMore: false }),
    'PATCH /api/v2/admin/geotab/devices/test-device/vehicle': async ({ route, request }) => {
      bindBody = request.postDataJSON();
      await fulfillSuccess(route, {
        replayedCount: 3,
        device: { ...assigned, revision: 2, vehicle: { vin: assigned.providerVin, companyId: 'A', vehicleNumber: '282누7485', model: 'Elantra' } },
      });
    },
  } });
  await page.goto('/admin/geotab');
  const panel = page.getByRole('region', { name: '차량 자산 및 단말 매칭' });
  const detailPanel = page.getByRole('main', { name: '단말 상세' });
  await expect(detailPanel).toContainText('KMHLN41EERU575890');
  await expect(detailPanel).toContainText('Hyundai');
  await expect(detailPanel).toContainText('Elantra');
  await expect(detailPanel).toContainText('2024');
  await expect(panel.getByLabel('연결할 기존 차량')).toHaveValue(assigned.providerVin);
  await expect(panel.getByRole('button', { name: '자산 등록 및 매칭' })).toHaveCount(0);
  await panel.getByRole('button', { name: '기존 차량 매칭' }).click();
  await expect.poll(() => bindBody).toEqual({ companyId: 'A', vin: assigned.providerVin, revision: 1 });
  await expect(page.getByRole('status')).toContainText('기존 차량과 단말을 매칭했습니다');
  await expect(panel).toContainText('현재 매칭: 282누7485');
});
