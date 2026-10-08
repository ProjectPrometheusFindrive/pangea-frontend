import { expect, test } from '@playwright/test';

import { fulfillSuccess, installApiMocks, type ApiMockHandler } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

const pendingAccidentItem = {
  id: 'GEOTAB-ACTION:company-001:VIN-GEO-1:accident_suspected',
  type: '대여 중 사고',
  category: '대여 중 사고',
  subCategory: '고객 사고 여부 확인',
  reasonType: 'accident_suspected',
  issueCode: 'rental_accident.customer_confirmation_required',
  vehicleNumber: '12가3456',
  customerName: '테스트 고객',
  date: '2026-09-23T01:02:03Z',
  severity: 'medium',
  priority: 'medium',
  status: 'open',
  statusCode: 'pending',
  notificationType: 'accident-confirmation',
  customerConfirmationStatus: 'pending',
  telemetryCardStatus: 'open',
  geotabVehicleId: 'VIN-GEO-1',
  availableActions: [
    'customer_confirmation_confirmed',
    'customer_confirmation_rejected',
    'memo_add',
    'status_update',
  ],
};

const settingsMocks: Record<string, ApiMockHandler> = Object.fromEntries([
  '/api/v2/notifications', '/api/v2/notifications/summary', '/api/v2/settings/geofences',
  '/api/v2/settings/garages', '/api/v2/settings/members', '/api/v2/invitations',
  '/api/v2/assets', '/api/v2/reservations', '/api/v2/settings/geotab-thresholds',
].map((path) => [`GET ${path}`, async ({ route }: Parameters<ApiMockHandler>[0]) => fulfillSuccess(route, { items: [], totalCount: 0, unreadCount: 0 })]));

