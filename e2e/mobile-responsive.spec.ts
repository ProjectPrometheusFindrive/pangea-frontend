import { expect, test, type Locator, type Page } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function expectInsideViewport(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!bounds || !viewport) {
    return;
  }

  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function installMobileAssetMocks(page: Page, role: 'member' | 'admin' = 'member'): Promise<void> {
  const emptyRevenueTotals = {
    grossRevenue: 0,
    refundAmount: 0,
    netRevenue: 0,
    paidCount: 0,
    refundCount: 0,
    unpaidAmount: 0,
    unpaidCount: 0,
    activeVehicleCount: 0,
    utilizationRate: 0,
    currency: 'KRW',
  };
  const revenuePeriod = {
    from: '2026-08-04',
    to: '2026-09-02',
    granularity: 'week',
    timezone: 'Asia/Seoul',
  };

  await installApiMocks(page, {
    user: { role },
    handlers: {
      'GET /api/v2/assets': async ({ route }) => {
        await fulfillSuccess(route, {
          items: [
            {
              id: 'ASSET-MOBILE-001',
              vehicleNumber: '12가3456',
              plate: '12가3456',
              model: '아반떼',
              status: 'available',
              vin: 'KMHMOBILE000000001',
              year: '2024',
              owner: 'Pangea Fleet',
              insuranceExpiry: '2026-12-31',
              nextInspection: '2026-06-30',
              issues: [],
              version: 1,
              updatedAt: '2026-09-02T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      },
      'GET /api/v2/notifications*': async ({ route }) => {
        await fulfillSuccess(route, {
          items: [],
          total: 0,
          unreadCount: 0,
          page: 1,
          pageSize: 20,
        });
      },
      'GET /api/v2/home/summary': async ({ route }) => {
        await fulfillSuccess(route, {
          tenantId: 'company-001',
          from: '2026-09-02',
          to: '2026-09-02',
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
            alerts: { overdue: 0, stolen: 0 },
          },
          today: { pickupDueCount: 0, returnDueCount: 0, overdueCount: 0 },
          recentChanges: [],
        });
      },
      'GET /api/v2/action-items': async ({ route }) => {
        await fulfillSuccess(route, { items: [], totalCount: 0, page: 1, pageSize: 100 });
      },
      'GET /api/v2/reservations': async ({ route }) => {
        await fulfillSuccess(route, {
          reservations: [],
          assets: [],
          total: 0,
          page: 1,
          pageSize: 20,
        });
      },
      'GET /api/v2/revenue/summary': async ({ route }) => {
        await fulfillSuccess(route, {
          period: revenuePeriod,
          totals: emptyRevenueTotals,
          buckets: [],
          paymentMethods: [],
          rentalTypes: [],
          payerTypes: [],
          vehicles: [],
        });
      },
      'GET /api/v2/revenue/trend': async ({ route }) => {
        await fulfillSuccess(route, {
          period: revenuePeriod,
          totals: { ...emptyRevenueTotals, points: 0 },
          items: [],
        });
      },
      'GET /api/v2/settings/geofences': async ({ route }) => {
        await fulfillSuccess(route, { items: [] });
      },
      'GET /api/v2/settings/garages': async ({ route }) => {
        await fulfillSuccess(route, { items: [] });
      },
      'GET /api/v2/settings/members': async ({ route }) => {
        await fulfillSuccess(route, { items: [] });
      },
    },
  });
}

test.describe('Mobile responsive foundation', () => {
  test('keeps the login form immediately reachable on a phone viewport', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/login');

    await expect(page.getByTestId('login-brand-panel')).toBeVisible();
    await expectInsideViewport(page, page.getByTestId('login-submit'));
    await expect(page.getByTestId('login-user-id')).toHaveCSS('font-size', '16px');
    await expectNoDocumentOverflow(page);
  });

  test('provides touch navigation and viewport-safe asset workflows', async ({ page }) => {
    await installMobileAssetMocks(page);
    await loginViaUi(page, 'member', { returnUrl: '/assets' });

    await expect(page.getByRole('heading', { name: '차량 자산', exact: true })).toBeVisible();
    await expect(page.getByTestId('asset-row-ASSET-MOBILE-001')).toBeVisible();
    await expectNoDocumentOverflow(page);

    const menuTrigger = page.getByTestId('mobile-navigation-trigger');
    await expectInsideViewport(page, menuTrigger);
    const menuBounds = await menuTrigger.boundingBox();
    expect(menuBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(menuBounds?.height ?? 0).toBeGreaterThanOrEqual(44);

    await menuTrigger.click();
    await expect(page.getByTestId('app-navigation')).toHaveClass(/translate-x-0/);
    await page.getByTestId('app-navigation').getByRole('link', { name: '대여 예약' }).click();
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '대여 예약', exact: true })).toBeVisible();
    await expect(page.getByTestId('app-navigation')).toHaveClass(/-translate-x-full/);
    await expectNoDocumentOverflow(page);

    await page.goto('/assets');
    await expect(page.getByTestId('asset-row-ASSET-MOBILE-001')).toBeVisible();
    const createButton = page.getByRole('button', { name: '차량 자산 등록' });
    await expectInsideViewport(page, createButton);
    await createButton.click();

    const createModal = page.getByTestId('asset-create-modal');
    await expectInsideViewport(page, createModal);
    await expectNoDocumentOverflow(page);
  });

  test('keeps the primary rental-business routes inside the phone viewport', async ({ page }) => {
    await installMobileAssetMocks(page);
    await loginViaUi(page, 'member', { returnUrl: '/' });

    const routes = [
      { path: '/', title: '홈' },
      { path: '/action-required', title: '조치 필요 항목' },
      { path: '/assets', title: '차량 자산' },
      { path: '/reservations', title: '대여 예약' },
      { path: '/revenue', title: '매출 요약' },
      { path: '/notifications', title: '모든 알림' },
      { path: '/settings', title: '설정' },
    ] as const;

    for (const route of routes) {
      await page.goto(route.path);
      const appHeader = page.getByTestId('app-shell').locator('header');
      await expect(appHeader.getByRole('heading', { name: route.title, exact: true })).toBeVisible();
      await expectNoDocumentOverflow(page);
    }
  });

  test('keeps the new-contract workflow usable as a full-screen mobile form', async ({ page }) => {
    await installMobileAssetMocks(page, 'admin');
    await loginViaUi(page, 'admin', { returnUrl: '/reservations' });

    const openButton = page.getByTestId('reservation-new-contract-button');
    await expect(openButton).toBeEnabled();
    await openButton.scrollIntoViewIfNeeded();
    await openButton.click();

    const modal = page.getByTestId('new-contract-modal');
    await expectInsideViewport(page, modal);
    await expect(modal.getByRole('heading', { name: '새 계약 등록' })).toBeVisible();
    await expect(modal.getByTestId('new-contract-start-date-input')).toBeVisible();
    await expectNoDocumentOverflow(page);
  });

  test('keeps the installer landing form within the phone viewport', async ({ page }) => {
    await installApiMocks(page, {
      user: { role: 'installer' },
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
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
            pageSize: 20,
          });
        },
      },
    });
    await loginViaUi(page, 'installer', { returnUrl: '/device-installation' });

    await expect(page.getByRole('heading', { name: '단말 장착/관리', exact: true })).toBeVisible();
    await expect(page.getByTestId('device-installation-vin-input')).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
});
