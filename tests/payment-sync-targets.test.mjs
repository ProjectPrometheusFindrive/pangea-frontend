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
    cacheDir: '.vite-test-payment-sync-targets',
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

test('payment sync targets keep completed reservations so detail tabs can refresh paid status', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/reservationsViewModel.ts');

  const targets = module.buildPaymentSyncTargets([
    {
      id: 'R-PAID',
      vehicleNumber: 'VIN-RETURN-001',
      customer: 'Paid Customer',
      startDate: 2,
      endDate: 3,
      type: 'return',
      phone: '010-5555-6666',
      paymentMethod: 'card',
      amount: '180000',
      deposit: '30000',
      paymentStatus: '대기',
    },
  ]);

  assert.deepEqual(targets, [
    {
      reservationId: 'R-PAID',
      fallbackStatus: '대기',
    },
  ]);
});