test('Geotab accident card shows recent path and moves to accident intake after confirmation', async ({ page }) => {
  let currentItem = { ...pendingAccidentItem };
  let domainActionBody: Record<string, unknown> | null = null;

  await seedAuthSession(page, 'admin');
  await installApiMocks(page, {
    user: { role: 'admin' },
    handlers: {
      'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [currentItem], totalCount: 1 }),
      'GET /api/v2/action-items/GEOTAB-ACTION%3Acompany-001%3AVIN-GEO-1%3Aaccident_suspected': async ({ route }) => fulfillSuccess(route, currentItem),
      'GET /api/v2/settings/members': async ({ route }) => fulfillSuccess(route, { items: [] }),
      'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
      'GET /api/v2/geotab/vehicles/VIN-GEO-1/positions': async ({ route }) => fulfillSuccess(route, {
        vehicleId: 'VIN-GEO-1',
        vehicleNumber: '12가3456',
        positions: [
          { latitude: 37.5001, longitude: 127.0301, recordedAt: '2026-09-23T01:00:00Z', speedKph: 12 },
          { latitude: 37.5012, longitude: 127.0323, recordedAt: '2026-09-23T01:02:03Z', speedKph: 0 },
        ],
      }),
      'POST /api/v2/action-items/GEOTAB-ACTION%3Acompany-001%3AVIN-GEO-1%3Aaccident_suspected/domain-action': async ({ route, request }) => {
        domainActionBody = request.postDataJSON();
        currentItem = {
          ...currentItem,
          status: 'in_progress',
          statusCode: 'in_progress',
          customerConfirmationStatus: 'confirmed',
          telemetryCardStatus: 'accident_intake',
        };
        await fulfillSuccess(route, { actionItem: currentItem });
      },
    },
  });

  await page.goto('/action-required');
  await expect(page.getByText('테스트 고객')).toBeVisible();

  await page.getByRole('button', { name: '최근 위치 조회', exact: true }).first().click();
  const mapDialog = page.getByRole('dialog', { name: '최근 위치 조회' });
  await expect(mapDialog).toContainText('37.50120, 127.03230');
  await expect(mapDialog).toContainText('최근 위치');
  await expect(mapDialog.getByTestId('telemetry-route-line')).toBeVisible();
  await expect(mapDialog.getByTestId('telemetry-latest-marker')).toBeVisible();
  await mapDialog.getByRole('button', { name: '최근 위치 조회 닫기' }).click();

  await page.getByRole('button', { name: '보기', exact: true }).click();
  await expect(page.getByText('사고 확인 알림')).toBeVisible();
  await expect(page.getByText('고객 확인 상태: 확인 대기')).toBeVisible();
  await page.getByRole('button', { name: '고객 사고 확인', exact: true }).click();

  await expect.poll(() => domainActionBody).toMatchObject({ action: 'customer_confirmation_confirmed' });
  await expect(page.getByText('고객 확인 상태: 사고 확인됨')).toBeVisible();
  await expect(page.getByText('사고접수 단계로 전환되었습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '고객 사고 확인', exact: true })).toHaveCount(0);
});

test('tenant admin maps collected serial to Pangea plate without changing provider ID', async ({ page }) => {
  let mappingBody: Record<string, unknown> | null = null;
  const device = { id: 'inventory-1', deviceId: 'b1', sourceDatabase: 'fleet', serialNumber: 'G9TEST123', name: 'G9TEST123',
    providerVin: 'PROVIDER-VIN', providerPlate: '', deviceType: 'GO9', mapped: false, revision: 0, lastSyncedAt: '2026-09-29T00:00:00Z' };
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, {
    user: { role: 'admin' },
    handlers: {
      ...settingsMocks,
      'GET /api/v2/geotab/devices': async ({ route }) => fulfillSuccess(route, { items: [device] }),
      'GET /api/v2/geotab/mapping-vehicles': async ({ route }) => fulfillSuccess(route, { items: [{ vin: 'PANGEA-VIN', vehicleNumber: '12가3456' }], hasMore: false }),
      'PATCH /api/v2/geotab/devices/inventory-1/mapping': async ({ route, request }) => {
        mappingBody = request.postDataJSON();
        await fulfillSuccess(route, { ...device, vin: 'PANGEA-VIN', vehicleNumber: '12가3456', mapped: true, revision: 1, replayedCount: 2 });
      },
      'GET /api/v2/geotab/vehicles/PANGEA-VIN/positions': async ({ route }) => fulfillSuccess(route, {
        vehicleId: 'PANGEA-VIN', vehicleNumber: '12가3456',
        positions: [{ latitude: 37.5, longitude: 127.1, recordedAt: '2026-09-29T00:00:00Z' }],
      }),
    },
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: '지오펜스', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Geotab 단말 차량 매칭' });
  await panel.getByLabel('수집된 단말 일련번호').selectOption('inventory-1');
  await expect(panel).toContainText('MyGeotab 차량번호: 미입력');
  await panel.getByLabel('연결할 Pangea 차량번호', { exact: true }).selectOption('PANGEA-VIN');
  await panel.getByRole('button', { name: '차량 매칭 저장' }).click();
  await expect.poll(() => mappingBody).toEqual({ vin: 'PANGEA-VIN', revision: 0 });
  await expect(panel).toContainText('현재 매칭: 12가3456');
  await expect(panel).toContainText('보관 중인 데이터 2건을 차량에 연결했습니다');
  await expect(panel).toContainText('단말 ID: b1');
  await expect(panel.getByRole('button', { name: '최근 위치 조회' })).toBeVisible();
  await panel.getByRole('button', { name: '최근 위치 조회' }).click();
  await expect(page.getByRole('dialog', { name: '최근 위치 조회' })).toContainText('37.50000, 127.10000');
});

test('mapping conflict is visible and does not claim a successful match', async ({ page }) => {
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    ...settingsMocks,
    'GET /api/v2/geotab/devices': async ({ route }) => fulfillSuccess(route, { items: [{ id: 'd1', deviceId: 'b1', serialNumber: 'G9TEST', sourceDatabase: 'fleet', name: '', mapped: false, revision: 0, lastSyncedAt: '2026-09-29T00:00:00Z' }] }),
    'GET /api/v2/geotab/mapping-vehicles': async ({ route }) => fulfillSuccess(route, { items: [{ vin: 'V1', vehicleNumber: '12가3456' }], hasMore: false }),
    'PATCH /api/v2/geotab/devices/d1/mapping': async ({ route }) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: { code: 'MAPPING_CONFLICT', message: 'mapping changed; refresh before saving' } }) }),
  } });
  await page.goto('/settings');
  await page.getByRole('button', { name: '지오펜스', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Geotab 단말 차량 매칭' });
  await panel.getByLabel('수집된 단말 일련번호').selectOption('d1');
  await panel.getByLabel('연결할 Pangea 차량번호', { exact: true }).selectOption('V1');
  await panel.getByRole('button', { name: '차량 매칭 저장' }).click();
  await expect(panel.getByRole('alert')).toContainText('mapping changed');
  await expect(panel).toContainText('현재 매칭: 미매칭');
});
