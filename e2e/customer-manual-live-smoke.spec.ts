import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = (process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000').replace(/\/$/, '');
const AUTH_SESSION_KEY = 'pangea.auth.v1';
const AUTHORIZATION_CACHE_KEY = 'pangea.authorization.v2';
const PASSWORD = 'Demo1234!';

const ADMIN_USER_ID = 'admin@demo-company.com';
const INSTALLER_USER_ID = 'installer@demo-company.com';

const RENTAL_BUSINESS_PERMISSIONS = [
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

const INSTALLER_PERMISSIONS = [
  'route.device-installation',
  'action.device-installation.write',
];

interface AuthUser {
  userId: string;
  name?: string;
  email?: string;
  role: string;
  companyId: string;
  company?: string;
  position?: string;
}

interface LoginSession {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

interface ReservationDetail {
  reservationId?: string;
  rentalId?: string;
  plate?: string;
  vehicleNumber?: string;
  parties?: {
    driver?: {
      name?: string;
    };
  };
}

interface ListEnvelope<T> {
  items?: T[];
  total?: number;
  totalCount?: number;
}

interface ActionItem {
  reservationId?: string;
  title?: string;
  subCategory?: string;
  vehicleNumber?: string;
  customerName?: string;
}

interface SupportTicket {
  id?: string;
  title?: string;
}

interface DeviceInstallationTask {
  id?: string;
  vin?: string;
  vehicleNumber?: string;
  deviceSerial?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapData<T>(payload: unknown): T {
  if (isRecord(payload) && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

async function requestJson<T>(
  request: APIRequestContext,
  path: string,
  token?: string,
): Promise<T> {
  const response = await request.get(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  expect(response.ok(), `${path} should return 2xx`).toBeTruthy();
  return unwrapData<T>(await response.json());
}

async function login(request: APIRequestContext, userId: string): Promise<LoginSession> {
  const response = await request.post(`${API_BASE_URL}/api/v2/auth/login`, {
    data: {
      userId,
      password: PASSWORD,
    },
  });
  expect(response.ok(), `${userId} login should succeed`).toBeTruthy();
  return unwrapData<LoginSession>(await response.json());
}

async function seedSession(
  page: Page,
  session: LoginSession,
  permissions: readonly string[],
): Promise<void> {
  const authSession = {
    token: session.token,
    expiresAt: Date.now() + session.expiresIn * 1000,
    user: session.user,
  };
  const authorizationCache = {
    version: 2,
    userId: session.user.userId,
    companyId: session.user.companyId,
    role: session.user.role,
    source: 'api',
    fetchedAt: Date.now(),
    permissions: [...permissions],
  };

  await page.addInitScript(
    ({ authKey, authValue, authorizationKey, authorizationValue }) => {
      window.localStorage.setItem(authKey, authValue);
      window.localStorage.setItem(authorizationKey, authorizationValue);
    },
    {
      authKey: AUTH_SESSION_KEY,
      authValue: JSON.stringify(authSession),
      authorizationKey: AUTHORIZATION_CACHE_KEY,
      authorizationValue: JSON.stringify(authorizationCache),
    },
  );
}

async function installRealApiProxy(page: Page, request: APIRequestContext): Promise<void> {
  await page.route('**/api/v2/**', async (route) => {
    const browserRequest = route.request();
    const browserUrl = new URL(browserRequest.url());
    const targetUrl = `${API_BASE_URL}${browserUrl.pathname}${browserUrl.search}`;
    const headers = { ...browserRequest.headers() };

    delete headers.host;
    delete headers.origin;
    delete headers.referer;

    const response = await request.fetch(targetUrl, {
      method: browserRequest.method(),
      headers,
      data: browserRequest.postDataBuffer() ?? undefined,
    });

    await route.fulfill({ response });
  });
}

test.describe('customer manual v1 simulator live smoke', () => {
  test('rental admin can inspect generated manual anchors through UI screens', async ({ page, request }) => {
    const session = await login(request, ADMIN_USER_ID);
    const reservation = await requestJson<ReservationDetail>(
      request,
      '/api/v2/reservations/MAN-ST-RES-CREATE-001',
      session.token,
    );
    const actionItems = await requestJson<ListEnvelope<ActionItem>>(
      request,
      '/api/v2/action-items?pageSize=10&reservationId=MAN-ST-RETURN-001',
      session.token,
    );
    const supportTickets = await requestJson<ListEnvelope<SupportTicket>>(
      request,
      '/api/v2/support/tickets',
      session.token,
    );

    const reservationId = reservation.reservationId ?? reservation.rentalId ?? 'MAN-ST-RES-CREATE-001';
    const reservationVehicle = reservation.vehicleNumber ?? reservation.plate ?? '';
    const actionItem = actionItems.items?.find((item) => item.reservationId === 'MAN-ST-RETURN-001') ?? actionItems.items?.[0];
    const supportTicket = supportTickets.items?.find((ticket) => ticket.id === 'MAN-SUPPORT-DEVICE-001') ?? supportTickets.items?.[0];

    await installRealApiProxy(page, request);
    await seedSession(page, session, RENTAL_BUSINESS_PERMISSIONS);

    await page.goto(`/reservations?q=${encodeURIComponent(reservationId)}`);
    await expect(page.getByRole('heading', { name: '대여 예약' })).toBeVisible();
    const reservationBlock = page.getByTestId(`reservation-block-${reservationId}`).first();
    await expect(reservationBlock).toBeVisible();
    await reservationBlock.click();
    const reservationModal = page.getByTestId('reservation-detail-modal');
    await expect(reservationModal).toContainText(reservationId);
    if (reservation.parties?.driver?.name) {
      await expect(reservationModal).toContainText(reservation.parties.driver.name);
    }
    if (reservationVehicle) {
      await expect(reservationModal).toContainText(reservationVehicle);
    }

    await page.goto('/action-required?reservationId=MAN-ST-RETURN-001');
    await expect(page.getByRole('heading', { name: '조치 필요 항목' })).toBeVisible();
    await expect(page.getByText(actionItem?.subCategory ?? '추가요금 미수').first()).toBeVisible();
    await expect(page.getByText(actionItem?.vehicleNumber ?? '100하1000').first()).toBeVisible();

    await page.goto('/revenue');
    await expect(page.getByRole('heading', { name: '매출 요약' })).toBeVisible();
    await page.getByRole('button', { name: '정산 원장' }).click();
    await page.getByLabel('예약번호').fill(reservationId);
    await page.getByRole('button', { name: '정산 원장 조회' }).click();
    await expect(page.getByText(reservationId).first()).toBeVisible();
    await expect(page.getByText('needs_confirmation').first()).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
    await page.getByTestId('settings-tab-accounts').click();
    await expect(page.getByText('viewer@demo-company.com').first()).toBeVisible();

    await page.goto('/support-center?mode=manage');
    await expect(page.getByTestId('support-admin-heading')).toBeVisible();
    await expect(page.getByText(supportTicket?.id ?? 'MAN-SUPPORT-DEVICE-001').first()).toBeVisible();
    await expect(page.getByText(supportTicket?.title ?? '단말 OFF 알림 확인 요청').first()).toBeVisible();
  });

  test('installer sees generated installation work and remains blocked from rental settings', async ({ page, request }) => {
    const session = await login(request, INSTALLER_USER_ID);
    const tasks = await requestJson<ListEnvelope<DeviceInstallationTask>>(
      request,
      '/api/v2/device-installations/tasks',
      session.token,
    );
    const task = tasks.items?.find((item) => item.id === 'DEV-PENDING-V21VIN00001') ?? tasks.items?.[0];

    await installRealApiProxy(page, request);
    await seedSession(page, session, INSTALLER_PERMISSIONS);

    await page.goto('/device-installation');
    await expect(page).toHaveURL(/\/device-installation(?:\?.*)?$/);
    await expect(page.getByTestId('device-installation-vin-input')).toBeVisible();
    await expect(page.locator('tbody').getByText(task?.vin ?? task?.vehicleNumber ?? 'V21VIN00001').first()).toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/forbidden(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeVisible();
  });
});
