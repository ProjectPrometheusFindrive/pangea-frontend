import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';
import { TEST_IMAGE_FILE } from './helpers/files';

function dateOffset(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

test('예약 생성은 검사기간 경고 확인 후 acknowledgement payload를 전송한다', async ({ page }) => {
  const inspectionDate = dateOffset(10);
  const rentalStart = dateOffset(5);
  const rentalEnd = dateOffset(20);
  const asset = { vehicleNumber: '12가3456', model: '아반떼', vin: 'VIN-INSPECTION-1', year: '2024', status: '가용', issues: ['정기점검'], insuranceExpiry: '2027-12-31', nextInspection: inspectionDate };
  let createCount = 0;
  await page.route('https://signed.example/**', async (route) => route.fulfill({ status: 200, body: '' }));
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/reservations': async ({ route }) => fulfillSuccess(route, { reservations: [], assets: [asset], total: 0, page: 1, pageSize: 20 }),
    'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [asset], total: 1, page: 1, size: 500 }),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [{ issue: '정기점검', vehicleNumber: '12가3456' }], totalCount: 1 }),
    'POST /api/v2/reservations/prepare': async ({ route }) => fulfillSuccess(route, { reservationId: 'R-INSPECT-1' }),
    'POST /api/v2/assets/upload': async ({ route }) => fulfillSuccess(route, { uploadUrl: 'https://signed.example/license', objectName: 'license.png', contentType: 'image/png' }),
    'POST /api/v2/reservations': async ({ route, request }) => {
      createCount += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      if (createCount === 1) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { type: 'INSPECTION_ACK_REQUIRED', message: 'INSPECTION_ACK_REQUIRED' } }) });
        return;
      }
      expect(body.inspectionAcknowledged).toBe(true);
      await fulfillSuccess(route, { id: 'R-INSPECT-1', reservationId: 'R-INSPECT-1', vehicleNumber: '12가3456', contractStatus: '예약중' }, 201);
    },
  }});
  await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
  await page.getByTestId('reservation-new-contract-button').click();
  await page.getByTestId('new-contract-start-date-input').fill(rentalStart);
  await page.getByTestId('new-contract-end-date-input').fill(rentalEnd);
  await page.getByTestId('new-contract-vehicle-select').selectOption('12가3456');
  await page.getByTestId('new-contract-step1-next').click();
  await page.getByTestId('new-contract-customer-name-input').fill('검사고객');
  await page.getByTestId('new-contract-customer-phone-input').fill('010-2222-3333');
  await page.getByTestId('new-contract-customer-license-input').fill('11-123456-78');
  await page.getByTestId('new-contract-customer-address-input').fill('서울특별시 강남구');
  await page.getByTestId('new-contract-pickup-location-input').fill('강남');
  await page.getByTestId('new-contract-return-location-input').fill('서초');
  await page.getByTestId('new-contract-amount-input').fill('350000');
  await page.getByTestId('new-contract-step2-next').click();
  await page.getByTestId('new-contract-license-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('new-contract-submit').click();
  await expect(page.getByRole('button', { name: '예약 진행' })).toBeVisible();
  await page.getByRole('button', { name: '예약 진행' }).click();
  await expect(page.getByTestId('new-contract-submit-error')).toContainText('다시 제출');
  await expect(page.getByRole('dialog', { name: '정기점검 확인' })).toBeVisible();
  await page.getByRole('button', { name: '확인 후 재제출' }).click();
  await expect(page.getByTestId('new-contract-modal')).toHaveCount(0);
  expect(createCount).toBe(2);
});

function kstIso(dateTimeLocal: string): string {
  const [date, time] = dateTimeLocal.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
}

