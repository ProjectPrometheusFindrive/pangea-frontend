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

test('getReservationsList sends canonical size and paymentScope query parameters', async () => {
  const module = await viteServer.ssrLoadModule('/src/services/reservations.ts');
  const requestedUrls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : String(input));
    requestedUrls.push(url);
    return createJsonResponse(200, successEnvelope({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
    }));
  };

  try {
    await module.getReservationsList({
      page: 2,
      size: 50,
      status: 'reservation',
      paymentScope: 'delinquent',
    });

    assert.equal(requestedUrls.length, 1);
    const requestUrl = requestedUrls[0];
    assert.equal(requestUrl.searchParams.get('page'), '2');
    assert.equal(requestUrl.searchParams.get('size'), '50');
    assert.equal(requestUrl.searchParams.get('paymentScope'), 'delinquent');
    assert.equal(requestUrl.searchParams.has('pageSize'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reservation view model keeps all asset rows and real models when reservations exist', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/reservationsViewModel.ts');

  const rows = module.mergeVehicleRows(
    {
      assets: [
        {
          vehicleNumber: '12가3456',
          model: '아반떼',
          status: '가용',
          issues: [],
          insuranceExpiry: '2026-12-31',
          nextInspection: '2026-06-30',
          vin: 'VIN-001',
          year: '2024',
          owner: '홍길동',
        },
        {
          vehicleNumber: '34나5678',
          model: '쏘나타',
          status: '가용',
          issues: [],
          insuranceExpiry: '2026-12-31',
          nextInspection: '2026-06-30',
          vin: 'VIN-002',
          year: '2025',
          owner: '김영희',
        },
      ],
    },
    [
      {
        id: 'R-1',
        vehicleNumber: '12가3456',
        customer: '김고객',
        startDate: 0,
        endDate: 1,
        type: 'reservation',
        issues: ['미납/결제 문제'],
        phone: '010-1111-2222',
        paymentMethod: '카드',
        amount: '250,000원',
        deposit: '50,000원',
        paymentStatus: '대기',
      },
    ],
  );

  assert.equal(rows.length, 2);

  const reservedVehicle = rows.find((row) => row.vehicleNumber === '12가3456');
  assert.equal(reservedVehicle?.model, '아반떼');
  assert.equal(reservedVehicle?.status, '예약');
  assert.deepEqual(reservedVehicle?.issues, ['미납/결제 문제']);

  const idleVehicle = rows.find((row) => row.vehicleNumber === '34나5678');
  assert.equal(idleVehicle?.model, '쏘나타');
  assert.equal(idleVehicle?.status, '가용');
});

test('reservation view model maps VIN-only reservation rows onto asset vehicle numbers', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/reservationsViewModel.ts');

  const rows = module.mergeVehicleRows(
    {
      assets: [
        {
          vehicleNumber: '100하1000',
          model: '모닝',
          status: '가용',
          issues: [],
          insuranceExpiry: '2026-12-31',
          nextInspection: '2026-06-30',
          vin: 'DEMO-VIN-0001',
          year: '2024',
          owner: '데모렌터카',
        },
      ],
    },
    [
      {
        id: 'R-1',
        vehicleNumber: 'DEMO-VIN-0001',
        vin: 'DEMO-VIN-0001',
        customer: '김고객',
        startDate: 0,
        endDate: 1,
        type: 'reservation',
        issues: [],
        phone: '010-1111-2222',
        paymentMethod: '카드',
        amount: '250,000원',
        deposit: '50,000원',
        paymentStatus: '대기',
      },
    ],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.vehicleNumber, '100하1000');
  assert.equal(rows[0]?.vin, 'DEMO-VIN-0001');
  assert.equal(rows[0]?.status, '예약');
});

test('reservation view model keeps completed reservations out of list payment sync targets', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/reservationsViewModel.ts');

  const targets = module.buildPaymentSyncTargets([
    {
      id: 'R-1',
      vehicleNumber: '12가3456',
      customer: '김고객',
      startDate: 0,
      endDate: 1,
      type: 'reservation',
      phone: '010-1111-2222',
      paymentMethod: '카드',
      amount: '250,000원',
      deposit: '50,000원',
      paymentStatus: '대기',
    },
    {
      id: 'R-2',
      vehicleNumber: '34나5678',
      customer: '박고객',
      startDate: 2,
      endDate: 3,
      type: 'return',
      phone: '010-3333-4444',
      paymentMethod: '카드',
      amount: '180,000원',
      deposit: '30,000원',
      paymentStatus: '완료',
    },
  ]);

  assert.deepEqual(targets, [
    {
      reservationId: 'R-1',
      fallbackStatus: '대기',
    },
  ]);
});

test('reservation view model adds the selected completed reservation back for detail payment sync', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/reservationsViewModel.ts');

  const completedReservation = {
    id: 'R-2',
    vehicleNumber: '34나5678',
    customer: '박고객',
    startDate: 2,
    endDate: 3,
    type: 'return',
    phone: '010-3333-4444',
    paymentMethod: '카드',
    amount: '180,000원',
    deposit: '30,000원',
    paymentStatus: '완료',
  };

  const targets = module.buildPaymentSyncTargets([
    {
      id: 'R-1',
      vehicleNumber: '12가3456',
      customer: '김고객',
      startDate: 0,
      endDate: 1,
      type: 'reservation',
      phone: '010-1111-2222',
      paymentMethod: '카드',
      amount: '250,000원',
      deposit: '50,000원',
      paymentStatus: '대기',
    },
    completedReservation,
  ], completedReservation);

  assert.deepEqual(targets, [
    {
      reservationId: 'R-1',
      fallbackStatus: '대기',
    },
    {
      reservationId: 'R-2',
      fallbackStatus: '완료',
    },
  ]);
});

test('reservation view model keeps the highest priority active reservation when a vehicle has multiple rows', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/reservationsViewModel.ts');

  const rows = module.mergeVehicleRows(
    {
      assets: [
        {
          vehicleNumber: '12가3456',
          model: '아반떼',
          status: '가용',
          issues: [],
          insuranceExpiry: '2026-12-31',
          nextInspection: '2026-06-30',
          vin: 'VIN-001',
          year: '2024',
          owner: '홍길동',
        },
      ],
    },
    [
      {
        id: 'R-RENTAL',
        vehicleNumber: '12가3456',
        customer: '김고객',
        startDate: 0,
        endDate: 1,
        type: 'rental',
        issues: ['실사용 중'],
        phone: '010-1111-2222',
        paymentMethod: '카드',
        amount: '250,000원',
        deposit: '50,000원',
        paymentStatus: '대기',
      },
      {
        id: 'R-RETURN',
        vehicleNumber: '12가3456',
        customer: '박고객',
        startDate: 2,
        endDate: 3,
        type: 'return',
        issues: [],
        phone: '010-3333-4444',
        paymentMethod: '카드',
        amount: '180,000원',
        deposit: '30,000원',
        paymentStatus: '완료',
      },
    ],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, '대여중');
  assert.deepEqual(rows[0]?.issues, ['실사용 중']);
});
