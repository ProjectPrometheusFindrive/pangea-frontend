import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

let viteServer;

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

test('normalizeReservationPaymentStatus maps overdue labels to unpaid', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Reservations.tsx');

  assert.equal(module.normalizeReservationPaymentStatus('overdue'), '미납');
  assert.equal(module.normalizeReservationPaymentStatus('연체'), '미납');
});

test('isDelinquentPaymentScopeActive only enables the scope for unpaid view', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Reservations.tsx');

  assert.equal(module.isDelinquentPaymentScopeActive('unpaid', 'delinquent'), true);
  assert.equal(module.isDelinquentPaymentScopeActive('reservation', 'delinquent'), false);
  assert.equal(module.isDelinquentPaymentScopeActive('unpaid', 'all'), false);
});

test('matchesReservationFilters keeps delinquent-scope rows without legacy issue labels', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Reservations.tsx');

  const result = module.matchesReservationFilters(
    {
      id: 'R-OVERDUE',
      vehicleNumber: '12가3456',
      customer: '연체고객',
      startDate: 0,
      endDate: 1,
      type: 'rental',
      issues: [],
      phone: '010-1111-2222',
      paymentMethod: '카드',
      amount: '250,000원',
      deposit: '50,000원',
      paymentStatus: '대기',
    },
    {
      viewFilter: 'unpaid',
      paymentScope: 'delinquent',
      searchQuery: '',
    },
  );

  assert.equal(result, true);
});

test('getReservationCalendarSegments appends a red overdue segment until the actual returned day', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Reservations.tsx');
  const now = new Date();
  const returnedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 10, 0, 0).toISOString();

  const segments = module.getReservationCalendarSegments({
    id: 'R-LATE-RETURN',
    vehicleNumber: '12가3456',
    customer: '연체고객',
    startDate: -6,
    endDate: -4,
    returnedAt,
    type: 'return',
    phone: '010-1111-2222',
    paymentMethod: '카드',
    amount: '250,000원',
    deposit: '50,000원',
    paymentStatus: '완료',
  });

  assert.deepEqual(segments, [
    { kind: 'scheduled', startDate: -6, endDate: -4 },
    { kind: 'overdue', startDate: -3, endDate: -2 },
  ]);
});

test('getReservationOverdueSegment keeps an unreturned rental blocked through today', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Reservations.tsx');

  const overdueSegment = module.getReservationOverdueSegment({
    id: 'R-LATE-OPEN',
    vehicleNumber: '34나5678',
    customer: '미반납고객',
    startDate: -5,
    endDate: -2,
    type: 'rental',
    contractStatus: '대여중',
    phone: '010-2222-3333',
    paymentMethod: '카드',
    amount: '180,000원',
    deposit: '30,000원',
    paymentStatus: '대기',
  });

  assert.deepEqual(overdueSegment, {
    kind: 'overdue',
    startDate: -1,
    endDate: 0,
  });
});
