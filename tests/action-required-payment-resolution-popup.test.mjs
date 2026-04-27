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

test('payment issue done transitions are guided through paid/canceled popup', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /type PaymentIssueResolveDialogState = 'choose-payment-resolution' \| null;/u);
  assert.match(source, /if \(selectedItem\.type === '미납\/결제 문제'\) \{\s*setPaymentIssueResolveDialog\('choose-payment-resolution'\);/u);
  assert.match(source, /if \(nextStatusCode === 'resolved' && item\.type === '미납\/결제 문제'\) \{\s*setPaymentIssueResolveDialog\('choose-payment-resolution'\);/u);
  assert.match(source, /paymentIssueResolveDialog === 'choose-payment-resolution'/u);
  assert.match(source, /const isPaymentIssueResolved = selectedItem\?\.type === '미납\/결제 문제'[\s\S]*selectedItem\.statusCode === 'resolved';/u);
  assert.match(source, /const canEditPaymentIssueFields = canWritePayments && !isPaymentIssueResolved;/u);
  assert.match(source, /결제 완료 처리/u);
  assert.match(source, /결제 면제 처리/u);
  assert.match(source, /setPaymentIssueResolveDialog\(null\)/u);
});

test('payment issue card supports manual additional amount save via payments API', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /import \{ patchPaymentStatus \} from '\.\.\/\.\.\/services\/payments';/u);
  assert.match(source, /const \[paymentAmountDraft,\s*setPaymentAmountDraft\] = useState\(''\);/u);
  assert.match(source, /async function runPaymentAdditionalAmountSave\(item: ActionItem\): Promise<void>/u);
  assert.match(source, /await patchPaymentStatus\(paymentId,\s*\{\s*status:\s*'overdue'/u);
  assert.match(source, /additionalAmount:\s*amount,\s*force:\s*true,\s*forceReason:\s*'manual-additional-payment'/u);
  assert.match(source, /invalidatePaymentStatusCache\(\{\s*reservationId:\s*item\.reservationId \?\? item\.paymentInfo\?\.reservationId \?\? null,\s*paymentId,\s*\}\);/u);
  assert.match(source, /기존 미납 금액/u);
  assert.doesNotMatch(source, /연체료/u);
});
