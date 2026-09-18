import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

const reservation = {
  id: 'R-LICENSE-1', vehicleNumber: '12가3456', customerName: '면허고객',
  startAt: '2026-09-17T00:00:00.000Z', endAt: '2026-09-20T09:00:00.000Z',
  contractStatus: '예약중', paymentMethod: '카드', paymentStatus: '대기', amount: 250000, deposit: 0,
  parties: { driver: { name: '면허고객', phone: '010-1111-2222', licenseNumber: '11-123456-78' } },
};
const asset = { vehicleNumber: '12가3456', model: '아반떼', vin: 'VIN-LICENSE-1', year: '2024', status: '가용', issues: [], insuranceExpiry: '2027-12-31', nextInspection: '2027-01-01' };

function commonHandlers() {
  return {
    'GET /api/v2/reservations': async ({ route }: any) => fulfillSuccess(route, { reservations: [reservation], assets: [asset], total: 1, page: 1, pageSize: 20 }),
    'GET /api/v2/assets': async ({ route }: any) => fulfillSuccess(route, { items: [asset], total: 1, page: 1, size: 500 }),
    'GET /api/v2/action-items': async ({ route }: any) => fulfillSuccess(route, { items: [], totalCount: 0 }),
    'GET /api/v2/reservations/R-LICENSE-1': async ({ route }: any) => fulfillSuccess(route, reservation),
  };
}

test('예약 상세에서 수동 면허 확인을 저장하고 서버 확인자와 시각을 표시한다', async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    ...commonHandlers(),
    'POST /api/v2/reservations/R-LICENSE-1/license-verification': async ({ route, request }: any) => {
      requestBody = request.postDataJSON();
      await fulfillSuccess(route, { result: 'verified', memo: '실물 면허 대조 완료', checkedBy: 'admin-1', checkedByName: '김관리자', checkedAt: '2026-09-16T03:00:00.000Z' });
    },
  }});
  await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
  await page.getByTestId('reservation-block-R-LICENSE-1').click();
  await expect(page.getByTestId('license-verification-panel')).toBeVisible();
  await page.getByLabel('수동 면허 확인 결과').selectOption('verified');
  await page.getByLabel('수동 면허 확인 메모').fill('실물 면허 대조 완료');
  await page.getByTestId('license-verification-save').click();
  await expect(page.getByTestId('license-verification-audit')).toContainText('김관리자');
  await expect(page.getByTestId('license-verification-audit')).toContainText('2026-09-16 12:00');
  expect(requestBody).toEqual({ result: 'verified', memo: '실물 면허 대조 완료' });
});

test('수동 면허 확인 저장 실패 시 입력값을 보존하고 오류를 표시한다', async ({ page }) => {
  let requestCount = 0;
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    ...commonHandlers(),
    'POST /api/v2/reservations/R-LICENSE-1/license-verification': async ({ route }: any) => {
      requestCount += 1;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '저장 실패' } }) });
    },
  }});
  await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
  await page.getByTestId('reservation-block-R-LICENSE-1').click();
  await page.getByLabel('수동 면허 확인 결과').selectOption('rejected');
  await page.getByLabel('수동 면허 확인 메모').fill('번호 불일치 확인');
  await page.getByTestId('license-verification-save').click();
  await expect(page.getByTestId('license-verification-error')).toContainText('저장 실패');
  await expect(page.getByLabel('수동 면허 확인 결과')).toHaveValue('rejected');
  await expect(page.getByLabel('수동 면허 확인 메모')).toHaveValue('번호 불일치 확인');
  expect(requestCount).toBe(1);
});
