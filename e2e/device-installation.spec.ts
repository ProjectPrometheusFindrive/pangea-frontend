import { expect, test, type Page } from '@playwright/test';
import { delay, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { TEST_IMAGE_FILE } from './helpers/files';
import { loginViaUi } from './helpers/session';

interface InstallationRow {
  id: string;
  vin: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt: string;
  installer?: string;
  deviceSerial?: string;
  photos: string[];
}

const assignedTask: InstallationRow = {
  id: 'INST-001', vin: 'KMH12A34560000001', status: 'scheduled',
  scheduledAt: '2026-09-16T00:00:00Z', installer: 'installer-001', photos: [],
};

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
  const manualVinInput = page.getByTestId('device-installation-manual-vin-input');
  if (await manualVinInput.count()) {
    await manualVinInput.fill('KMH12A34560000001');
  } else {
    const vinField = page.getByTestId('device-installation-vin-input');
    const tagName = await vinField.evaluate((element) => element.tagName.toLowerCase());
    if (tagName === 'select') {
      await vinField.selectOption('KMH12A34560000001');
    } else {
      await vinField.fill('KMH12A34560000001');
    }
  }
  await page.getByTestId('device-installation-serial-input').fill('DEV-2026-0001');
  await page.getByTestId('device-installation-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('device-installation-serial-photo-file-input').setInputFiles(TEST_IMAGE_FILE);
}

async function openDeviceInstallationPage(page: Page): Promise<void> {
  await loginViaUi(page, 'installer', { returnUrl: '/device-installation' });
  await expect(page).toHaveURL(/\/device-installation(?:\?.*)?$/);
  await expect(page.getByRole('heading', { name: '단말 장착/관리' })).toBeVisible();
  await expect(page.getByTestId('device-installation-vin-input')).toBeVisible();
}

test.describe('BK-091 Premium Installation E2E', () => {
  test('배정된 장착 작업 완료 시 로딩 후 성공 메시지와 목록 반영을 확인한다', async ({ page }) => {
    const installations: InstallationRow[] = [{ ...assignedTask }];
    let firstListDelay = true;

    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [{ vin: 'KMH12A34560000001', vehicleNumber: 'KMH12A34560000001', model: '쏘나타', year: 2024 }],
            total: 1,
          });
        },
        'GET /api/v2/device-installations/tasks': async ({ route, request }) => {
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
        'PATCH /api/v2/device-installations/INST-001/status': async ({ route, request }) => {
          await delay(250);
          const created: InstallationRow = {
            id: 'INST-001',
            vin: 'KMH12A34560000001',
            status: request.postDataJSON().status,
            scheduledAt: '2025-02-20T09:00:00.000Z',
            installer: 'E2E Installer',
            deviceSerial: 'DEV-2026-0001',
            photos: ['data:image/png;base64,test-photo-1', 'data:image/png;base64,test-photo-2'],
          };
          installations[0] = created;
          await fulfillSuccess(route, created);
        },
      },
    });

    await openDeviceInstallationPage(page);

    await fillInstallationForm(page);
    await page.getByTestId('device-installation-submit').click();

    await expect(page.getByTestId('device-installation-submit')).toContainText('장착 완료');
    await expect(page.getByTestId('device-installation-action-message')).toContainText('장착 완료가 등록되었습니다.');
    await expect(page.getByRole('table').getByText('KMH12A34560000001')).toBeVisible();
  });

  test('배정 작업 수행 403 오류 시 권한 안내를 표시한다', async ({ page }) => {
    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [{ vin: 'KMH12A34560000001', vehicleNumber: 'KMH12A34560000001', model: '쏘나타', year: 2024 }],
            total: 1,
          });
        },
        'GET /api/v2/device-installations/tasks': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [{ ...assignedTask }],
            total: 1,
            page: 1,
            pageSize: 10,
          });
        },
        'PATCH /api/v2/device-installations/INST-001/status': async ({ route }) => {
          await fulfillError(route, 403, 'FORBIDDEN', 'forbidden');
        },
      },
    });

    await openDeviceInstallationPage(page);
    await fillInstallationForm(page);
    await page.getByTestId('device-installation-submit').click();

    await expect(page.getByTestId('device-installation-action-error')).toContainText('권한이 없어 요청을 처리할 수 없습니다.');
  });

  test('배정 작업 수행 5xx 오류 시 서버 오류 안내를 표시한다', async ({ page }) => {
    await installApiMocks(page, {
      user: { role: 'installer', userId: 'installer-001', name: 'E2E Installer' },
      handlers: {
        'GET /api/v2/assets': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [{ vin: 'KMH12A34560000001', vehicleNumber: 'KMH12A34560000001', model: '쏘나타', year: 2024 }],
            total: 1,
          });
        },
        'GET /api/v2/device-installations/tasks': async ({ route }) => {
          await fulfillSuccess(route, {
            items: [{ ...assignedTask }],
            total: 1,
            page: 1,
            pageSize: 10,
          });
        },
        'PATCH /api/v2/device-installations/INST-001/status': async ({ route }) => {
          await fulfillError(route, 500, 'SERVER_ERROR', 'temporary server error');
        },
      },
    });

    await openDeviceInstallationPage(page);
    await fillInstallationForm(page);
    await page.getByTestId('device-installation-submit').click();

    await expect(page.getByTestId('device-installation-action-error')).toContainText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  });
});
