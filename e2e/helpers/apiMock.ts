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

interface ApiMeta {
  requestId: string;
  timestamp: string;
}

const API_V2_ROUTE_PATTERN = /\/api\/v2(?:\/|$|\?)/;
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

export function successEnvelope<TData>(data: TData): { success: true; data: TData; meta: ApiMeta } {
  return {
    success: true,
    data,
    meta: buildMeta(),
  };
}

export function errorEnvelope(
  code: string,
  message: string,
  fields?: Array<{ name: string; reason: string }>,
): {
  success: false;
  error: { code: string; message: string; fields?: Array<{ name: string; reason: string }> };
  meta: ApiMeta;
} {
  return {
    success: false,
    error: {
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
    ...DEFAULT_USER,
    ...options.user,
  } satisfies MockUser;

  const company = {
    ...DEFAULT_COMPANY,
    ...options.company,
  } satisfies MockCompany;

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

    if (method === 'GET' && path === '/api/v2/company') {
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
      await fulfillError(route, 404, 'NOT_FOUND', 'permissions endpoint is not available');
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

    console.log(`[e2e][api-route-handler] fallback ${method} ${path}`);
    await fulfillSuccess(route, {});
  });
}
