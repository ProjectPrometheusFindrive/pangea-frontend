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
