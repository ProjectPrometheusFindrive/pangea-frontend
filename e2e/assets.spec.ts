import { expect, test } from '@playwright/test';
import { delay, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { TEST_IMAGE_FILE } from './helpers/files';
import { loginViaUi } from './helpers/session';

interface AssetFixture {
  id: string;
  vehicleNumber: string;
  plate: string;
  model: string;
  category?: string;
  color?: string;
  vehicleType?: string;
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
    vehicleNumber: '12가3456',
    plate: '12가3456',
    model,
    category: 'SUV',
    color: '검정',
    vehicleType: '승용',
    status: '가용',
    vin: 'KMH12A34560000001',
    year: '2024',
    owner: '홍길동',
    insuranceExpiry: '2026-12-31',
    nextInspection: '2026-06-30',
    issues: [],
    version,
    updatedAt: '2026-02-27T00:00:00.000Z',
    ...overrides,
  };
}

test.describe('BK-091 Assets E2E', () => {
  test('자산 조회 loading/success 후 상세 저장이 반영된다', async ({ page }) => {
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

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
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

  test('자산 상세 수정 폼에서 color/category/vehicleType 변경을 PATCH payload에 포함한다', async ({ page }) => {
    let currentAsset = buildAsset('아반떼', 1, {
      color: '검정',
      category: 'SUV',
      vehicleType: '승용',
    });
    let patchPayload: Record<string, unknown> | null = null;

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [currentAsset],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/assets/ASSET-001': async ({ route }) => {
          await fulfillSuccess(route, currentAsset);
        },
        'GET /api/v2/assets/ASSET-001/history': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'PATCH /api/v2/assets/ASSET-001': async ({ route, request }) => {
          patchPayload = request.postDataJSON() as Record<string, unknown>;
          currentAsset = buildAsset('아반떼', 2, {
            color: String(patchPayload.color ?? currentAsset.color ?? ''),
            category: String(patchPayload.category ?? currentAsset.category ?? ''),
            vehicleType: String(patchPayload.vehicleType ?? currentAsset.vehicleType ?? ''),
          });
          await fulfillSuccess(route, currentAsset);
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();

    await expect(page.getByTestId('asset-detail-color-input')).toHaveValue('검정');
    await expect(page.getByTestId('asset-detail-category-input')).toHaveValue('SUV');
    await expect(page.getByTestId('asset-detail-vehicle-type-input')).toHaveValue('승용');
    await expect(page.getByTestId('asset-detail-contract-status-input')).toHaveCount(0);

    await page.getByTestId('asset-detail-color-input').fill('흰색');
    await page.getByTestId('asset-detail-category-input').fill('세단');
    await page.getByTestId('asset-detail-vehicle-type-input').fill('중형');
    await page.getByTestId('asset-detail-save-button').click();

    await expect.poll(() => patchPayload).not.toBeNull();
    expect(patchPayload).toMatchObject({
      version: 1,
      color: '흰색',
      category: '세단',
      vehicleType: '중형',
    });
    await expect(page.getByText('차량 정보가 업데이트되었습니다.')).toBeVisible();
  });

  test('자산 조회 5xx 오류에서 Retry로 복구된다', async ({ page }) => {
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

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByText('차량 자산 목록을 불러오는 중 문제가 발생했습니다.')).toBeVisible();

    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();
  });

  test('자산 저장 403 오류 시 권한 안내를 표시한다', async ({ page }) => {
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

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page).toHaveURL(/\/assets(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '차량 자산' })).toBeVisible();
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();

    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();

    await page.getByTestId('asset-detail-model-input').fill('쏘나타');
    await page.getByTestId('asset-detail-save-button').click();

    await expect(page.getByTestId('asset-detail-save-error')).toContainText('차량 자산 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
  });

  test('OCR 400 오류 시 실제 원인 메시지를 노출하고 생성 요청에 companyId를 포함한다', async ({ page }) => {
    let createPayload: Record<string, unknown> | null = null;
    let extractRequestCount = 0;

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          });
        },
        'POST /api/v2/assets/upload': async ({ route }) => {
          await fulfillSuccess(route, {
            uploadUrl: 'https://signed.example/upload',
            objectName: 'uploads/company/company-001/docs/fixture.png',
            contentType: 'image/png',
          });
        },
        'POST /api/v2/ocr/extract': async ({ route }) => {
          extractRequestCount += 1;
          const jobId = extractRequestCount === 1 ? 'OCR-FAIL-001' : 'OCR-SUCCESS-001';
          await fulfillSuccess(route, {
            jobId,
            status: 'queued',
            docType: 'registrationDoc',
            objectName: 'uploads/company/company-001/docs/fixture.png',
            deduped: false,
            createdAt: '2026-03-07T00:00:00.000Z',
            updatedAt: '2026-03-07T00:00:00.000Z',
            extractedFields: [],
            warnings: [],
          }, 202);
        },
        'GET /api/v2/ocr/jobs/OCR-FAIL-001': async ({ route }) => {
          await fulfillError(route, 400, 'VALIDATION_ERROR', 'Empty OCR text; cannot extract fields.');
        },
        'GET /api/v2/ocr/jobs/OCR-SUCCESS-001': async ({ route }) => {
          await fulfillSuccess(route, {
            jobId: 'OCR-SUCCESS-001',
            status: 'succeeded',
            docType: 'registrationDoc',
            objectName: 'uploads/company/company-001/docs/fixture.png',
            deduped: false,
            createdAt: '2026-03-07T00:00:00.000Z',
            updatedAt: '2026-03-07T00:00:02.000Z',
            extractedFields: [
              { name: 'plate', value: '12가3456', confidence: 0.99 },
              { name: 'vin', value: 'KMH12A34560000001', confidence: 0.99 },
              { name: 'model', value: '아반떼', confidence: 0.95 },
              { name: 'year', value: '2024', confidence: 0.95 },
            ],
            warnings: [],
          });
        },
        'POST /api/v2/assets': async ({ route, request }) => {
          createPayload = request.postDataJSON() as Record<string, unknown>;
          await fulfillSuccess(route, {
            id: 'ASSET-NEW-001',
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
            updatedAt: '2026-03-07T00:00:00.000Z',
            companyId: 'company-001',
          }, 201);
        },
      },
    });

    await page.route('https://signed.example/**', async (route) => {
      await route.fulfill({ status: 200, body: '' });
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await page.getByRole('button', { name: '차량 자산 등록' }).click();

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.first().setInputFiles(TEST_IMAGE_FILE);
    await page.getByRole('button', { name: 'OCR 추출 시작' }).click();
    await expect(page.getByText('차량등록증: Empty OCR text; cannot extract fields. 수동 입력 모드로 계속 진행할 수 있습니다.')).toBeVisible();

    await page.getByRole('button', { name: 'OCR 다시 실행' }).click();
    await expect(page.getByText('OCR 결과를 폼에 자동 반영했습니다. 저장 전 값이 정확한지 확인해 주세요.')).toBeVisible();
    await page.getByRole('button', { name: '확인 및 저장' }).click();

    await expect.poll(() => createPayload).not.toBeNull();
    expect(createPayload?.companyId).toBe('company-001');
  });

  test('자산 상세에서 삭제 버튼으로 차량을 archive 처리한다', async ({ page }) => {
    let deleted = false;

    page.on('dialog', (dialog) => dialog.accept());

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: deleted ? [] : [buildAsset('아반떼', 1)],
            total: deleted ? 0 : 1,
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
        'DELETE /api/v2/assets/ASSET-001': async ({ route }) => {
          deleted = true;
          await fulfillSuccess(route, { id: 'ASSET-001', deleted: true, archived: true });
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/assets' });
    await expect(page.getByTestId('asset-row-ASSET-001')).toBeVisible();
    await page.getByTestId('asset-row-ASSET-001').click();
    await expect(page.getByTestId('asset-detail-modal')).toBeVisible();

    await page.getByTestId('asset-detail-delete-button').click();

    await expect(page.getByText('차량 자산이 삭제되었습니다.')).toBeVisible();
    await expect(page.getByTestId('asset-row-ASSET-001')).toHaveCount(0);
  });
});
