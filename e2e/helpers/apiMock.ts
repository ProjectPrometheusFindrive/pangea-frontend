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

function buildMeta(): ApiMeta {
  return {
    requestId: 'e2e-request-id',
    timestamp: new Date().toISOString(),
  };
}

function toMockKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
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

  await page.route('**/api/v2/**', async (route, request) => {
    const method = request.method().toUpperCase();
    const path = new URL(request.url()).pathname;

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

    if (method === 'GET' && path === '/api/v2/company') {
      await fulfillSuccess(route, company);
      return;
    }

    if (method === 'GET' && path === '/api/v2/auth/me') {
      await fulfillSuccess(route, user);
      return;
    }

    if (method === 'GET' && path === '/api/v2/permissions/me') {
      await fulfillError(route, 404, 'NOT_FOUND', 'permissions endpoint is not available');
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

    if (method === 'GET' && path === '/api/v2/payments/status') {
      await fulfillError(route, 404, 'NOT_FOUND', 'payment not found');
      return;
    }

    if (method === 'GET' && path.startsWith('/api/v2/payments/')) {
      await fulfillError(route, 404, 'NOT_FOUND', 'payment not found');
      return;
    }

    await fulfillSuccess(route, {});
  });
}
