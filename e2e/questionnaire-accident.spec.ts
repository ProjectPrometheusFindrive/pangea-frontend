import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

test('member saves accident intake draft without acquiring financial execution rights', async ({ page }) => {
  const permissions = ['route.action-required', 'action.action-required.write', 'action.accident-claims.draft'];
  const item = {
    id: 'ACT-ACCIDENT', type: '대여 중 사고', category: '대여 중 사고', subCategory: '사고 정보 보완',
    issueCode: 'rental_accident.intake_required', reasonType: 'rental_accident_intake_required',
    status: '대기중', statusCode: 'pending', reservationId: 'R-ACCIDENT', vehicleNumber: '12가3456', customerName: '사고 테스트',
  };
  let saved: Record<string, unknown> | null = null;
  await seedAuthSession(page, 'member', {}, permissions);
  await installApiMocks(page, { user: { role: 'member' }, handlers: {
    'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions }),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [item], totalCount: 1 }),
    'GET /api/v2/action-items/ACT-ACCIDENT': async ({ route }) => fulfillSuccess(route, item),
    'GET /api/v2/reservations/R-ACCIDENT': async ({ route }) => fulfillSuccess(route, { id: 'R-ACCIDENT', accidentReported: true, accidentReport: { evidenceStatus: 'pending' } }),
    'PATCH /api/v2/reservations/R-ACCIDENT/accident-followup': async ({ route, request }) => { saved = request.postDataJSON(); await fulfillSuccess(route, { id: 'R-ACCIDENT', accidentReport: saved }); },
  }});
  await page.goto('/action-required');
  await page.getByRole('button', { name: '보기', exact: true }).click();
  await page.getByPlaceholder('사고 장소', { exact: true }).fill('합성 테스트 장소');
  await page.getByPlaceholder('상대방 정보', { exact: true }).fill('합성 테스트 상대');
  await page.getByText('고객부담금', { exact: true }).last().click();
  await expect(page.locator('option[value="paid"]')).toBeDisabled();
  await expect(page.getByRole('option', { name: '면제', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /사고.*저장|접수.*저장/ }).click();
  await expect.poll(() => saved).toBeTruthy();
  expect(saved).toMatchObject({ accidentLocation: '합성 테스트 장소', opponentInfo: '합성 테스트 상대', evidenceStatus: 'pending', customerChargeStatus: 'none' });
});
