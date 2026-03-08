import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

let viteServer;

function createSummary(overrides = {}) {
  return {
    period: {
      from: '2026-03-01',
      to: '2026-03-08',
      granularity: 'week',
      timezone: 'Asia/Seoul',
    },
    totals: {
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      paidCount: 0,
      refundCount: 0,
      currency: 'KRW',
    },
    buckets: [],
    ...overrides,
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

test('revenue view model treats non-zero summary data as non-empty without trend data', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');

  const isEmpty = module.isRevenueSummaryEmpty(createSummary({
    buckets: [
      {
        label: 'Week 1',
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        grossRevenue: 120000,
        refundAmount: 0,
        netRevenue: 120000,
        paidCount: 3,
        refundCount: 0,
      },
    ],
  }));

  assert.equal(isEmpty, false);
});

test('revenue view model creates an empty trend payload for the active date range', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');

  const trend = module.createEmptyRevenueTrend({
    from: '2026-03-01',
    to: '2026-03-08',
  });

  assert.deepEqual(trend, {
    period: {
      from: '2026-03-01',
      to: '2026-03-08',
      granularity: 'day',
      timezone: 'Asia/Seoul',
    },
    totals: {
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      paidCount: 0,
      refundCount: 0,
      currency: 'KRW',
      points: 0,
    },
    items: [],
  });
});

test('revenue view model builds a snapshot with an empty trend fallback when trend data is unavailable', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');

  const summary = createSummary({
    buckets: [
      {
        label: 'Week 1',
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        grossRevenue: 120000,
        refundAmount: 0,
        netRevenue: 120000,
        paidCount: 3,
        refundCount: 0,
      },
    ],
  });

  const snapshot = module.createRevenueSnapshot({
    filters: {
      preset: 'last30Days',
      granularity: 'week',
    },
    summary,
    from: '2026-03-01',
    to: '2026-03-08',
  });

  assert.deepEqual(snapshot, {
    filters: {
      preset: 'last30Days',
      granularity: 'week',
    },
    summary,
    trend: {
      period: {
        from: '2026-03-01',
        to: '2026-03-08',
        granularity: 'day',
        timezone: 'Asia/Seoul',
      },
      totals: {
        grossRevenue: 0,
        refundAmount: 0,
        netRevenue: 0,
        paidCount: 0,
        refundCount: 0,
        currency: 'KRW',
        points: 0,
      },
      items: [],
    },
  });
});

test('revenue view model resolves summary success with trend failure as a partial result', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');
  const trendError = new Error('trend failed');

  const result = module.resolveRevenueHydrationResult({
    filters: {
      preset: 'last30Days',
      granularity: 'week',
    },
    from: '2026-03-01',
    to: '2026-03-08',
    summaryResult: {
      status: 'fulfilled',
      value: createSummary({
        buckets: [
          {
            label: 'Week 1',
            startDate: '2026-03-01',
            endDate: '2026-03-07',
            grossRevenue: 120000,
            refundAmount: 0,
            netRevenue: 120000,
            paidCount: 3,
            refundCount: 0,
          },
        ],
      }),
    },
    trendResult: {
      status: 'rejected',
      reason: trendError,
    },
  });

  assert.equal(result.kind, 'partial');
  assert.equal(result.isEmpty, false);
  assert.equal(result.trendError, trendError);
  assert.deepEqual(result.snapshot?.filters, {
    preset: 'last30Days',
    granularity: 'week',
  });
  assert.deepEqual(result.snapshot?.trend.items, []);
});

test('revenue view model resolves summary failure as a page-level failure', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');
  const summaryError = new Error('summary failed');

  const result = module.resolveRevenueHydrationResult({
    filters: {
      preset: 'last30Days',
      granularity: 'week',
    },
    from: '2026-03-01',
    to: '2026-03-08',
    summaryResult: {
      status: 'rejected',
      reason: summaryError,
    },
    trendResult: {
      status: 'fulfilled',
      value: module.createEmptyRevenueTrend({
        from: '2026-03-01',
        to: '2026-03-08',
      }),
    },
  });

  assert.equal(result.kind, 'summary-error');
  assert.equal(result.summaryError, summaryError);
  assert.equal(result.snapshot, null);
  assert.equal(result.trendError, null);
});

test('revenue view model settles summary failures without waiting for trend', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');
  const trendDeferred = createDeferred();
  const summaryError = new Error('summary failed first');

  const raced = await Promise.race([
    module.settleRevenueHydration({
      filters: {
        preset: 'last30Days',
        granularity: 'week',
      },
      from: '2026-03-01',
      to: '2026-03-08',
      summaryPromise: Promise.reject(summaryError),
      trendPromise: trendDeferred.promise,
      hasPreviousSnapshot: false,
      previousTrendError: null,
    }).then((result) => ({ type: 'result', result })),
    new Promise((resolve) => setTimeout(() => resolve({ type: 'timeout' }), 20)),
  ]);

  assert.equal(raced.type, 'result');
  assert.equal(raced.result.kind, 'summary-error');
  assert.equal(raced.result.summaryError, summaryError);

  trendDeferred.reject(new Error('late trend failure'));
  await Promise.resolve();
});

test('revenue view model preserves the previous trend error when summary refresh fails', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/revenueViewModel.ts');
  const summaryError = new Error('summary refresh failed');
  const previousTrendError = new Error('trend failed earlier');
  const trendDeferred = createDeferred();

  const result = await module.settleRevenueHydration({
    filters: {
      preset: 'last30Days',
      granularity: 'week',
    },
    from: '2026-03-01',
    to: '2026-03-08',
    summaryPromise: Promise.reject(summaryError),
    trendPromise: trendDeferred.promise,
    hasPreviousSnapshot: true,
    previousTrendError,
  });

  assert.equal(result.kind, 'summary-error');
  assert.equal(result.displayTrendError, previousTrendError);

  trendDeferred.reject(new Error('late trend failure'));
  await Promise.resolve();
});
