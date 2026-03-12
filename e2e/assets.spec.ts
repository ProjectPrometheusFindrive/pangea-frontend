import { expect, test } from '@playwright/test';
import { delay, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { loginViaUi } from './helpers/session';

interface AssetFixture {
  id: string;
  vehicleNumber: string;
  plate: string;
  model: string;
  status: string;
  vin: string;
  year: string;
  owner: string;
  insuranceExpiry: string;
  nextInspection: string;
  issues: string[];
  version: number;
  updatedAt: string;
}

function buildAsset(model: string, version: number, overrides: Partial<AssetFixture> = {}): AssetFixture {
  return {
    id: 'ASSET-001',
    vehicleNumber: '12GA3456',
    plate: '12GA3456',
    model,
    status: 'available',
    vin: 'KMH12A34560000001',
    year: '2024',
    owner: 'Pangea Fleet',
    insuranceExpiry: '2026-12-31',
    nextInspection: '2026-06-30',
    issues: [],
    version,
    updatedAt: '2026-02-27T00:00:00.000Z',
    ...overrides,
  };
}

async function installAssetListMocks() {
  return {
    handlers: {
      'GET /api/v2/assets': async ({ route }) => {
        await fulfillSuccess(route, {
          items: [buildAsset('Avante', 1)],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      },
      'GET /api/v2/assets/ASSET-001': async ({ route }) => {
        await fulfillSuccess(route, buildAsset('Avante', 1));
      },
      'GET /api/v2/assets/ASSET-001/history': async ({ route }) => {
        await fulfillSuccess(route, { items: [] });
      },
    },
  };
}

test.describe('BK-091 Assets E2E', () => {
  test('shows the GT detail modal fields after asset list hydration', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        ...(await installAssetListMocks()).handlers,
        'GET /api/v2/assets': async ({ route }) => {
          await delay(250);
          await fulfillSuccess(route, {
            items: [buildAsset('Avante', 1)],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();
    await expect(page.getByTestId('asset-detail-insurance-expiry-input')).toHaveValue('2026-12-31');
    await expect(page.getByTestId('asset-detail-next-inspection-input')).toHaveValue('2026-06-30');
    await expect(page.getByTestId('asset-detail-save-button')).toBeVisible();
  });

  test('keeps legacy edit fields and the delete button hidden in the GT modal', async ({ page }) => {
    await installApiMocks(page, await installAssetListMocks());

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();
    await expect(page.getByTestId('asset-detail-insurance-expiry-input')).toBeVisible();
    await expect(page.getByTestId('asset-detail-next-inspection-input')).toBeVisible();
    await expect(page.getByTestId('asset-detail-contract-status-input')).toHaveCount(0);
    await expect(page.getByTestId('asset-detail-color-input')).toHaveCount(0);
    await expect(page.getByTestId('asset-detail-category-input')).toHaveCount(0);
    await expect(page.getByTestId('asset-detail-vehicle-type-input')).toHaveCount(0);
    await expect(page.getByTestId('asset-detail-delete-button')).toHaveCount(0);
  });

  test('recovers from a retryable assets list failure', async ({ page }) => {
    let firstRequest = true;

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          if (firstRequest) {
            firstRequest = false;
            await fulfillError(route, 500, 'SERVER_ERROR', 'temporary failure');
            return;
          }

          await fulfillSuccess(route, {
            items: [buildAsset('Avante', 1)],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByRole('button', { name: /다시 시도/i })).toBeVisible();

    await page.getByRole('button', { name: /다시 시도/i }).click();
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();
  });

  test('keeps the GT modal delete control hidden', async ({ page }) => {
    await installApiMocks(page, await installAssetListMocks());

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();
    await expect(page.getByTestId('asset-detail-delete-button')).toHaveCount(0);
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();
  });
});
