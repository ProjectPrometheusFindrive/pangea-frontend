import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi, seedAuthSession } from './helpers/session';

const item = {
  id: 'POLICY-PAY-1', type: '정산/수납', category: '정산/수납', subCategory: '환불 필요',
  issueCode: 'payment.deposit_refund_due', reasonType: 'payment.deposit_refund_due', status: '대기중', statusCode: 'pending',
  vehicleNumber: '12가3456', customerName: '정책 테스트', reservationId: 'R-POLICY-1',
  paymentInfo: { reservationId: 'R-POLICY-1', amount: 10000, totalAmount: 10000, status: 'refund_due' },
  workContext: { module: 'payment_deposit_refund', sourceSnapshot: { chargeItems: [{ id: 'CHG-1', amount: 10000, remainingAmount: 10000, status: 'refund_due', chargeType: 'refund' }] } },
};
const claimItem = {
  id: 'POLICY-CLAIM-1', type: '대차/보험청구', category: '대차/보험청구', subCategory: '사고 접수 정보 보완',
  issueCode: 'accident_claim.intake', reasonType: 'accident_replacement_info_missing', status: '대기중', statusCode: 'pending',
  vehicleNumber: '12가3456', customerName: '청구 정책 테스트', reservationId: 'R-CLAIM-1',
  workContext: { sourceSnapshot: { accidentClaim: { claimNo: '', insurerName: '', repairShopName: '' } } },
};

async function setup(page: import('@playwright/test').Page, permissions: string[]) {
  await seedAuthSession(page, 'member', {}, permissions);
  await installApiMocks(page, { user: { role: 'member' }, handlers: {
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [item], totalCount: 1, page: 1, pageSize: 20 }),
    'GET /api/v2/action-items/POLICY-PAY-1': async ({ route }) => fulfillSuccess(route, item),
    'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0, unreadCount: 0 }),
    'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
  }});
  await page.goto('/action-required');
  await expect(page.getByText('정책 테스트')).toBeVisible();
  await page.getByRole('button', { name: '보기', exact: true }).click();
}

test('member draft grant can save claim draft but cannot submit it', async ({ page }) => {
  let draftBody: Record<string, unknown> | null = null;
  let submitCount = 0;
  await seedAuthSession(page, 'member', {}, ['route.action-required', 'action.action-required.write', 'action.accident-claims.draft']);
  await installApiMocks(page, { user: { role: 'member' }, handlers: {
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [claimItem], totalCount: 1, page: 1, pageSize: 20 }),
    'GET /api/v2/action-items/POLICY-CLAIM-1': async ({ route }) => fulfillSuccess(route, claimItem),
    'GET /api/v2/reservations/R-CLAIM-1/accident-claim': async ({ route }) => fulfillSuccess(route, { claimNo: '', insurerName: '', repairShopName: '' }),
    'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0, unreadCount: 0 }),
    'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
    'PATCH /api/v2/reservations/R-CLAIM-1/accident-claim': async ({ route, request }: any) => { draftBody = request.postDataJSON(); await fulfillSuccess(route, { ok: true }); },
    'PATCH /api/v2/action-items/POLICY-CLAIM-1/status': async ({ route }: any) => fulfillSuccess(route, { ok: true }),
    'POST /api/v2/reservations/R-CLAIM-1/accident-claim/submit': async ({ route }: any) => { submitCount += 1; await fulfillSuccess(route, { ok: true }); },
  }});
  await page.goto('/action-required');
  await page.getByText('청구 정책 테스트').click();
  await page.getByRole('button', { name: '보기', exact: true }).click();
  await page.getByRole('button', { name: '접수 정보 저장' }).click();
  await expect.poll(() => draftBody).not.toBeNull();
  expect(draftBody).not.toHaveProperty('approvalRequired');
  expect(draftBody).not.toHaveProperty('approvedBy');
  const submit = page.getByRole('button', { name: '보험사에 청구 제출 처리' });
  await expect(submit).toHaveCount(0);
  expect(submitCount).toBe(0);
});

test('member draft-only cannot submit or refund', async ({ page }) => {
  await setup(page, ['route.action-required', 'action.action-required.write', 'action.accident-claims.draft']);
  await expect(page.getByRole('button', { name: '환불 완료 처리' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '면제 처리' })).toHaveCount(0);
});

