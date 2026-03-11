import { expect, test } from '@playwright/test';

import { buildMockUser, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

test.describe('SCRUM-300 Forbidden E2E', () => {
  test('auto-redirects members to home after 3 seconds without leaving a back-button loop', async ({ page }) => {
    await installApiMocks(page, {
      user: buildMockUser('member'),
      handlers: {
        'GET /api/v2/assets*': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [
              {
                id: 'ASSET-001',
                vehicleNumber: '12가3456',
                plate: '12가3456',
                model: '아반떼',
                status: '가용',
                vin: 'KMH12A34560000001',
                year: '2024',
                owner: '홍길동',
                insuranceExpiry: '2026-12-31',
                nextInspection: '2026-06-30',
                issues: [],
                version: 1,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/home/summary': async ({ route }) => {
          await fulfillSuccess(route, {
            tenantId: 'company-001',
            from: '2026-03-12',
            to: '2026-03-12',
            kpis: {
              totalAssets: 1,
              totalContracts: 0,
              activeContracts: 0,
              completedContracts: 0,
              overdueContracts: 0,
              unpaidContracts: 0,
              utilizationRate: 0,
            },
            statusCounts: {
              contractStatus: {},
              managementStage: {},
              alerts: {
                overdue: 0,
                stolen: 0,
              },
            },
            today: {
              pickupDueCount: 0,
              returnDueCount: 0,
              overdueCount: 0,
            },
            recentChanges: [],
          });
        },
        'GET /api/v2/action-items': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 100,
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
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            totalCount: 0,
          });
        },
      },
    });

    await seedAuthSession(page, 'member');
    await page.goto('/assets');
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);

    await page.goto('/forbidden');
    await expect(page.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeVisible();
    await expect(page.getByText(/3초 후 접근 가능한 초기 화면으로 자동 이동합니다\./)).toBeVisible();

    await expect(page).toHaveURL(/\/(?:\?companyId=company-001)?$/, { timeout: 5_000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
  });

  test('auto-redirects installers to the device-installation landing path after 3 seconds', async ({ page }) => {
    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/assets*': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/device-installations/tasks': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 10,
          });
        },
      },
    });

    await seedAuthSession(page, 'installer');
    await page.goto('/forbidden');

    await expect(page.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeVisible();
    await expect(page.getByText(/3초 후 접근 가능한 초기 화면으로 자동 이동합니다\./)).toBeVisible();
    await expect(page).toHaveURL(/\/device-installation(?:\?.*)?$/, { timeout: 5_000 });
    await expect(page.getByTestId('device-installation-vin-input')).toBeVisible();
  });
});
