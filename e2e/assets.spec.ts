import { expect, test } from '@playwright/test';
import { delay, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

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

function buildAsset(model: string, version: number): AssetFixture {
  return {
    id: 'ASSET-001',
    vehicleNumber: '12가3456',
    plate: '12가3456',
    model,
    status: '가용',
    vin: 'KMH12A34560000001',
    year: '2024',
    owner: '홍길동',
    insuranceExpiry: '2026-12-31',
    nextInspection: '2026-06-30',
    issues: [],
    version,
    updatedAt: '2026-02-27T00:00:00.000Z',
  };
}

test.describe('BK-091 Assets E2E', () => {
  test('자산 조회 loading/success 후 상세 저장이 반영된다', async ({ page }) => {
    await seedAuthSession(page, 'member');

    let currentModel = '아반떼';
    let currentVersion = 1;

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await delay(250);
          await fulfillSuccess(route, {
            items: [buildAsset(currentModel, currentVersion)],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/assets/ASSET-001': async ({ route }) => {
          await fulfillSuccess(route, buildAsset(currentModel, currentVersion));
        },
        'GET /api/v2/assets/ASSET-001/history': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'PATCH /api/v2/assets/ASSET-001': async ({ route, request }) => {
          const payload = request.postDataJSON() as { model?: string };
          await delay(250);
          if (typeof payload.model === 'string' && payload.model.trim().length > 0) {
            currentModel = payload.model.trim();
          }
          currentVersion += 1;
          await fulfillSuccess(route, buildAsset(currentModel, currentVersion));
        },
      },
    });

    await page.goto('/assets');
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '차량 자산' })).toBeVisible();
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();

    await page.getByTestId('asset-detail-model-input').fill('쏘나타');
    await page.getByTestId('asset-detail-save-button').click();

    await expect(page.getByTestId('asset-detail-save-button')).toContainText('저장 중...');
    await expect(page.getByText('차량 정보가 업데이트되었습니다.')).toBeVisible();
  });

  test('자산 조회 5xx 오류에서 Retry로 복구된다', async ({ page }) => {
    await seedAuthSession(page, 'member');

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
            items: [buildAsset('아반떼', 1)],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
      },
    });

    await page.goto('/assets');
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByText('차량 자산 목록을 불러오는 중 문제가 발생했습니다.')).toBeVisible();

    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();
  });

  test('자산 저장 403 오류 시 권한 안내를 표시한다', async ({ page }) => {
    await seedAuthSession(page, 'member');

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [buildAsset('아반떼', 1)],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/assets/ASSET-001': async ({ route }) => {
          await fulfillSuccess(route, buildAsset('아반떼', 1));
        },
        'GET /api/v2/assets/ASSET-001/history': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'PATCH /api/v2/assets/ASSET-001': async ({ route }) => {
          await fulfillError(route, 403, 'FORBIDDEN', 'forbidden');
        },
      },
    });

    await page.goto('/assets');
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '차량 자산' })).toBeVisible();
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();

    await page.getByTestId('asset-detail-model-input').fill('쏘나타');
    await page.getByTestId('asset-detail-save-button').click();

    await expect(page.getByTestId('asset-detail-save-error')).toContainText('차량 자산 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
  });
});
