import { expect, test, type Page } from '@playwright/test';
import { delay, fulfillError, fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { TEST_IMAGE_FILE } from './helpers/files';
import { loginViaUi } from './helpers/session';

interface ReservationListRow {
  id: string;
  vehicleNumber: string;
  customerName: string;
  startAt: string;
  endAt: string;
  contractStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number;
  deposit: number;
  phone?: string;
  memo?: string;
}

function formatDateOffset(offsetDays: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeOffset(offsetDays: number, time: string): string {
  return `${formatDateOffset(offsetDays)}T${time}`;
}

function buildVehicleAsset() {
  return {
    vehicleNumber: '12가3456',
    model: '아반떼',
    status: '가용',
    issues: [],
    insuranceExpiry: '2026-12-31',
    nextInspection: '2026-06-30',
    vin: 'KMH12A34560000001',
    year: '2024',
    owner: '홍길동',
  };
}

function buildReservationRow(overrides: Partial<ReservationListRow> = {}): ReservationListRow {
  return {
    id: 'R-9001',
    vehicleNumber: '12가3456',
    customerName: '기존고객',
    startAt: formatDateTimeOffset(1, '09:00:00'),
    endAt: formatDateTimeOffset(3, '18:00:00'),
    contractStatus: '예약중',
    paymentMethod: '카드',
    paymentStatus: '대기',
    amount: 250000,
    deposit: 50000,
    phone: '010-1111-2222',
    ...overrides,
  };
}

async function openNewContractModal(page: Page): Promise<void> {
  await page.getByTestId('reservation-new-contract-button').click();
  await expect(page.getByTestId('new-contract-modal')).toBeVisible();
}

async function fillContractStep1(page: Page): Promise<void> {
  await page.getByTestId('new-contract-vehicle-select').selectOption('12가3456');
  await page.getByTestId('new-contract-start-date-input').fill(formatDateOffset(1));
  await page.getByTestId('new-contract-end-date-input').fill(formatDateOffset(3));
  await page.getByTestId('new-contract-start-time-input').fill('09:00');
  await page.getByTestId('new-contract-end-time-input').fill('18:00');
  await page.getByTestId('new-contract-step1-next').click();
}

async function fillContractStep2(page: Page): Promise<void> {
  await page.getByTestId('new-contract-customer-name-input').fill('테스트고객');
  await page.getByTestId('new-contract-customer-phone-input').fill('010-2222-3333');
  await page.getByTestId('new-contract-customer-ssn-input').fill('900101-1234567');
  await page.getByTestId('new-contract-customer-license-input').fill('11-22-333333-44');
  await page.getByTestId('new-contract-customer-address-input').fill('서울특별시 강남구');
  await page.getByTestId('new-contract-pickup-location-input').fill('강남지점');
  await page.getByTestId('new-contract-return-location-input').fill('서초지점');
  await page.getByTestId('new-contract-amount-input').fill('350000');
  await page.getByTestId('new-contract-deposit-input').fill('50000');
  await page.getByTestId('new-contract-step2-next').click();
}

async function submitContract(page: Page): Promise<void> {
  await page.getByTestId('new-contract-license-file-input').setInputFiles(TEST_IMAGE_FILE);
  await page.getByTestId('new-contract-submit').click();
}

test.describe('BK-091 Reservations E2E', () => {
  test('예약 생성 후 대여 시작과 반납 전이가 성공한다', async ({ page }) => {
    const reservations: ReservationListRow[] = [];

    await installApiMocks(page, {
      user: {
        role: 'admin',
      },
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await delay(250);
          await fulfillSuccess(route, {
            reservations,
            assets: [buildVehicleAsset()],
            total: reservations.length,
            page: 1,
            pageSize: 20,
          });
        },
        'POST /api/v2/reservations': async ({ route }) => {
          await delay(250);
          const body = route.request().postDataJSON() as Record<string, unknown>;
          expect(body.phone).toBe('010-2222-3333');
          const created = buildReservationRow({
            id: 'R-1001',
            customerName: '테스트고객',
            phone: '010-2222-3333',
          });
          reservations.splice(0, reservations.length, created);
          await fulfillSuccess(route, created, 201);
        },
        'GET /api/v2/reservations/R-1001': async ({ route }) => {
          await fulfillSuccess(route, reservations[0]);
        },
        'POST /api/v2/reservations/R-1001/transitions': async ({ route, request }) => {
          await delay(250);
          expect(JSON.parse(request.postData() ?? '{}')).toMatchObject({
            to: '대여중',
          });
          const transitionedReservation = buildReservationRow({
            id: 'R-1001',
            customerName: '테스트고객',
            phone: '010-2222-3333',
            contractStatus: '대여중',
          });
          reservations.splice(0, reservations.length, transitionedReservation);
          await fulfillSuccess(route, transitionedReservation);
        },
        'POST /api/v2/reservations/R-1001/return': async ({ route }) => {
          await delay(250);
          const returnedReservation = buildReservationRow({
            id: 'R-1001',
            customerName: '테스트고객',
            phone: '010-2222-3333',
            contractStatus: '완료',
          });
          reservations.splice(0, reservations.length, returnedReservation);
          await fulfillSuccess(route, returnedReservation);
        },
      },
    });

    await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '대여 예약' })).toBeVisible();

    await openNewContractModal(page);
    await fillContractStep1(page);
    await fillContractStep2(page);
    await submitContract(page);

    await expect(page.getByTestId('new-contract-submit')).toContainText('저장 중...');
    await expect(page.getByText('예약이 등록되었습니다. 예약번호: R-1001')).toBeVisible();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
    await expect(page.getByTestId('reservation-start-button')).toBeVisible();
    await expect(page.getByTestId('reservation-return-button')).toHaveCount(0);

    await page.getByTestId('reservation-start-button').click();
    await expect(page.getByTestId('reservation-start-button')).toContainText('처리 중...');
    await expect(page.getByText('차량 인수 처리가 완료되었습니다.')).toBeVisible();
    await expect(page.getByTestId('reservation-start-button')).toHaveCount(0);
    await expect(page.getByTestId('reservation-return-button')).toBeVisible();

    await page.getByTestId('reservation-return-button').click();
    await expect(page.getByTestId('reservation-return-confirm-modal')).toBeVisible();
    await page.getByTestId('reservation-return-confirm-button').click();

    await expect(page.getByTestId('reservation-return-confirm-button')).toContainText('처리 중...');
    await expect(page.getByText('차량이 반납 처리되었습니다.')).toBeVisible();
  });

  test('상세 조회가 phone을 누락해도 legacy memo 연락처를 유지한다', async ({ page }) => {
    const listReservation = buildReservationRow({
      phone: undefined,
      memo: 'phone=010-9999-8888, pickup=강남지점',
    });
    const detailReservation = buildReservationRow({
      phone: undefined,
      memo: undefined,
    });

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [listReservation],
            assets: [buildVehicleAsset()],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillSuccess(route, detailReservation);
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
    await expect(page.getByText('010-9999-8888')).toBeVisible();
  });

  test('예약 생성 403 오류 시 권한 오류를 노출한다', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [],
            assets: [buildVehicleAsset()],
            total: 0,
            page: 1,
            pageSize: 20,
          });
        },
        'POST /api/v2/reservations': async ({ route }) => {
          await fulfillError(route, 403, 'FORBIDDEN', 'forbidden');
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '대여 예약' })).toBeVisible();

    await openNewContractModal(page);
    await fillContractStep1(page);
    await fillContractStep2(page);
    await submitContract(page);

    await expect(page.getByTestId('new-contract-submit-error')).toContainText('예약 생성 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
  });

  test('예약 반납 5xx 오류 시 재시도 안내를 노출한다', async ({ page }) => {
    const rentalReservation = buildReservationRow({ contractStatus: '대여중' });

    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [rentalReservation],
            assets: [buildVehicleAsset()],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillSuccess(route, rentalReservation);
        },
        'POST /api/v2/reservations/R-9001/return': async ({ route }) => {
          await fulfillError(route, 500, 'SERVER_ERROR', 'temporary error');
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '대여 예약' })).toBeVisible();
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();

    await page.getByTestId('reservation-return-button').click();
    await page.getByTestId('reservation-return-confirm-button').click();

    await expect(page.getByTestId('reservation-return-error')).toContainText('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  });

  test('예약 취소가 실제 cancel API를 호출하고 상세 패널을 닫는다', async ({ page }) => {
    const reservations: ReservationListRow[] = [buildReservationRow()];
    let cancelRequestCount = 0;

    await installApiMocks(page, {
      user: {
        role: 'admin',
      },
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations,
            assets: [buildVehicleAsset()],
            total: reservations.length,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillSuccess(route, reservations[0]);
        },
        'POST /api/v2/reservations/R-9001/cancel': async ({ route }) => {
          cancelRequestCount += 1;
          reservations.splice(0, reservations.length);
          await fulfillSuccess(route, {
            reservationId: 'R-9001',
            archived: true,
            canceledAt: formatDateTimeOffset(0, '10:00:00'),
          });
        },
      },
    });

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();

    await page.getByTestId('reservation-cancel-button').click();

    await expect(page.getByText('예약이 취소되었습니다.')).toBeVisible();
    await expect(page.getByTestId('reservation-detail-modal')).toHaveCount(0);
    await expect(page.getByTestId('reservation-block-R-9001')).toHaveCount(0);
    expect(cancelRequestCount).toBe(1);
  });

  test('대여 시작 409 충돌 시 최신 상태를 다시 반영한다', async ({ page }) => {
    let currentReservation = buildReservationRow();

    await installApiMocks(page, {
      user: {
        role: 'admin',
      },
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [currentReservation],
            assets: [buildVehicleAsset()],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillSuccess(route, currentReservation);
        },
        'POST /api/v2/reservations/R-9001/transitions': async ({ route, request }) => {
          expect(JSON.parse(request.postData() ?? '{}')).toMatchObject({
            to: '대여중',
          });
          currentReservation = buildReservationRow({ contractStatus: '대여중' });
          await fulfillError(route, 409, 'CONFLICT', 'transition version mismatch');
        },
      },
    });

    await loginViaUi(page, 'admin', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
    await expect(page.getByTestId('reservation-start-button')).toBeVisible();

    await page.getByTestId('reservation-start-button').click();

    await expect(page.getByTestId('reservation-start-button')).toHaveCount(0);
    await expect(page.getByTestId('reservation-return-button')).toBeVisible();
  });

  test('member는 대여 시작 버튼을 볼 수 없다', async ({ page }) => {
    await installApiMocks(page, {
      user: {
        role: 'member',
      },
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [buildReservationRow()],
            assets: [buildVehicleAsset()],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillSuccess(route, buildReservationRow());
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
    await expect(page.getByTestId('reservation-start-button')).toHaveCount(0);
  });

  test('예약 상세 403 오류 시 접근 불가 안내를 노출한다', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [buildReservationRow()],
            assets: [buildVehicleAsset()],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillError(route, 403, 'TENANT_MISMATCH', 'cross-tenant denied');
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
    await expect(page.getByText('해당 예약 상세를 조회할 권한이 없습니다. 목록 데이터로 표시합니다.')).toBeVisible();
  });

  test('예약 상세 404 오류 시 삭제/은닉 안내를 노출한다', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillSuccess(route, {
            reservations: [buildReservationRow()],
            assets: [buildVehicleAsset()],
            total: 1,
            page: 1,
            pageSize: 20,
          });
        },
        'GET /api/v2/reservations/R-9001': async ({ route }) => {
          await fulfillError(route, 404, 'NOT_FOUND', 'reservation hidden');
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/);
    await expect(page.getByTestId('reservation-block-R-9001')).toBeVisible();

    await page.getByTestId('reservation-block-R-9001').click();
    await expect(page.getByTestId('reservation-detail-modal')).toBeVisible();
    await expect(page.getByText('선택한 예약이 삭제되었거나 존재하지 않습니다. 목록 데이터로 표시합니다.')).toBeVisible();
  });

  test('예약 조회 401 세션 만료 시 로그인 화면으로 이동한다', async ({ page }) => {
    await installApiMocks(page, {
      handlers: {
        'GET /api/v2/reservations': async ({ route }) => {
          await fulfillError(route, 401, 'UNAUTHORIZED', 'expired session');
        },
      },
    });

    await loginViaUi(page, 'member', { returnUrl: '/reservations' });
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
    await expect.poll(() => new URL(page.url()).searchParams.get('returnUrl')).toBe('/reservations');
    await expect(page.getByTestId('login-user-id')).toBeVisible();
  });
});
