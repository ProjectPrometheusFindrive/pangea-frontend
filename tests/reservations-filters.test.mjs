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
