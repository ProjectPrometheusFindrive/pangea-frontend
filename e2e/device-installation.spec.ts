import { expect, test, type Page } from '@playwright/test';
import { delay, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { TEST_IMAGE_FILE } from './helpers/files';
import { seedAuthSession } from './helpers/session';

interface InstallationRow {
  id: string;
  vin: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt: string;
  installer?: string;
  deviceSerial?: string;
  photos: string[];
}

function filterInstallations(
  rows: InstallationRow[],
  status: string | null,
  vin: string | null,
): InstallationRow[] {
  const normalizedVin = vin?.trim().toUpperCase() ?? '';
  return rows.filter((row) => {
    if (status && row.status !== status) {
      return false;
    }
    if (normalizedVin && row.vin.toUpperCase() !== normalizedVin) {
      return false;
    }
    return true;
  });
}

async function fillInstallationForm(page: Page): Promise<void> {
  await page.getByTestId('device-installation-vin-input').fill('KMH12A34560000001');
  await page.getByTestId('device-installation-serial-input').fill('DEV-2026-0001');
  await page.getByTestId('device-installation-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('device-installation-serial-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
}

test.describe('BK-091 Premium Installation E2E', () => {
  test('장착 신청 성공 시 로딩 후 성공 메시지와 목록 반영을 확인한다', async ({ page }) => {
    await seedAuthSession(page, 'installer');

    const installations: InstallationRow[] = [];
    let firstListDelay = true;

    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/device-installations': async ({ route, request }) => {
          if (firstListDelay) {
            firstListDelay = false;
            await delay(250);
          }

          const url = new URL(request.url());
          const status = url.searchParams.get('status');
          const vin = url.searchParams.get('vin');
          const pageParam = Number(url.searchParams.get('page') ?? '1');
          const pageSizeParam = Number(url.searchParams.get('pageSize') ?? '10');
          const filtered = filterInstallations(installations, status, vin);
          const start = Math.max(0, (pageParam - 1) * pageSizeParam);
          const end = start + pageSizeParam;

          await fulfillSuccess(route, {
            items: filtered.slice(start, end),
            total: filtered.length,
            page: pageParam,
            pageSize: pageSizeParam,
          });
        },
        'POST /api/v2/device-installations': async ({ route }) => {
          await delay(250);
          const created: InstallationRow = {
            id: 'INST-001',
            vin: 'KMH12A34560000001',
            status: 'scheduled',
            scheduledAt: '2025-02-20T09:00:00.000Z',
            installer: 'E2E Installer',
            deviceSerial: 'DEV-2026-0001',
            photos: ['data:image/png;base64,test-photo-1', 'data:image/png;base64,test-photo-2'],
          };
          installations.unshift(created);
          await fulfillSuccess(route, created, 201);
        },
      },
    });

    await page.goto('/device-installation');
    await expect(page.getByText('데이터를 불러오는 중입니다')).toBeVisible();
    await expect(page.getByRole('heading', { name: '단말 장착/관리' })).toBeVisible();

    await fillInstallationForm(page);
    await page.getByTestId('device-installation-submit').click();

    await expect(page.getByTestId('device-installation-submit')).toContainText('장착 신청');
    await expect(page.getByTestId('device-installation-action-message')).toContainText('장착 신청이 등록되었습니다. 상태가 대기로 반영됩니다.');
    await expect(page.getByText('KMH12A34560000001')).toBeVisible();
  });

  test('장착 신청 403 오류 시 권한 안내를 표시한다', async ({ page }) => {
    await seedAuthSession(page, 'installer');

    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/device-installations': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 10,
          });
        },
        'POST /api/v2/device-installations': async ({ route }) => {
          await fulfillError(route, 403, 'FORBIDDEN', 'forbidden');
        },
      },
    });

    await page.goto('/device-installation');
    await fillInstallationForm(page);
    await page.getByTestId('device-installation-submit').click();

    await expect(page.getByTestId('device-installation-action-error')).toContainText('권한이 없어 요청을 처리할 수 없습니다.');
  });

  test('장착 신청 5xx 오류 시 서버 오류 안내를 표시한다', async ({ page }) => {
    await seedAuthSession(page, 'installer');

    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/device-installations': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [],
            total: 0,
            page: 1,
            pageSize: 10,
          });
        },
        'POST /api/v2/device-installations': async ({ route }) => {
          await fulfillError(route, 500, 'SERVER_ERROR', 'temporary server error');
        },
      },
    });

    await page.goto('/device-installation');
    await fillInstallationForm(page);
    await page.getByTestId('device-installation-submit').click();

    await expect(page.getByTestId('device-installation-action-error')).toContainText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  });
});
