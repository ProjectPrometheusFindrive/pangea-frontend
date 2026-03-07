import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

let viteServer;

function createJsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function successEnvelope(data) {
  return {
    status: 'success',
    data,
  };
}

before(async () => {
  viteServer = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: {
      noDiscovery: true,
    },
    server: {
      middlewareMode: true,
      hmr: false,
    },
  });
});

after(async () => {
  await viteServer?.close();
});

test('resolvePaymentStatuses uses the status endpoint result without payment detail fan-out', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/utils/paymentStatusSync.ts');
  const requestedPaths = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : String(input));
    requestedPaths.push(url.pathname);

    if (url.pathname === '/api/v2/payments/status') {
      return createJsonResponse(200, successEnvelope({
        reservationId: 'R-100',
        items: [
          {
            id: 'PAY-100',
            reservationId: 'R-100',
            status: 'pending',
            updatedAt: '2026-03-07T00:00:00Z',
          },
        ],
        total: 1,
      }));
    }

    if (url.pathname === '/api/v2/payments/PAY-100') {
      return createJsonResponse(200, successEnvelope({
        id: 'PAY-100',
        reservationId: 'R-100',
        status: 'paid',
        updatedAt: '2026-03-07T00:00:05Z',
      }));
    }

    return createJsonResponse(404, {
      status: 'error',
      error: {
        type: 'NOT_FOUND',
        message: 'not found',
      },
    });
  };

  try {
    const result = await module.resolvePaymentStatuses([
      { reservationId: 'R-100', fallbackStatus: '대기' },
    ]);

    assert.equal(result.byReservationId['R-100']?.status, 'pending');
    assert.deepEqual(requestedPaths, ['/api/v2/payments/status']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolvePaymentStatuses caches empty status responses as not-found and skips repeated fetches', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/utils/paymentStatusSync.ts');
  let requestCount = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : String(input));
    if (url.pathname === '/api/v2/payments/status') {
      requestCount += 1;
      return createJsonResponse(200, successEnvelope({
        reservationId: 'R-404',
        items: [],
        total: 0,
      }));
    }

    return createJsonResponse(404, {
      status: 'error',
      error: {
        type: 'NOT_FOUND',
        message: 'not found',
      },
    });
  };

  try {
    const first = await module.resolvePaymentStatuses([{ reservationId: 'R-404' }]);
    const second = await module.resolvePaymentStatuses([{ reservationId: 'R-404' }]);

    assert.equal(first.byReservationId['R-404']?.status, 'not-found');
    assert.equal(second.byReservationId['R-404']?.status, 'not-found');
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolvePaymentStatuses prefers not-found over fallback status when the status endpoint is empty', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/utils/paymentStatusSync.ts');
  let requestCount = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : String(input));
    if (url.pathname === '/api/v2/payments/status') {
      requestCount += 1;
      return createJsonResponse(200, successEnvelope({
        reservationId: 'R-404-FALLBACK',
        items: [],
        total: 0,
      }));
    }

    return createJsonResponse(404, {
      status: 'error',
      error: {
        type: 'NOT_FOUND',
        message: 'not found',
      },
    });
  };

  try {
    const first = await module.resolvePaymentStatuses([
      { reservationId: 'R-404-FALLBACK', fallbackStatus: '대기' },
    ]);
    const second = await module.resolvePaymentStatuses([
      { reservationId: 'R-404-FALLBACK', fallbackStatus: '대기' },
    ]);

    assert.equal(first.byReservationId['R-404-FALLBACK']?.status, 'not-found');
    assert.equal(second.byReservationId['R-404-FALLBACK']?.status, 'not-found');
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
