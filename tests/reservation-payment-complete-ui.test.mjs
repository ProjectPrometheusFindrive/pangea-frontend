import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('payments service exposes a PATCH helper for completing reservation payments', () => {
  const source = readProjectFile('src/services/payments.ts');

  assert.match(source, /export interface PatchPaymentStatusOptions/u);
  assert.match(source, /export function patchPaymentStatus\(/u);
  assert.match(source, /path:\s*`\/api\/v2\/payments\/\$\{encodeURIComponent\(paymentId\)\}`/u);
  assert.match(source, /method:\s*'PATCH'/u);
  assert.match(source, /body:\s*payload/u);
});

test('reservation payment tab only renders the complete action for authorized unpaid states', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /const canWritePayments = canPerformAction\(ACTION_PERMISSIONS\.paymentsWrite\);/u);
  assert.match(source, /export function canMarkReservationPaymentAsPaid\(/u);
  assert.match(source, /const effectiveStatus = paymentSnapshot\?\.status === 'not-found'/u);
  assert.match(source, /\?\s*toCanonicalPaymentStatus\(reservation\.paymentStatus\)/u);
  assert.match(source, /:\s*paymentSnapshot\?\.status \?\? toCanonicalPaymentStatus\(reservation\.paymentStatus\);/u);
  assert.match(source, /return effectiveStatus === 'pending' \|\| effectiveStatus === 'unpaid';/u);
  assert.match(source, /canWritePayments && canMarkReservationPaymentAsPaid\(selectedReservation, selectedReservationPaymentSync\) && \(/u);
  assert.match(source, /data-testid="reservation-payment-complete-button"/u);
});

test('reservation payment completion falls back to AUTO-PAY ids and refreshes list and detail state', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /export function getReservationPaymentMutationId\(/u);
  assert.match(source, /return paymentSnapshot\?\.paymentId\?\.trim\(\) \|\| `AUTO-PAY-\$\{reservation\.id\}`;/u);
  assert.match(source, /const paymentId = getReservationPaymentMutationId\(selectedReservation, selectedReservationPaymentSync\);/u);
  assert.match(source, /await patchPaymentStatus\(paymentId,\s*\{\s*status:\s*'paid'/u);
  assert.match(source, /refreshReservationsAfterMutation\(/u);
  assert.match(source, /void hydrateReservationDetail\(updatedReservation\.id,\s*updatedReservation\);/u);
});
