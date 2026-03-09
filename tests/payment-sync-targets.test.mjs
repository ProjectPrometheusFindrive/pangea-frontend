import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viewModelPath = path.resolve(__dirname, '../src/app/pages/reservationsViewModel.ts');

function extractFunction(source, name) {
  const startIndex = source.indexOf(`export function ${name}(`);
  if (startIndex === -1) {
    throw new Error(`Could not find function ${name}`);
  }

  let braceDepth = 0;
  let endIndex = -1;
  for (let index = startIndex; index < source.length; index += 1) {
    const currentChar = source[index];
    if (currentChar === '{') {
      braceDepth += 1;
    } else if (currentChar === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) {
        endIndex = index + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error(`Could not parse function ${name}`);
  }

  return source
    .slice(startIndex, endIndex)
    .replace(`export function ${name}`, `function ${name}`);
}

function stripTypeScript(functionSource) {
  return functionSource
    .replace(/: [A-Za-z0-9_<>\[\]\| ,]+(?=[,)=])/g, '')
    .replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]\| ]+\s*\{/g, ') {');
}

async function loadBuildPaymentSyncTargets() {
  const source = await fs.readFile(viewModelPath, 'utf8');
  const executableSource = stripTypeScript(extractFunction(source, 'buildPaymentSyncTargets'));
  const script = new vm.Script(`(() => { ${executableSource}; return { buildPaymentSyncTargets }; })()`);
  return script.runInNewContext().buildPaymentSyncTargets;
}

test('payment sync targets skip completed reservations during list polling', async () => {
  const buildPaymentSyncTargets = await loadBuildPaymentSyncTargets();

  const targets = buildPaymentSyncTargets([
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

  assert.equal(JSON.stringify(targets), JSON.stringify([]));
});

test('payment sync targets keep the selected completed reservation for detail refresh', async () => {
  const buildPaymentSyncTargets = await loadBuildPaymentSyncTargets();

  const selectedReservation = {
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
  };

  const targets = buildPaymentSyncTargets([selectedReservation], selectedReservation);

  assert.equal(
    JSON.stringify(targets),
    JSON.stringify([
      {
        reservationId: 'R-PAID',
        fallbackStatus: '대기',
      },
    ]),
  );
});
