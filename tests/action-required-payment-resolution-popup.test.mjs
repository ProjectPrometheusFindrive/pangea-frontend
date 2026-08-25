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
  assert.match(source, /if \(isPaymentActionItem\(selectedItem\) && nextStatusCode === 'resolved'\) \{\s*setPaymentIssueResolveDialog\('choose-payment-resolution'\);/u);
  assert.match(source, /if \(nextStatusCode === 'resolved' && isPaymentActionItem\(item\)\) \{\s*setPaymentIssueResolveDialog\('choose-payment-resolution'\);/u);
  assert.match(source, /paymentIssueResolveDialog === 'choose-payment-resolution'/u);
  assert.match(source, /const isPaymentIssueResolved = isSelectedPaymentIssue\s*&& selectedItem\?\.statusCode === 'resolved';/u);
  assert.match(source, /const canEditPaymentIssueFields = canWritePayments && !isPaymentIssueResolved;/u);
  assert.match(source, /결제 완료 처리/u);
  assert.match(source, /결제 면제 처리/u);
  assert.match(source, /setPaymentIssueResolveDialog\(null\)/u);
});

test('payment issue card treats payment evidence as optional convenience attachment', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const billingSource = readProjectFile('src/services/billing.ts');

  assert.match(source, /const \[paymentEvidenceFile,\s*setPaymentEvidenceFile\] = useState<File \| null>\(null\);/u);
  assert.match(source, /folder: `rentals\/\$\{reservationId\}\/payments`/u);
  assert.match(source, /evidenceRefs,\s*memo: 'Action Required에서 수납 완료 처리'/u);
  assert.match(source, /증빙은 선택 사항이며 없어도 완료할 수 있습니다\./u);
  assert.match(billingSource, /evidenceRefs\?: PaymentEvidenceRef\[\];/u);
});

test('action required reservation navigation prefers reservation id when available', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /const reservationSearch = selectedItem\.reservationId \|\| selectedItem\.customerName;/u);
  assert.match(source, /reservationParam \|\| searchParam/u);
  assert.match(source, /\|\| \(item\.reservationId \?\? ''\)\.includes\(searchQuery\)/u);
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
