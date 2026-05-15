import type { Page, Request, Route } from '@playwright/test';

export interface MockUser {
  userId: string;
  name: string;
  email: string;
  role: 'member' | 'admin' | 'super_admin' | 'installer';
  companyId: string;
  company: string;
}

export interface MockCompany {
  id: string;
  name: string;
  businessNumber: string;
  contactName: string;
  contactPhone: string;
  address: string;
  timezone: string;
  currency: string;
}

export interface ApiMockContext {
  route: Route;
  request: Request;
  method: string;
  path: string;
}

export type ApiMockHandler = (context: ApiMockContext) => Promise<void> | void;

interface ApiMockOptions {
  user?: Partial<MockUser>;
  company?: Partial<MockCompany>;
  auth?: {
    login?: 'success' | 'unauthorized';
    me?: 'success' | 'unauthorized' | 'unauthorized-once';
  };
  handlers?: Record<string, ApiMockHandler>;
}

const DEFAULT_USER: MockUser = {
  userId: 'member-001',
  name: 'E2E Member',
  email: 'member@pangea.local',
  role: 'member',
  companyId: 'company-001',
  company: 'Pangea Mobility',
};

const DEFAULT_COMPANY: MockCompany = {
  id: 'company-001',
  name: 'Pangea Mobility',
  businessNumber: '123-45-67890',
  contactName: '홍길동',
  contactPhone: '010-1111-2222',
  address: '서울특별시 강남구',
  timezone: 'Asia/Seoul',
  currency: 'KRW',
};

export const E2E_ROUTE_PERMISSIONS = [
  'route.home',
  'route.action-required',
  'route.assets',
  'route.reservations',
  'route.revenue',
  'route.support-center',
  'route.settings',
] as const;

export const E2E_MEMBER_ACTION_PERMISSIONS = [
  'action.assets.write',
  'action.reservations.write',
  'action.action-required.write',
] as const;

export const E2E_ROLE_DEFAULT_PERMISSIONS: Record<MockUser['role'], readonly string[]> = {
  member: [
    ...E2E_ROUTE_PERMISSIONS,
    ...E2E_MEMBER_ACTION_PERMISSIONS,
  ],
  admin: [
    ...E2E_ROUTE_PERMISSIONS,
    ...E2E_MEMBER_ACTION_PERMISSIONS,
    'action.revenue.write',
    'action.payments.write',
    'action.support.manage',
    'action.settings.write',
    'action.settings.members.write',
  ],
  super_admin: [
    ...E2E_ROUTE_PERMISSIONS,
    'route.demo-simulation',
    ...E2E_MEMBER_ACTION_PERMISSIONS,
    'action.revenue.write',
    'action.payments.write',
    'action.support.manage',
    'action.settings.write',
    'action.settings.members.write',
    'action.demo-simulation.write',
  ],
  installer: [
    'route.device-installation',
    'action.device-installation.write',
  ],
};

export function buildPermissionPayload(role: MockUser['role']): { permissions: string[] } {
  return {
    permissions: [...(E2E_ROLE_DEFAULT_PERMISSIONS[role] ?? E2E_ROLE_DEFAULT_PERMISSIONS.member)],
  };
}

interface ApiMeta {
  requestId: string;
  timestamp: string;
}

const API_V2_ROUTE_PATTERN = /\/api\/v2(?:\/|$|\?)/;
const API_V2_AUTH_ROUTE_PATTERN = /\/api\/v2\/auth\/.+/;
const API_MOCK_FAILURE_LISTENER_PAGES = new WeakSet<Page>();

const MOCK_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Origin, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

function buildMeta(): ApiMeta {
  return {
    requestId: 'e2e-request-id',
    timestamp: new Date().toISOString(),
  };
}

function toMockKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function isApiV2Path(path: string): boolean {
  return path === '/api/v2' || path.startsWith('/api/v2/');
}

function resolveHandler(
  handlers: Record<string, ApiMockHandler> | undefined,
  method: string,
  path: string,
): ApiMockHandler | null {
  if (!handlers) {
    return null;
  }

  const exactKey = toMockKey(method, path);
  if (handlers[exactKey]) {
    return handlers[exactKey];
  }

  for (const [handlerKey, handler] of Object.entries(handlers)) {
    if (!handlerKey.endsWith('*')) {
      continue;
    }
    const prefix = handlerKey.slice(0, -1);
    if (exactKey.startsWith(prefix)) {
      return handler;
    }
  }

  return null;
}

export function buildMockUser(role: MockUser['role'] = 'member'): MockUser {
  return {
    ...DEFAULT_USER,
    role,
    userId: `${role}-001`,
    name: role === 'installer' ? 'E2E Installer' : 'E2E Member',
    email: `${role}@pangea.local`,
  };
}

