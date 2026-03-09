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

test('canReportAccidentForReservation blocks completed contracts even if the row type still looks like a reservation', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Reservations.tsx');

  assert.equal(
    module.canReportAccidentForReservation({
      id: 'R-225',
      vehicleNumber: '34B5678',
      customer: 'Lee',
      startDate: 0,
      endDate: 1,
      type: 'reservation',
      contractStatus: '완료',
      issues: [],
      phone: '010-0000-0000',
      paymentMethod: 'card',
      amount: '10000',
      deposit: '0',
      paymentStatus: 'pending',
      startDateFull: '2026-03-09',
      endDateFull: '2026-03-10',
    }),
    false,
  );
});
