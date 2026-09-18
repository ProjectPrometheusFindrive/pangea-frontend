import { expect, test, type Page } from '@playwright/test';

import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

const RESERVATION_ID = 'R-BILLING-GRANT';

function billingReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVATION_ID,
    vehicleNumber: '12가3456',
    customerName: '권한 검증 고객',
    startAt: '2026-09-17T00:00:00Z',
    endAt: '2026-09-20T09:00:00Z',
    contractStatus: '예약중',
    paymentMethod: '카드',
    paymentStatus: 'overdue',
    amount: 10000,
    billingSummary: {
      totalAmount: 10000,
      paidAmount: 0,
      remainingAmount: 10000,
      chargeItems: [
        { id: 'CHG-GRANT', chargeType: 'additional_fee', amount: 10000, remainingAmount: 10000, status: 'pending', payerType: 'customer' },
      ],
      paymentRecords: [],
    },
    ...overrides,
  };
}

async function openBilling(
  page: Page,
  permissions: string[],
  reservation = billingReservation(),
  extraHandlers: Record<string, (context: any) => Promise<void>> = {},
) {
  await installApiMocks(page, {
    user: { role: 'member' },
    handlers: {
      'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions }),
      'GET /api/v2/reservations': async ({ route }) => fulfillSuccess(route, {
        reservations: [reservation],
        assets: [{ vehicleNumber: '12가3456', model: '테스트', vin: 'VIN-GRANT', status: '가용', issues: [] }],
        total: 1,
      }),
      'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [], total: 0 }),
      [`GET /api/v2/reservations/${RESERVATION_ID}`]: async ({ route }) => fulfillSuccess(route, reservation),
      'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
      ...extraHandlers,
    },
  });
  await loginViaUi(page, 'member', { returnUrl: '/reservations', permissions });
  await page.getByTestId(`reservation-block-${RESERVATION_ID}`).click();
  await page.getByRole('button', { name: '결제 정보', exact: true }).click();
}