export function successEnvelope<TData>(data: TData): { status: 'success'; data: TData; meta: ApiMeta } {
  return {
    status: 'success',
    data,
    meta: buildMeta(),
  };
}

export function errorEnvelope(
  code: string,
  message: string,
  fields?: Array<{ name: string; reason: string }>,
): {
  status: 'error';
  error: { type: string; code: string; message: string; fields?: Array<{ name: string; reason: string }> };
  meta: ApiMeta;
} {
  return {
    status: 'error',
    error: {
      type: code,
      code,
      message,
      ...(fields ? { fields } : {}),
    },
    meta: buildMeta(),
  };
}

export async function fulfillSuccess(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    headers: MOCK_CORS_HEADERS,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(successEnvelope(data)),
  });
}

export async function fulfillError(
  route: Route,
  status: number,
  code: string,
  message: string,
  fields?: Array<{ name: string; reason: string }>,
): Promise<void> {
  await route.fulfill({
    status,
    headers: MOCK_CORS_HEADERS,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(errorEnvelope(code, message, fields)),
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function installApiMocks(page: Page, options: ApiMockOptions = {}): Promise<void> {
  const user = {
    ...buildMockUser(options.user?.role ?? DEFAULT_USER.role),
    ...options.user,
  } satisfies MockUser;

  const company = {
    ...DEFAULT_COMPANY,
    ...options.company,
  } satisfies MockCompany;

  const auth = {
    login: options.auth?.login ?? 'success',
    me: options.auth?.me ?? 'success',
  } as const;

  await page.addInitScript(
    ({ mockUser, mockAuth }: { mockUser: MockUser; mockAuth: { login: 'success' | 'unauthorized'; me: 'success' | 'unauthorized' | 'unauthorized-once' } }) => {
      const buildMeta = () => ({
        requestId: 'e2e-request-id',
        timestamp: new Date().toISOString(),
      });
      let remainingUnauthorizedMeResponses = mockAuth.me === 'unauthorized-once' ? 1 : 0;

      const successEnvelope = (data: unknown) => ({
        status: 'success',
        data,
        meta: buildMeta(),
      });

      const errorEnvelope = (code: string, message: string) => ({
        status: 'error',
        error: {
          type: code,
          code,
          message,
        },
        meta: buildMeta(),
      });

      const jsonResponse = (status: number, body: unknown) => (
        new Response(JSON.stringify(body), {
          status,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
        })
      );

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = (
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
        );

        let path = '';
        try {
          path = new URL(requestUrl, window.location.origin).pathname;
        } catch {
          return originalFetch(input, init);
        }

        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

        if (method === 'GET' && path === '/api/v2/auth/me') {
          if (mockAuth.me === 'unauthorized') {
            return jsonResponse(401, errorEnvelope('UNAUTHORIZED', 'expired session'));
          }
          if (remainingUnauthorizedMeResponses > 0) {
            remainingUnauthorizedMeResponses -= 1;
            return jsonResponse(401, errorEnvelope('UNAUTHORIZED', 'expired session'));
          }
          return jsonResponse(200, successEnvelope(mockUser));
        }

        if (method === 'POST' && path === '/api/v2/auth/login') {
          if (mockAuth.login === 'unauthorized') {
            return jsonResponse(401, errorEnvelope('UNAUTHORIZED', 'invalid credentials'));
          }
          return jsonResponse(200, successEnvelope({
            token: `e2e-token-${mockUser.userId}`,
            expiresIn: 3600,
            user: mockUser,
          }));
        }

        if (method === 'POST' && path === '/api/v2/auth/refresh') {
          return jsonResponse(401, errorEnvelope('UNAUTHORIZED', 'refresh token expired'));
        }

        if (method === 'POST' && path === '/api/v2/auth/logout') {
          return jsonResponse(200, successEnvelope({ message: 'ok' }));
        }

        return originalFetch(input, init);
      };
    },
    {
      mockUser: user,
      mockAuth: auth,
    },
  );

  if (!API_MOCK_FAILURE_LISTENER_PAGES.has(page)) {
    page.on('requestfailed', (request) => {
      const url = request.url();
      let path = url;
      try {
        path = new URL(url).pathname;
      } catch {
        // URL parsing 실패 시 원본 URL 문자열로 필터링한다.
      }
      if (!isApiV2Path(path)) {
        return;
      }
      const reason = request.failure()?.errorText ?? 'unknown';
      // CI 로그에서 실제 실패 URL을 확인하기 위한 최소 진단 로그.
      console.log(`[e2e][api-requestfailed] ${request.method().toUpperCase()} ${url} :: ${reason}`);
    });
    API_MOCK_FAILURE_LISTENER_PAGES.add(page);
  }

  await page.route(API_V2_ROUTE_PATTERN, async (route, request) => {
    try {
      const method = request.method().toUpperCase();
      const path = new URL(request.url()).pathname;

      if (!isApiV2Path(path)) {
        await route.continue();
        return;
      }

      if (path.startsWith('/api/v2/auth/')) {
        console.log(`[e2e][api-route] ${method} ${path}`);
      }

      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: MOCK_CORS_HEADERS,
          body: '',
        });
        return;
      }

      const customHandler = resolveHandler(options.handlers, method, path);
      if (customHandler) {
        if (path.startsWith('/api/v2/auth/')) {
          console.log(`[e2e][api-route-handler] custom ${method} ${path}`);
        }
        await customHandler({
          route,
          request,
          method,
          path,
        });
        return;
      }

      if (method === 'GET' && path === '/api/v2/settings/company') {
        await fulfillSuccess(route, company);
        return;
      }

      if (method === 'GET' && path === '/api/v2/auth/me') {
        console.log('[e2e][api-route-handler] default GET /api/v2/auth/me');
        await fulfillSuccess(route, user);
        return;
      }

      if (method === 'POST' && path === '/api/v2/auth/login') {
        console.log('[e2e][api-route-handler] default POST /api/v2/auth/login');
        await fulfillSuccess(route, {
          token: `e2e-token-${user.userId}`,
          expiresIn: 3600,
          user,
        });
        return;
      }

      if (method === 'GET' && path === '/api/v2/permissions/me') {
        await fulfillSuccess(route, buildPermissionPayload(user.role));
        return;
      }

      if (method === 'POST' && path === '/api/v2/auth/refresh') {
        console.log('[e2e][api-route-handler] default POST /api/v2/auth/refresh');
        await fulfillError(route, 401, 'UNAUTHORIZED', 'refresh token expired');
        return;
      }

      if (method === 'POST' && path === '/api/v2/auth/logout') {
        console.log('[e2e][api-route-handler] default POST /api/v2/auth/logout');
        await fulfillSuccess(route, { message: 'ok' });
        return;
      }

      if (method === 'GET' && path === '/api/v2/payments/status') {
        await fulfillError(route, 404, 'NOT_FOUND', 'payment not found');
        return;
      }

      if (method === 'GET' && path.startsWith('/api/v2/payments/')) {
        await fulfillError(route, 404, 'NOT_FOUND', 'payment not found');
        return;
      }

      console.log(`[e2e][api-route-handler] unmocked ${method} ${path}`);
      await fulfillError(route, 501, 'UNMOCKED_ENDPOINT', `${method} ${path} is not mocked`);
    } catch (error) {
      console.error(
        '[e2e][api-route-error]',
        request.method().toUpperCase(),
        request.url(),
        error,
      );
      await fulfillError(route, 500, 'MOCK_HANDLER_ERROR', 'mock route handler threw an error');
    }
  });

  await page.route(API_V2_AUTH_ROUTE_PATTERN, async (route, request) => {
    try {
      const method = request.method().toUpperCase();
      const path = new URL(request.url()).pathname;

      if (!path.startsWith('/api/v2/auth/')) {
        await route.continue();
        return;
      }

      const customHandler = resolveHandler(options.handlers, method, path);
      if (customHandler) {
        await customHandler({
          route,
          request,
          method,
          path,
        });
        return;
      }

      if (method === 'GET' && path === '/api/v2/auth/me') {
        await fulfillSuccess(route, user);
        return;
      }

      if (method === 'POST' && path === '/api/v2/auth/login') {
        await fulfillSuccess(route, {
          token: `e2e-token-${user.userId}`,
          expiresIn: 3600,
          user,
        });
        return;
      }

      if (method === 'POST' && path === '/api/v2/auth/refresh') {
        await fulfillError(route, 401, 'UNAUTHORIZED', 'refresh token expired');
        return;
      }

      if (method === 'POST' && path === '/api/v2/auth/logout') {
        await fulfillSuccess(route, { message: 'ok' });
        return;
      }

      await fulfillError(route, 501, 'UNMOCKED_AUTH_ENDPOINT', `${method} ${path} is not mocked`);
    } catch (error) {
      console.error(
        '[e2e][api-auth-route-error]',
        request.method().toUpperCase(),
        request.url(),
        error,
      );
      await fulfillError(route, 500, 'MOCK_HANDLER_ERROR', 'auth route handler threw an error');
    }
  });
}
