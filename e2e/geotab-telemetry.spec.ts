import { expect, test } from '@playwright/test';

import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
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