test('charges.write-only member can hold a charge and cannot waive, refund, or settle', async ({ page }) => {
  const permissions = ['route.reservations', 'action.reservations.write', 'action.billing.charges.write'];
  let patchBody: Record<string, unknown> | null = null;
  let forbiddenMutationCount = 0;
  await openBilling(page, permissions, billingReservation(), {
    'PATCH /api/v2/charge-items/CHG-GRANT': async ({ route, request }) => {
      patchBody = request.postDataJSON();
      await fulfillSuccess(route, { id: 'CHG-GRANT', status: 'disputed' });
    },
    'POST /api/v2/reservations/R-BILLING-GRANT/payment-records': async ({ route }) => {
      forbiddenMutationCount += 1;
      await fulfillSuccess(route, {});
    },
  });

  await expect(page.getByRole('button', { name: '보류', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '면제', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '환불완료', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '수납', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '청구 항목 추가' }).click();
  await expect(page.locator('select').last().locator('option[value="waived"]')).toHaveAttribute('disabled', '');
  await page.getByRole('button', { name: '취소', exact: true }).last().click();
  await page.getByRole('button', { name: '보류', exact: true }).click();
  await page.getByLabel('처리 사유').fill('고객 이의 제기 확인 중');
  await page.getByRole('button', { name: '예외정산 저장', exact: true }).click();
  await expect.poll(() => patchBody).not.toBeNull();
  expect(patchBody).toMatchObject({ status: 'disputed', memo: '고객 이의 제기 확인 중' });
  expect(forbiddenMutationCount).toBe(0);
});

test('create confirm allocate member settles an additional charge with exact payment payload', async ({ page }) => {
  const permissions = ['route.reservations', 'action.reservations.write', 'action.payments.create', 'action.payments.confirm', 'action.payments.allocate'];
  let paymentBody: Record<string, unknown> | null = null;
  let otherMutationCount = 0;
  await openBilling(page, permissions, billingReservation(), {
    'POST /api/v2/reservations/R-BILLING-GRANT/payment-records': async ({ route, request }) => {
      paymentBody = request.postDataJSON();
      await fulfillSuccess(route, { id: 'PAY-GRANT', confirmationStatus: 'confirmed' });
    },
    'PATCH /api/v2/charge-items/CHG-GRANT': async ({ route }) => {
      otherMutationCount += 1;
      await fulfillSuccess(route, {});
    },
  });

  await page.getByRole('button', { name: '수납', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '수납 처리', exact: true }).click();
  await expect.poll(() => paymentBody).not.toBeNull();
  expect(paymentBody).toMatchObject({
    amount: 10000,
    confirmationStatus: 'confirmed',
    allocations: [{ chargeItemId: 'CHG-GRANT', amount: 10000 }],
  });
  expect(otherMutationCount).toBe(0);
});

test('confirm-only legacy member can complete overdue payment but cannot cancel it', async ({ page }) => {
  const permissions = ['route.reservations', 'action.reservations.write', 'action.payments.confirm'];
  let statusBody: Record<string, unknown> | null = null;
  await openBilling(page, permissions, billingReservation({
    paymentStatus: 'overdue',
    billingSummary: undefined,
    paymentInfo: { paymentId: 'PAY-LEGACY', status: 'overdue', amount: 10000, additionalAmount: 0 },
  }), {
    'PATCH /api/v2/payments/*': async ({ route, request }) => {
      statusBody = request.postDataJSON();
      await fulfillSuccess(route, {});
    },
  });
  await expect(page.getByTestId('reservation-payment-complete-button')).toBeVisible();
  await expect(page.getByRole('button', { name: '결제 면제 처리', exact: true })).toHaveCount(0);
  await page.getByTestId('reservation-payment-complete-button').click();
  await page.getByRole('dialog').getByRole('button', { name: '결제 완료 처리', exact: true }).click();
  await expect.poll(() => statusBody).not.toBeNull();
  expect(statusBody).toMatchObject({ status: 'paid', reservationId: RESERVATION_ID });
});

test('void-only legacy member can cancel overdue payment but cannot complete it', async ({ page }) => {
  const permissions = ['route.reservations', 'action.reservations.write', 'action.payments.void'];
  let statusBody: Record<string, unknown> | null = null;
  await openBilling(page, permissions, billingReservation({
    billingSummary: undefined,
    paymentInfo: { paymentId: 'PAY-LEGACY', status: 'overdue', amount: 10000, additionalAmount: 0 },
  }), {
    'PATCH /api/v2/payments/*': async ({ route, request }) => {
      statusBody = request.postDataJSON();
      await fulfillSuccess(route, {});
    },
  });
  await expect(page.getByTestId('reservation-payment-complete-button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '결제 면제 처리', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '결제 면제 처리', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '결제 면제 처리', exact: true }).click();
  await expect.poll(() => statusBody).not.toBeNull();
  expect(statusBody).toMatchObject({ status: 'canceled', reservationId: RESERVATION_ID });
});

test('charges-only member edits legacy amount and method while create-only member sees no legacy edit UI', async ({ page, browser }) => {
  const chargesPermissions = ['route.reservations', 'action.reservations.write', 'action.billing.charges.write'];
  const chargesPage = page;
  const reservation = billingReservation({
    billingSummary: undefined,
    paymentInfo: { paymentId: 'PAY-LEGACY', status: 'overdue', amount: 10000, additionalAmount: 0, method: '카드' },
  });
  const statusBodies: Record<string, unknown>[] = [];
  await openBilling(chargesPage, chargesPermissions, reservation, {
    'PATCH /api/v2/payments/*': async ({ route, request }) => {
      const body = request.postDataJSON() as Record<string, unknown>;
      statusBodies.push(body);
      const paymentInfo = reservation.paymentInfo as Record<string, unknown>;
      if (typeof body.method === 'string') {
        paymentInfo.method = body.method;
        reservation.paymentMethod = body.method;
      }
      if (typeof body.additionalAmount === 'number') {
        paymentInfo.additionalAmount = body.additionalAmount;
      }
      await fulfillSuccess(route, reservation);
    },
  });
  await expect(chargesPage.getByLabel('결제 방법 선택')).toBeVisible();
  await chargesPage.getByLabel('결제 방법 선택').selectOption('현금');
  await chargesPage.getByRole('button', { name: '저장', exact: true }).first().click();
  await expect.poll(() => statusBodies.length).toBe(1);
  await chargesPage.getByLabel('추가 결제 금액').fill('12000');
  await expect(chargesPage.getByLabel('추가 결제 금액')).toHaveValue('12000');
  await chargesPage.getByRole('button', { name: '저장', exact: true }).last().click();
  await expect.poll(() => statusBodies.length).toBe(2);
  expect(statusBodies).toEqual(expect.arrayContaining([
    expect.objectContaining({ status: 'pending', method: '현금' }),
    expect.objectContaining({ status: 'overdue', additionalAmount: 12000 }),
  ]));

  const createOnlyPage = await browser.newPage();
  await openBilling(createOnlyPage, ['route.reservations', 'action.reservations.write', 'action.payments.create'], billingReservation({
    billingSummary: undefined,
    paymentInfo: { paymentId: 'PAY-LEGACY', status: 'overdue', amount: 10000, additionalAmount: 0, method: '카드' },
  }));
  await expect(createOnlyPage.getByLabel('결제 방법 선택')).toHaveCount(0);
  await expect(createOnlyPage.getByLabel('추가 결제 금액')).toHaveCount(0);
  await createOnlyPage.close();
});