async function openInspectionEdit(page: import('@playwright/test').Page, start: string, end: string) {
  const reservation = {
    id: 'R-EDIT-INSPECT', vehicleNumber: '12가3456', customerName: '수정고객',
    startAt: kstIso(start), endAt: kstIso(end), contractStatus: '예약중',
    paymentMethod: '카드', paymentStatus: '대기', amount: 250000, deposit: 0,
  };
  const asset = { vehicleNumber: '12가3456', model: '아반떼', vin: 'VIN-EDIT-1', year: '2024', status: '가용', issues: ['정기점검'], insuranceExpiry: '2027-12-31', nextInspection: dateOffset(10) };
  return { reservation, asset };
}

test('예약 수정은 검사 확인 dialog 승인 후 동일 변경과 boolean acknowledgement를 재전송한다', async ({ page }) => {
  const start = `${dateOffset(5)}T10:30`;
  const end = `${dateOffset(20)}T18:00`;
  const { reservation, asset } = await openInspectionEdit(page, start, end);
  let patchCount = 0;
  let retryBody: Record<string, unknown> | null = null;
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/reservations': async ({ route }) => fulfillSuccess(route, { reservations: [reservation], assets: [asset], total: 1, page: 1, pageSize: 20 }),
    'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [asset], total: 1, page: 1, size: 500 }),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
    'GET /api/v2/reservations/R-EDIT-INSPECT': async ({ route }) => fulfillSuccess(route, reservation),
    'PATCH /api/v2/reservations/R-EDIT-INSPECT': async ({ route, request }) => {
      patchCount += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      if (patchCount === 1) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { type: 'INSPECTION_ACK_REQUIRED', message: 'INSPECTION_ACK_REQUIRED' } }) });
        return;
      }
      retryBody = body;
      await fulfillSuccess(route, { ...reservation, startAt: body.startAt, endAt: body.endAt });
    },
  }});
  await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
  await page.getByTestId('reservation-block-R-EDIT-INSPECT').click();
  await page.getByTestId('reservation-edit-button').click();
  await page.locator('input[type="datetime-local"]').nth(0).fill(start);
  await page.locator('input[type="datetime-local"]').nth(1).fill(end);
  await page.getByTestId('reservation-edit-submit-button').click();
  await expect(page.getByRole('dialog', { name: '정기점검 수정 확인' })).toBeVisible();
  await page.getByRole('button', { name: '확인 후 재제출' }).click();
  await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '정기점검 수정 확인' })).toHaveCount(0);
  expect(patchCount).toBe(2);
  expect(retryBody).toMatchObject({ startAt: kstIso(start), endAt: kstIso(end), inspectionAcknowledged: true });
});

test('예약 수정 검사 확인을 취소하면 입력을 보존하고 PATCH를 재시도하지 않는다', async ({ page }) => {
  const start = `${dateOffset(5)}T10:30`;
  const end = `${dateOffset(20)}T18:00`;
  const { reservation, asset } = await openInspectionEdit(page, start, end);
  let patchCount = 0;
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/reservations': async ({ route }) => fulfillSuccess(route, { reservations: [reservation], assets: [asset], total: 1, page: 1, pageSize: 20 }),
    'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [asset], total: 1, page: 1, size: 500 }),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
    'GET /api/v2/reservations/R-EDIT-INSPECT': async ({ route }) => fulfillSuccess(route, reservation),
    'PATCH /api/v2/reservations/R-EDIT-INSPECT': async ({ route }) => {
      patchCount += 1;
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { type: 'INSPECTION_ACK_REQUIRED', message: 'INSPECTION_ACK_REQUIRED' } }) });
    },
  }});
  await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
  await page.getByTestId('reservation-block-R-EDIT-INSPECT').click();
  await page.getByTestId('reservation-edit-button').click();
  const startInput = page.locator('input[type="datetime-local"]').nth(0);
  await startInput.fill(start);
  await page.locator('input[type="datetime-local"]').nth(1).fill(end);
  await page.getByTestId('reservation-edit-submit-button').click();
  await page.getByRole('dialog', { name: '정기점검 수정 확인' }).getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('dialog', { name: '정기점검 수정 확인' })).toHaveCount(0);
  await expect(startInput).toHaveValue(start);
  expect(patchCount).toBe(1);
});
