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
  assert.match(source, /const canEditReservationPaymentFields = selectedReservation[\s\S]*canWritePayments[\s\S]*!hasSelectedReservationBillingLedger[\s\S]*canManageReservationPaymentIssue\(selectedReservation, selectedReservationPaymentSync\)/u);
  assert.match(source, /function resolveReservationAdditionalPaymentAmount\(/u);
  assert.doesNotMatch(source, /if \(paymentSnapshot\?\.status === 'paid' \|\| paymentSnapshot\?\.status === 'canceled'\) \{\s*return 0;\s*\}/u);
  assert.match(source, /export function canMarkReservationPaymentAsPaid\(/u);
  assert.match(source, /const effectiveStatus = paymentSnapshot\?\.status === 'not-found'/u);
  assert.match(source, /\?\s*toCanonicalPaymentStatus\(reservation\.paymentStatus\)/u);
  assert.match(source, /:\s*paymentSnapshot\?\.status \?\? toCanonicalPaymentStatus\(reservation\.paymentStatus\);/u);
  assert.match(source, /return effectiveStatus === 'pending' \|\| effectiveStatus === 'unpaid' \|\| effectiveStatus === 'partial';/u);
  assert.match(source, /if \(syncedPaymentStatus\.status === 'not-found' \|\| syncedPaymentStatus\.status === 'unknown'\) \{\s*return reservation;\s*\}/u);
  assert.match(source, /기존 미납 금액/u);
  assert.match(source, /추가 결제 금액/u);
  assert.match(source, /결제 유형/u);
  assert.match(source, /연체 일수/u);
  assert.match(source, /총 청구금액/u);
  assert.match(source, /기존 미납 .* 추가 결제 .* 계산 합계/u);
  assert.match(source, /원장 총액과 계산 합계가/u);
  assert.match(source, /className="bg-white rounded-xl w-\[700px\] max-h-\[80vh\] flex flex-col"/u);
  assert.match(source, /className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2"/u);
  assert.match(source, /className="w-32 rounded-lg border border-amber-300 bg-white px-2 py-1 text-right text-sm font-semibold text-amber-800/u);
  assert.match(source, /className="shrink-0 whitespace-nowrap rounded-md bg-amber-600/u);
  assert.match(source, /resolveReservationAdditionalPaymentAmount\(selectedReservation, selectedReservationPaymentSync\)/u);
  assert.match(source, /resolveReservationPrincipalPaymentAmount\(selectedReservation, selectedReservationPaymentSync\)/u);
  assert.match(source, /resolveReservationTotalPaymentAmount\(selectedReservation, selectedReservationPaymentSync\)/u);
  assert.match(source, /resolveReservationPaymentMethod\(selectedReservation, selectedReservationPaymentSync\)/u);
  assert.match(source, /canEditReservationPaymentFields && \(/u);
  assert.match(source, /data-testid="reservation-payment-complete-button"/u);
  assert.match(source, /결제 면제 처리/u);
});

test('reservation payment completion falls back to AUTO-PAY ids and refreshes list and detail state', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /export function getReservationPaymentMutationId\(/u);
  assert.match(source, /return paymentSnapshot\?\.paymentId\?\.trim\(\) \|\| `AUTO-PAY-\$\{reservation\.id\}`;/u);
  assert.match(source, /const paymentId = getReservationPaymentMutationId\(selectedReservation, selectedReservationPaymentSync\);/u);
  assert.match(source, /const handleUpdateReservationPaymentStatus = useCallback\(async \(\s*nextStatus: 'paid' \| 'canceled'/u);
  assert.match(source, /await patchPaymentStatus\(paymentId,\s*\{\s*status:\s*nextStatus/u);
  assert.match(source, /invalidatePaymentStatusCache\(\{\s*reservationId:\s*selectedReservation\.id,\s*paymentId,\s*\}\);/u);
  assert.match(source, /function applyCompletedPaymentToReservation/u);
  assert.match(source, /additionalPaymentAmount:\s*additionalAmount/u);
  assert.match(source, /const handleSaveAdditionalPaymentAmount = useCallback\(async \(\) => \{/u);
  assert.match(source, /if \(!canManageReservationPaymentIssue\(selectedReservation, selectedReservationPaymentSync\)\) \{\s*return;\s*\}/u);
  assert.match(source, /status:\s*'overdue'/u);
  assert.match(source, /force:\s*true/u);
  assert.match(source, /refreshReservationsAfterMutation\(/u);
  assert.match(source, /void hydrateReservationDetail\(updatedReservation\.id,\s*updatedReservation\);/u);
});

test('reservation detail payment mutations are gated by confirmation modal', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /type ReservationPaymentConfirmation/u);
  assert.match(source, /pendingReservationPaymentConfirmation/u);
  assert.match(source, /data-testid="reservation-payment-confirmation-modal"/u);
  assert.match(source, /openReservationPaymentStatusConfirmation\('paid'\)/u);
  assert.match(source, /openReservationPaymentStatusConfirmation\('canceled'\)/u);
  assert.match(source, /openSettleChargeItemConfirmation\(item\)/u);
  assert.match(source, /openPaymentRecordConfirmConfirmation\(record\)/u);
  assert.match(source, /openPaymentRecordVoidConfirmation\(record\)/u);
  assert.match(source, /openRefundChargeCreateConfirmation\(record\)/u);
  assert.match(source, /const handleConfirmReservationPaymentConfirmation = useCallback/u);
  assert.match(source, /await handleSettleChargeItem\(confirmation\.item\)/u);
});
