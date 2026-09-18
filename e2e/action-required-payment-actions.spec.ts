import { expect, test } from '@playwright/test';

import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

const paymentActionItem = {
  id: 'ACTION-PAY-1',
  type: '정산/수납',
  category: '정산/수납',
  subCategory: '월 렌트료 연체',
  reasonType: 'long_term_monthly_overdue',
  issueCode: 'payment.long_term_monthly_overdue',
  relatedChargeItemId: 'CHG-PAY-1',
  paymentId: 'PAY-PAY-1',
  vehicleNumber: '12가3456',
  customerName: '장기고객',
  date: '2026-05-10T00:00:00Z',
  severity: 'High',
  status: '대기중',
  statusCode: 'pending',
  assignee: '담당자',
  reservationId: 'R-PAY-1',
  paymentInfo: {
    reservationId: 'R-PAY-1',
    principalAmount: 550000,
    additionalAmount: 0,
    amount: 550000,
    totalAmount: 550000,
    overdueDays: 5,
    dueDate: '2026-05-10',
    paymentType: '계좌이체',
    status: 'overdue',
    statusLabel: '연체',
  },
};

test.describe('Action Required payment actions', () => {
  async function openPaymentCase(page: import('@playwright/test').Page, permissions: string[], item = paymentActionItem, role: 'member' | 'admin' = 'member') {
    let mutationCount = 0;
    page.on('request', (request) => {
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())
        && /\/api\/v2\/(?:payments|payment-records|charge-items|reservations\/[^/]+\/(?:payment-records|charge-items))\b/.test(request.url())) {
        mutationCount += 1;
      }
    });
    await seedAuthSession(page, role, {}, permissions);
    await installApiMocks(page, { user: { role }, handlers: {
      'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [item], totalCount: 1 }),
      'GET /api/v2/action-items/ACTION-PAY-1': async ({ route }) => fulfillSuccess(route, item),
      'GET /api/v2/settings/members': async ({ route }) => fulfillSuccess(route, { items: [] }),
      'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
      'PATCH /api/v2/payments/PAY-PAY-1/status': async ({ route }) => fulfillSuccess(route, item),
    }});
    await page.goto('/action-required');
    await page.getByRole('button', { name: '보기', exact: true }).click();
    return () => mutationCount;
  }

  test('member without payment grants has no payment controls and sends no mutation', async ({ page }) => {
    const count = await openPaymentCase(page, ['route.action-required', 'action.action-required.write'], { ...paymentActionItem, relatedChargeItemId: undefined });
    await expect(page.getByRole('button', { name: '결제 완료 처리', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '결제 면제 처리', exact: true })).toHaveCount(0);
    await expect(page.getByText('추가 결제 금액 직접 수정')).toHaveCount(0);
    expect(count()).toBe(0);
  });

  test('resolved payment issue has no controls even for admin', async ({ page }) => {
    const count = await openPaymentCase(page, ['route.action-required', 'action.action-required.write', 'action.payments.write', 'action.payments.confirm', 'action.payments.void', 'action.billing.charges.write'], { ...paymentActionItem, statusCode: 'resolved', status: '완료', relatedChargeItemId: undefined }, 'admin');
    await expect(page.getByRole('button', { name: '결제 완료 처리', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '결제 면제 처리', exact: true })).toHaveCount(0);
    await expect(page.getByText('추가 결제 금액 직접 수정')).toHaveCount(0);
    expect(count()).toBe(0);
  });

  test('confirm-only member sees paid action but cannot edit amount or cancel', async ({ page }) => {
    const confirmOnlyItem = { ...paymentActionItem, relatedChargeItemId: undefined };
    let patchCount = 0;
    let patchBody: unknown;
    await seedAuthSession(page, 'member', {}, ['route.action-required', 'action.action-required.write', 'action.payments.confirm']);
    await installApiMocks(page, { user: { role: 'member' }, handlers: {
      'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [confirmOnlyItem], totalCount: 1 }),
      'GET /api/v2/action-items/ACTION-PAY-1': async ({ route }) => fulfillSuccess(route, confirmOnlyItem),
      'GET /api/v2/settings/members': async ({ route }) => fulfillSuccess(route, { items: [] }),
      'PATCH /api/v2/payments/PAY-PAY-1/status': async ({ route, request }) => { patchCount += 1; patchBody = request.postDataJSON(); await fulfillSuccess(route, { ...confirmOnlyItem, status: 'paid' }); },
      'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
      'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
    }});
    await page.goto('/action-required');
    await page.getByRole('button', { name: '보기', exact: true }).click();
    await expect(page.getByRole('button', { name: '결제 완료 처리', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '결제 면제 처리', exact: true })).toBeDisabled();
    await expect(page.getByText('추가 결제 금액 직접 수정')).toBeHidden();
    await page.getByRole('button', { name: '결제 완료 처리', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '결제 완료 처리하시겠습니까?' });
    await dialog.getByRole('button', { name: '결제 완료 처리' }).click();
    await expect.poll(() => patchCount).toBe(1);
    expect(patchBody).toMatchObject({ status: 'paid', reservationId: 'R-PAY-1' });
  });

  test('requires confirmation before creating a payment record', async ({ page }) => {
    let paymentCreateCount = 0;

    await seedAuthSession(page, 'admin');
    await installApiMocks(page, {
      user: { role: 'admin' },
      handlers: {
        'GET /api/v2/action-items': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [paymentActionItem],
            totalCount: 1,
            page: 1,
            pageSize: 100,
          });
        },
        'GET /api/v2/action-items/ACTION-PAY-1': async ({ route }) => {
          await fulfillSuccess(route, paymentActionItem);
        },
        'POST /api/v2/reservations/R-PAY-1/payment-records': async ({ route }) => {
          paymentCreateCount += 1;
          await fulfillSuccess(route, {
            id: 'PAYMENT-RECORD-1',
            reservationId: 'R-PAY-1',
            amount: 550000,
          });
        },
        'PATCH /api/v2/action-items/ACTION-PAY-1/status': async ({ route }) => {
          await fulfillSuccess(route, {
            ...paymentActionItem,
            status: '완료',
            statusCode: 'resolved',
          });
        },
        'GET /api/v2/settings/members': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'GET /api/v2/notifications': async ({ route }) => {
          await fulfillSuccess(route, { items: [], totalCount: 0, unreadCount: 0 });
        },
        'GET /api/v2/notifications/summary': async ({ route }) => {
          await fulfillSuccess(route, { unreadCount: 0 });
        },
      },
    });

    await page.goto('/action-required');
    await expect(page.getByText('장기고객')).toBeVisible();
    await page.getByRole('button', { name: '보기', exact: true }).click();

    await page.getByRole('button', { name: '결제 완료 처리', exact: true }).click();
    expect(paymentCreateCount).toBe(0);

    const dialog = page.getByRole('dialog', { name: '결제 완료 처리하시겠습니까?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('550,000원');
    await dialog.getByRole('button', { name: '결제 완료 처리' }).click();

    await expect.poll(() => paymentCreateCount).toBe(1);
  });
});
