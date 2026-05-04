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

test('Action Required payment and return flows use canonical policy fields', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /function isPaymentActionItem\(item: ActionItem \| null \| undefined\): item is ActionItem/u);
  assert.match(source, /item\.resolutionPolicy === 'requires_payment_settled'/u);
  assert.match(source, /String\(item\.issueCode \?\? ''\)\.startsWith\('payment\.'\)/u);
  assert.match(source, /function isLateReturnActionItem\(item: ActionItem \| null \| undefined\): item is ActionItem/u);
  assert.match(source, /item\.issueCode === 'return\.late'/u);
  assert.match(source, /if \(isPaymentActionItem\(selectedItem\) && nextStatusCode === 'resolved'\)/u);
  assert.match(source, /if \(nextStatusCode === 'resolved' && isLateReturnActionItem\(item\)\)/u);
});

test('rental accident follow-up uploads required evidence slots', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const service = readProjectFile('src/services/reservations.ts');

  for (const key of ['accidentPhotos', 'blackbox', 'opponentInfo', 'insuranceReceipt', 'repairEstimate']) {
    assert.match(source, new RegExp(key, 'u'));
  }
  assert.match(source, /rentalAccidentEvidenceFiles/u);
  assert.match(source, /folder: `rental-accidents\/\$\{selectedItem\.reservationId\}\/evidence\/\$\{slot\.key\}`/u);
  assert.match(source, /accidentEvidenceDocuments,/u);
  assert.match(service, /accidentEvidenceDocuments\?: Record<string, string>;/u);
});

test('operational issue cards expose canonical domain actions and resolution details', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const service = readProjectFile('src/services/actionRequired.ts');

  assert.match(service, /runActionRequiredDomainAction/u);
  assert.match(source, /const OPERATIONAL_DOMAIN_ACTIONS/u);
  assert.match(source, /'vehicle\.malfunction'/u);
  assert.match(source, /maintenance_completed/u);
  assert.match(source, /'vehicle\.terminal_off'/u);
  assert.match(source, /communication_confirmed/u);
  assert.match(source, /'vehicle\.theft_suspected'/u);
  assert.match(source, /vehicle_recovered/u);
  assert.match(source, /canUseOperationalDomainActions/u);
  assert.match(source, /writeError\.fields/u);
});

test('accident claim card stores payer account and difference memo fields', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const service = readProjectFile('src/services/accidentClaims.ts');

  assert.match(source, /billingAccount: ''/u);
  assert.match(source, /supplementMemo: ''/u);
  assert.match(source, /placeholder="보험사 청구 계정"/u);
  assert.match(source, /placeholder="차액\/분쟁 메모"/u);
  assert.match(source, /billingAccount: accidentClaimDraft\.billingAccount\.trim\(\)/u);
  assert.match(source, /supplementMemo: accidentClaimDraft\.supplementMemo\.trim\(\)/u);
  assert.match(service, /billingAccount\?: string;/u);
  assert.match(service, /supplementMemo\?: string;/u);
});
