import { expect, test, type Page } from '@playwright/test';

import { buildMockUser, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

interface SupportTicketFixture {
  id: string;
  companyId: string;
  category: string;
  title: string;
  content: string;
  requesterUserId: string;
  requesterName: string;
  requesterRole: string;
  status: string;
  statusHistory: Array<{
    from: string | null;
    to: string;
    changedBy: string;
    changedAt: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

function filterTickets(
  tickets: SupportTicketFixture[],
  searchParams: URLSearchParams,
): SupportTicketFixture[] {
  const companyId = (searchParams.get('companyId') || '').trim();
  const status = (searchParams.get('status') || '').trim().toUpperCase();
  const from = (searchParams.get('from') || '').trim();
  const to = (searchParams.get('to') || '').trim();

  return tickets.filter((ticket) => {
    if (companyId && ticket.companyId !== companyId) {
      return false;
    }
    if (status && ticket.status !== status) {
      return false;
    }
    if (from && ticket.createdAt < `${from}T00:00:00+00:00`) {
      return false;
    }
    if (to && ticket.createdAt >= `${to}T24:00:00+00:00`) {
      return false;
    }
    return true;
  });
}

async function seedAuthorization(
  page: Page,
  role: 'admin' | 'super_admin',
  permissions: string[],
) {
  const user = buildMockUser(role);
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: 'pangea.authorization.v2',
      value: JSON.stringify({
        version: 2,
        userId: user.userId,
        companyId: user.companyId,
        role: user.role,
        source: 'api',
        fetchedAt: Date.now(),
        permissions,
      }),
    },
  );
}

test.describe('Support Center super_admin management view', () => {
  test('loads all tickets by default, filters by tenant, and updates status with company scope', async ({ page }) => {
    const permissions = [
      'route.home',
      'route.action-required',
      'route.assets',
      'route.reservations',
      'route.revenue',
      'route.support-center',
      'route.settings',
      'action.assets.write',
      'action.reservations.write',
      'action.action-required.write',
      'action.revenue.write',
      'action.payments.write',
      'action.support.manage',
      'action.settings.write',
      'action.settings.members.write',
    ];
    const tickets: SupportTicketFixture[] = [
      {
        id: 'SUP-0001',
        companyId: 'C1',
        category: 'ops',
        title: 'tenant-c1 issue',
        content: 'from c1',
        requesterUserId: 'admin-c1@example.com',
        requesterName: 'admin-c1',
        requesterRole: 'admin',
        status: 'RECEIVED',
        statusHistory: [
          {
            from: null,
            to: 'RECEIVED',
            changedBy: 'admin-c1@example.com',
            changedAt: '2026-03-01T09:00:00+00:00',
            note: 'created',
          },
        ],
        createdAt: '2026-03-01T09:00:00+00:00',
        updatedAt: '2026-03-01T09:00:00+00:00',
      },
      {
        id: 'SUP-0001',
        companyId: 'C2',
        category: 'billing',
        title: 'tenant-c2 issue',
        content: 'from c2',
        requesterUserId: 'admin-c2@example.com',
        requesterName: 'admin-c2',
        requesterRole: 'admin',
        status: 'RECEIVED',
        statusHistory: [
          {
            from: null,
            to: 'RECEIVED',
            changedBy: 'admin-c2@example.com',
            changedAt: '2026-03-03T09:00:00+00:00',
            note: 'created',
          },
        ],
        createdAt: '2026-03-03T09:00:00+00:00',
        updatedAt: '2026-03-03T09:00:00+00:00',
      },
    ];

    await seedAuthorization(page, 'super_admin', permissions);
    await installApiMocks(page, {
      user: {
        role: 'super_admin',
      },
      handlers: {
        'GET /api/v2/support/tickets': async ({ route, request }) => {
          const url = new URL(request.url());
          await fulfillSuccess(route, {
            items: filterTickets(tickets, url.searchParams),
            limit: 200,
            offset: 0,
          });
        },
        'GET /api/v2/support/tickets/SUP-0001': async ({ route, request }) => {
          const url = new URL(request.url());
          const companyId = (url.searchParams.get('companyId') || '').trim();
          const ticket = tickets.find((item) => item.id === 'SUP-0001' && item.companyId === companyId);
          await fulfillSuccess(route, { ticket });
        },
        'PATCH /api/v2/support/tickets/SUP-0001/status': async ({ route, request }) => {
          const url = new URL(request.url());
          const companyId = (url.searchParams.get('companyId') || '').trim();
          const payload = request.postDataJSON() as { status?: string; note?: string };
          const target = tickets.find((item) => item.id === 'SUP-0001' && item.companyId === companyId);
          expect(companyId).toBe('C2');
          expect(target).toBeTruthy();
          expect(payload.status).toBe('IN_PROGRESS');

          if (!target) {
            throw new Error('target ticket not found');
          }

          target.status = 'IN_PROGRESS';
          target.updatedAt = '2026-03-04T10:00:00+00:00';
          target.statusHistory = [
            ...target.statusHistory,
            {
              from: 'RECEIVED',
              to: 'IN_PROGRESS',
              changedBy: 'super_admin@pangea.local',
              changedAt: target.updatedAt,
              note: payload.note,
            },
          ];

          await fulfillSuccess(route, { ticket: target });
        },
        'GET /api/v2/notifications': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
            unreadCount: 0,
          });
        },
        'GET /api/v2/notifications/summary': async ({ route }) => {
          await fulfillSuccess(route, {
            totalCount: 0,
            unreadCount: 0,
          });
        },
      },
    });

    await loginViaUi(page, 'super_admin', { returnUrl: '/support-center' });

    await expect(page.getByTestId('support-admin-heading')).toBeVisible();
    await expect(page.getByTestId('support-admin-ticket-list')).toBeVisible();
    await expect(page.getByTestId('support-admin-ticket-row-C1-SUP-0001')).toBeVisible();
    await expect(page.getByTestId('support-admin-ticket-row-C2-SUP-0001')).toBeVisible();
    await expect(page.getByText('문의 등록')).toHaveCount(0);

    await page.getByTestId('support-admin-filter-company').fill('C2');
    await page.getByTestId('support-admin-filter-apply').click();

    await expect(page.getByTestId('support-admin-ticket-row-C1-SUP-0001')).toHaveCount(0);
    await expect(page.getByTestId('support-admin-ticket-row-C2-SUP-0001')).toBeVisible();

    await page.getByTestId('support-admin-ticket-row-C2-SUP-0001').click();
    await expect(page.getByTestId('support-admin-detail')).toBeVisible();
    await expect(page.getByTestId('support-admin-detail-company')).toContainText('C2');

    await page.getByTestId('support-admin-status-note').fill('담당자 확인 중');
    await page.getByTestId('support-admin-status-submit').click();

    await expect(page.getByTestId('support-admin-status-success')).toContainText('문의 상태가 업데이트되었습니다.');
    await expect(page.getByTestId('support-admin-detail-status')).toContainText('처리중');
  });

  test('admin also sees the management view instead of the submit form', async ({ page }) => {
    const permissions = [
      'route.home',
      'route.action-required',
      'route.assets',
      'route.reservations',
      'route.revenue',
      'route.support-center',
      'route.settings',
      'action.assets.write',
      'action.reservations.write',
      'action.action-required.write',
      'action.revenue.write',
      'action.payments.write',
      'action.support.manage',
      'action.settings.write',
      'action.settings.members.write',
    ];

    await seedAuthorization(page, 'admin', permissions);
    await installApiMocks(page, {
      user: {
        role: 'admin',
      },
      handlers: {
        'GET /api/v2/support/tickets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            limit: 200,
            offset: 0,
          });
        },
        'GET /api/v2/notifications': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
            unreadCount: 0,
          });
        },
        'GET /api/v2/notifications/summary': async ({ route }) => {
          await fulfillSuccess(route, {
            totalCount: 0,
            unreadCount: 0,
          });
        },
      },
    });

    await loginViaUi(page, 'admin', { returnUrl: '/support-center' });

    await expect(page.getByTestId('support-admin-heading')).toBeVisible();
    await expect(page.getByText('문의 등록')).toHaveCount(0);
  });
});
