import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('new contract modal validates customer phone with the shared mobile format', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.ok(source.includes('const PHONE_REGEX = /^010-\\d{4}-\\d{4}$/;'));
  assert.ok(source.includes('const BUSINESS_NUMBER_REGEX = /^\\d{3}-\\d{2}-\\d{5}$/;'));
  assert.match(source, /!PHONE_REGEX\.test\(customerPhone\.trim\(\)\)/u);
  assert.match(source, /nextErrors\.customerPhone\s*=/u);
});

test('new contract modal splits long-term contractor, driver, and payer validation', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.match(source, /const \[contractorType, setContractorType\] = useState<'individual' \| 'corporate'>\('individual'\);/u);
  assert.match(source, /nextErrors\.contractorName = contractorType === 'corporate' \? '법인명을 입력해 주세요\.' : '계약자명을 입력해 주세요\.';/u);
  assert.match(source, /nextErrors\.contractorBusinessNumber = '사업자번호를 입력해 주세요\.';/u);
  assert.match(source, /BUSINESS_NUMBER_REGEX\.test\(contractorBusinessNumber\.trim\(\)\)/u);
  assert.match(source, /nextErrors\.contractorContactPhone = contractorType === 'corporate' \? '계약 담당자 연락처를 입력해 주세요\.' : '계약자 연락처를 입력해 주세요\.';/u);
  assert.match(source, /nextErrors\.customerName = rentalType === 'long_term' \? '실제 운전자명을 입력해 주세요\.' : '고객명을 입력해 주세요\.';/u);
  assert.match(source, /payerType: '청구 대상'/u);
});

test('new contract modal treats accident replacement driver fields as pre-pickup data', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.match(source, /const requiresDriverAtCreation = rentalType === 'short_term' \|\| \(rentalType === 'long_term' && contractorType === 'individual'\);/u);
  assert.match(source, /CONTACT_PHONE_REGEX/u);
  assert.match(source, /보험사 또는 사고접수번호 중 하나/u);
  assert.match(source, /보험사 또는 사고접수번호 중 하나는 필수입니다\./u);
  assert.match(source, /rentalType === 'accident_replacement' \? '고객 정보'/u);
  assert.match(source, /requestSource === 'repair_shop'/u);
  assert.match(source, /nextErrors\.repairShopLocation = '정비공장 주소를 입력해 주세요\.';/u);
  assert.match(source, /정비공장 주소 \{requestSource === 'repair_shop'/u);
  assert.match(source, /requestSource === 'insurer'/u);
  assert.match(source, /nextErrors\.adjusterPhone = '보험사 요청자 또는 담당자 연락처를 입력해 주세요\.';/u);
  assert.match(source, /requestSource === 'partner_platform'/u);
  assert.match(source, /nextErrors\.requesterOrganizationName = '요청 기관명을 입력해 주세요\.';/u);
  assert.match(source, /rentalType === 'short_term' &&/u);
});

test('new contract modal supports garage dropdown and inline garage creation', () => {
  const modalSource = readProjectFile('src/app/components/NewContractModal.tsx');
  const reservationsSource = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(modalSource, /export interface NewContractLocationOption/u);
  assert.match(modalSource, /onCreateLocationOption\?: \(payload: \{ name: string; address: string \}\) => Promise<NewContractLocationOption>/u);
  assert.match(modalSource, /<option value="__custom__">직접 입력<\/option>/u);
  assert.match(modalSource, /<option value="__new__">신규 차고지 등록<\/option>/u);
  assert.match(modalSource, /data-testid=\{`\$\{testId\}-select`\}/u);
  assert.match(modalSource, /selectedLocationOption\?\.address/u);
  assert.match(modalSource, /주소: \{selectedLocationOption\.address\}/u);
  assert.doesNotMatch(modalSource, /data-testid=\{testId\} className="mt-2 rounded-lg border/u);
  assert.match(modalSource, /차고지 목록은 설정 페이지의 차고지 탭에서 관리할 수 있습니다\./u);
  assert.match(modalSource, /data-testid="new-contract-garage-registration-modal"/u);
  assert.match(reservationsSource, /createSettingsGarage/u);
  assert.match(reservationsSource, /onCreateLocationOption=\{handleCreateNewContractGarage\}/u);
});

test('new contract modal no longer collects unsupported ssn input', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.doesNotMatch(source, /customerSSN/u);
  assert.doesNotMatch(source, /new-contract-customer-ssn-input/u);
});

test('new contract modal allows today as the rental start date', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.match(source, /min=\{formatDateAsYmd\(new Date\(\)\)\}/u);
  assert.match(source, /else if \(startDay < today\)/u);
  assert.doesNotMatch(source, /else if \(startAt < new Date\(\)\)/u);
});

test('new contract modal appends failing field details to the submit error summary', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.match(source, /function buildSubmitErrorMessage\(/u);
  assert.match(source, /return `\$\{baseMessage\} \$\{summary\}`;/u);
  assert.match(source, /setSubmitError\(buildSubmitErrorMessage\('필수 입력값을 확인해 주세요\.', nextErrors\)\);/u);
  assert.match(source, /setSubmitError\(buildSubmitErrorMessage\(feedback\.formError, feedback\.fieldErrors \?\? \{\}\)\);/u);
});

test('new contract modal submits optional short-term payment details without requiring them', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.match(source, /paymentDepositorName: '입금자명'/u);
  assert.match(source, /paymentApprovalNo: '승인번호'/u);
  assert.match(source, /paymentStatus === '완료' \|\| paymentStatus === '부분납부'/u);
  assert.match(source, /paymentDepositorName,/u);
  assert.match(source, /paymentApprovalNo,/u);
  assert.doesNotMatch(source, /nextErrors\.paymentDepositorName/u);
  assert.doesNotMatch(source, /nextErrors\.paymentApprovalNo/u);
});
