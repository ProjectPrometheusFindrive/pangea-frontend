import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { TEST_IMAGE_FILE } from './helpers/files';
import { loginViaUi } from './helpers/session';

test.describe('Wave 1 Settings Bulk OCR', () => {
  test('blank company name stays blank and bulk OCR uploads create assets', async ({ page }) => {
    let createdPayload: Record<string, unknown> | null = null;

    await installApiMocks(page, {
      company: {
        id: 'company-001',
        name: '',
        businessNumber: '123-45-67890',
        contactName: '홍길동',
        contactPhone: '010-1111-2222',
        address: '서울특별시 강남구',
        timezone: 'Asia/Seoul',
        currency: 'KRW',
      },
      user: {
        role: 'admin',
        companyId: 'company-001',
      },
      handlers: {
        'GET /api/v2/settings/geofences': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'GET /api/v2/settings/members': async ({ route }) => {
          await fulfillSuccess(route, { items: [] });
        },
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, { items: [], total: 0, page: 1, pageSize: 1 });
        },
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, { items: [], total: 0, page: 1, pageSize: 1 });
        },
        'POST /api/v2/assets/upload': async ({ route }) => {
          await fulfillSuccess(route, {
            uploadUrl: 'https://signed.example/upload',
            objectName: 'uploads/company/company-001/docs/fixture.png',
            contentType: 'image/png',
          });
        },
        'POST /api/v2/ocr/extract': async ({ route }) => {
          await fulfillSuccess(route, {
            jobId: 'OCR-BULK-001',
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
        'GET /api/v2/ocr/jobs/OCR-BULK-001': async ({ route }) => {
          await fulfillSuccess(route, {
            jobId: 'OCR-BULK-001',
            status: 'succeeded',
            docType: 'registrationDoc',
            objectName: 'uploads/company/company-001/docs/fixture.png',
            deduped: false,
            createdAt: '2026-03-07T00:00:00.000Z',
            updatedAt: '2026-03-07T00:00:01.000Z',
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
          createdPayload = request.postDataJSON() as Record<string, unknown>;
          await fulfillSuccess(route, {
            id: 'VIN-001',
            vehicleNumber: '12가3456',
            plate: '12가3456',
            model: '아반떼',
            status: '가용',
            vin: 'KMH12A34560000001',
            year: 2024,
            companyId: 'company-001',
          }, 201);
        },
      },
    });

    await page.route('https://signed.example/**', async (route) => {
      await route.fulfill({ status: 200, body: '' });
    });

    await loginViaUi(page, 'admin', { returnUrl: '/settings' });

    await page.getByRole('button', { name: '자동차 등록증 (OCR)' }).click();
    await expect(page.getByText('차량등록증 이미지 업로드')).toBeVisible();
    await page.getByTestId('settings-bulk-ocr-input').setInputFiles(TEST_IMAGE_FILE);

    await expect(page.getByTestId('settings-bulk-ocr-result-summary')).toContainText('성공 1건');
    await expect(page.getByTestId('settings-bulk-ocr-result-0')).toContainText('fixture.png');
    expect(createdPayload?.companyId).toBe('company-001');
  });
});