test('member allocate-only saves allocations without confirm, void or payment creation', async ({ page }) => {
  const permissions = ['route.reservations', 'action.reservations.write', 'action.payments.allocate'];
  let allocationBody: unknown;
  let forbiddenCalls = 0;
  const reservation = {
    id: 'R-ALLOC-1', vehicleNumber: '12가3456', customerName: '배정 고객',
    startAt: '2026-09-17T00:00:00Z', endAt: '2026-09-20T09:00:00Z',
    contractStatus: '예약중', paymentMethod: '카드', paymentStatus: '대기', amount: 10000,
    billingSummary: {
      totalAmount: 10000, remainingAmount: 10000, paymentSummaryStatus: 'pending',
      chargeItems: [{ id: 'CHG-ALLOC', chargeType: 'rental_fee', amount: 10000, remainingAmount: 10000, status: 'pending' }],
      paymentRecords: [{ id: 'PAY-ALLOC', amount: 10000, status: 'active', confirmationStatus: 'needs_confirmation', allocations: [{ chargeItemId: 'CHG-ALLOC', amount: 10000 }] }],
    },
  };
  const asset = { vehicleNumber: '12가3456', model: '테스트', vin: 'VIN-ALLOC', status: '가용', issues: [] };
  await installApiMocks(page, { user: { role: 'member' }, handlers: {
    'GET /api/v2/permissions/me': async ({ route }) => fulfillSuccess(route, { permissions }),
    'GET /api/v2/reservations': async ({ route }) => fulfillSuccess(route, { reservations: [reservation], assets: [asset], total: 1 }),
    'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [asset], total: 1 }),
    'GET /api/v2/reservations/R-ALLOC-1': async ({ route }) => fulfillSuccess(route, reservation),
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
    'POST /api/v2/payment-records/PAY-ALLOC/allocate': async ({ route, request }) => { allocationBody = request.postDataJSON(); await fulfillSuccess(route, reservation.billingSummary.paymentRecords[0]); },
    'POST /api/v2/payment-records/PAY-ALLOC/confirm': async ({ route }) => { forbiddenCalls += 1; await fulfillSuccess(route, {}); },
    'POST /api/v2/payment-records/PAY-ALLOC/void': async ({ route }) => { forbiddenCalls += 1; await fulfillSuccess(route, {}); },
    'POST /api/v2/reservations/R-ALLOC-1/payment-records': async ({ route }) => { forbiddenCalls += 1; await fulfillSuccess(route, {}); },
  }});
  await loginViaUi(page, 'member', { returnUrl: '/reservations', permissions });
  await page.getByTestId('reservation-block-R-ALLOC-1').click();
  await page.getByRole('button', { name: '결제 정보', exact: true }).click();
  await expect(page.getByRole('button', { name: '배정수정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '확정', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '무효', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '배정수정', exact: true }).click();
  await page.getByRole('button', { name: '배정 저장', exact: true }).click();
  await expect.poll(() => allocationBody).toBeTruthy();
  expect(allocationBody).toMatchObject({ allocations: [{ chargeItemId: 'CHG-ALLOC', amount: 10000 }] });
  expect(forbiddenCalls).toBe(0);
});

test('member refund-only can submit refund but cannot waive it', async ({ page }) => {
  let patchCount = 0;
  await seedAuthSession(page, 'member', {}, ['route.action-required', 'action.action-required.write', 'action.payments.refund']);
  await installApiMocks(page, { user: { role: 'member' }, handlers: {
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [item], totalCount: 1, page: 1, pageSize: 20 }),
    'GET /api/v2/action-items/POLICY-PAY-1': async ({ route }) => fulfillSuccess(route, item),
    'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0, unreadCount: 0 }),
    'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
    'PATCH /api/v2/charge-items/CHG-1': async ({ route }) => { patchCount += 1; await fulfillSuccess(route, { id: 'CHG-1', status: 'refunded' }); },
  }});
  await page.goto('/action-required');
  await page.getByText('정책 테스트').click();
  await page.getByRole('button', { name: '보기', exact: true }).click();
  const refund = page.getByRole('button', { name: '환불 완료 처리' });
  await expect(refund).toBeEnabled();
  await expect(page.getByRole('button', { name: '면제 처리' })).toHaveCount(0);
  await refund.click();
  await expect(page.getByRole('button', { name: '처리' }).last()).toBeVisible();
  await page.getByRole('button', { name: '처리' }).last().click();
  expect(patchCount).toBe(1);
});
