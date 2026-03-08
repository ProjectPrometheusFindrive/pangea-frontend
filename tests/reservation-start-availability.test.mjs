import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reservationsPath = path.resolve(__dirname, '../src/app/pages/Reservations.tsx');

function extractFunction(source, name) {
  const startIndex = source.indexOf(`function ${name}(`);
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

  return source.slice(startIndex, endIndex);
}

function stripTypeScript(functionSource) {
  return functionSource
    .replace(/: [A-Za-z0-9_<>\[\]\| ]+(?=[,)])/g, '')
    .replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]\| ]+\s*\{/g, ') {');
}

async function loadReservationStartGuard() {
  const source = await fs.readFile(reservationsPath, 'utf8');
  const executableSource = [
    extractFunction(source, 'getReservationStartTimestamp'),
    extractFunction(source, 'canStartReservationNow'),
  ]
    .map(stripTypeScript)
    .join('\n\n');

  const script = new vm.Script(`(() => { ${executableSource}; return { canStartReservationNow }; })()`);
  const context = vm.createContext({ Date, Number });
  return script.runInContext(context).canStartReservationNow;
}

test('canStartReservationNow blocks a reservation before the scheduled startAt time on the same day', async () => {
  const canStartReservationNow = await loadReservationStartGuard();
  const now = Date.parse('2026-03-09T09:00:00+09:00');

  assert.equal(
    canStartReservationNow(
      {
        id: 'R-223',
        vehicleNumber: '12A3456',
        customer: 'Kim',
        startDate: 0,
        endDate: 1,
        type: 'reservation',
        issues: [],
        phone: '010-0000-0000',
        paymentMethod: 'card',
        amount: '10000',
        deposit: '0',
        paymentStatus: 'pending',
        startDateFull: '2026-03-09',
        endDateFull: '2026-03-10',
        scheduledStartAt: '2026-03-09T12:00:00+09:00',
      },
      now,
    ),
    false,
  );
});
