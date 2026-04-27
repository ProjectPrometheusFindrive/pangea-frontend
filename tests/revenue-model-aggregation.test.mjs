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

test('revenue model rows aggregate by model with sum/average/share rules', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/Revenue.tsx');

  const rows = module.buildRevenueModelRows([
    {
      rank: 1,
      vehicleId: 'VIN-001',
      vehicleNumber: '12가3456',
      model: 'EV6',
      revenue: 1000,
      reservationCount: 2,
      utilizationRate: 0.4,
      shareRate: 0,
    },
    {
      rank: 2,
      vehicleId: 'VIN-002',
      vehicleNumber: '34나5678',
      model: 'EV6',
      revenue: 500,
      reservationCount: 1,
      utilizationRate: 0.6,
      shareRate: 0,
    },
    {
      rank: 3,
      vehicleId: 'VIN-003',
      vehicleNumber: '56다9012',
      model: 'K5',
      revenue: 300,
      reservationCount: 2,
      utilizationRate: 0.5,
      shareRate: 0,
    },
    {
      rank: 4,
      vehicleId: 'VIN-004',
      vehicleNumber: '77라1212',
      model: ' ',
      revenue: 200,
      reservationCount: 1,
      utilizationRate: 0.2,
      shareRate: 0,
    },
  ]);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].model, 'EV6');
  assert.equal(rows[0].revenue, 1500);
  assert.equal(rows[0].reservationCount, 3);
  assert.equal(rows[0].utilizationRate, 50);
  assert.equal(Number(rows[0].shareRate.toFixed(1)), 75.0);

  assert.equal(rows[1].rank, 2);
  assert.equal(rows[1].model, 'K5');
  assert.equal(rows[1].revenue, 300);
  assert.equal(rows[1].reservationCount, 2);
  assert.equal(rows[1].utilizationRate, 50);
  assert.equal(Number(rows[1].shareRate.toFixed(1)), 15.0);

  assert.equal(rows[2].rank, 3);
  assert.equal(rows[2].model, '차종 미확인');
  assert.equal(rows[2].revenue, 200);
  assert.equal(rows[2].reservationCount, 1);
  assert.equal(rows[2].utilizationRate, 20);
  assert.equal(Number(rows[2].shareRate.toFixed(1)), 10.0);
});
