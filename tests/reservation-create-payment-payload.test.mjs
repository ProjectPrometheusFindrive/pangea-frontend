import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('reservation service payload type exposes structured payment fields', () => {
  const source = readProjectFile('src/services/reservations.ts');

  assert.match(source, /reservationId\?: string;/u);
  assert.match(source, /idempotencyKey\?: string;/u);
  assert.match(source, /export interface ReservationPartiesPayload/u);
  assert.match(source, /parties\?: ReservationPartiesPayload;/u);
  assert.match(source, /creationMode\?: 'ui_confirmed' \| 'external_intake' \| 'migration';/u);
  assert.match(source, /amount\?: number;/u);
  assert.match(source, /deposit\?: number;/u);
  assert.match(source, /paymentRecord\?: \{/u);
  assert.match(source, /depositorName\?: string;/u);
  assert.match(source, /approvalNo\?: string;/u);
  assert.match(source, /contractDocumentObjectName\?: string;/u);
});

test('reservation create flow sends ui confirmed documents and short-term payment fields', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /prepareReservationCreation\(\{ idempotencyKey \}\)/u);
  assert.match(source, /creationMode: 'ui_confirmed',/u);
  assert.match(source, /uploadReservationCreationDocument\(formValues\.licenseFile, reservationId\)/u);
  assert.match(source, /parties,/u);
  assert.doesNotMatch(source, /R-\$\{Date\.now\(\)\}-\$\{Math\.floor\(Math\.random\(\) \* 1000\)/u);
  assert.match(source, /initialBilling: usesInitialBilling/u);
  assert.match(source, /paymentRecord: initialBillingPaymentAmount > 0/u);
  assert.match(source, /payerType: 'customer',/u);
  assert.match(source, /depositorName: formValues\.paymentDepositorName\.trim\(\) \|\| undefined,/u);
  assert.match(source, /approvalNo: formValues\.paymentApprovalNo\.trim\(\) \|\| undefined,/u);
  assert.doesNotMatch(source, /paymentMethod: usesLegacyPayment/u);
});

test('reservation create flow sends long-term contractor and billing payer type', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');
  const serviceSource = readProjectFile('src/services/reservations.ts');

  assert.match(source, /const longTermPayerType = formValues\.contractorType === 'corporate' \? formValues\.payerType : 'customer';/u);
  assert.match(source, /type: formValues\.contractorType,/u);
  assert.match(source, /businessNumber: formValues\.contractorType === 'corporate'/u);
  assert.match(source, /contactName: formValues\.contractorContactName\.trim\(\) \|\| undefined,/u);
  assert.match(source, /type: longTermPayerType,/u);
  assert.match(source, /billingAccount: formValues\.billingAccount\.trim\(\) \|\| undefined,/u);
  assert.match(source, /payerType: formValues\.rentalType === 'long_term' \? longTermPayerType : undefined,/u);
  assert.match(source, /payerType: longTermPayerType,/u);
  assert.match(serviceSource, /payerType\?: 'customer' \| 'insurer' \| 'corporate' \| 'repair_shop';/u);
});

test('reservation payment records expose optional evidence references', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');
  const typeSource = readProjectFile('src/app/types/reservations.ts');
  const billingSource = readProjectFile('src/services/billing.ts');

  assert.match(typeSource, /evidenceRefs\?: Array<\{/u);
  assert.match(typeSource, /changeHistory\?: BillingChangeHistoryEntry\[\];/u);
  assert.match(source, /const evidenceRefs = Array\.isArray\(row\.evidenceRefs\)/u);
  assert.match(source, /selectedReservationPaymentRecords/u);
  assert.match(source, /선택 첨부 없음/u);
  assert.match(source, /handleOpenPaymentEvidence/u);
  assert.match(source, /handleVoidPaymentRecord/u);
  assert.match(source, /handleCreateRefundChargeItem/u);
  assert.match(billingSource, /export function getBillingLedger/u);
  assert.match(billingSource, /export function getBillingLedgerCsv/u);
  assert.match(billingSource, /export function getUploadDownloadUrl/u);
});

test('reservation detail exposes document checklist badges', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');
  const typeSource = readProjectFile('src/app/types/reservations.ts');

  assert.match(typeSource, /export interface ReservationDocumentChecklistItem/u);
  assert.match(typeSource, /documentChecklist\?: ReservationDocumentChecklistItem\[\];/u);
  assert.match(source, /toReservationDocumentChecklist\(row\.documentChecklist\)/u);
  assert.match(source, /렌트 유형별 필수\/선택 문서/u);
  assert.match(source, /reservationDocumentStatusLabel\(item\.status\)/u);
  assert.match(source, /인수 전 필요/u);
  assert.match(source, /조치 필요/u);
});

test('reservation detail exposes charge history diff and refund completion actions', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');
  const typeSource = readProjectFile('src/app/types/reservations.ts');
  const billingSource = readProjectFile('src/services/billing.ts');

  assert.match(typeSource, /refundCompletedAt\?: string;/u);
  assert.match(typeSource, /refundReason\?: string;/u);
  assert.match(billingSource, /refundCompletedAt\?: string;/u);
  assert.match(source, /formatBillingChangeSummary\(entry\.changes\)/u);
  assert.match(source, /handleCompleteRefundChargeItem/u);
  assert.match(source, /handleWaiveRefundChargeItem/u);
  assert.match(source, /환불완료/u);
  assert.match(source, /환불면제/u);
  assert.match(source, /status: 'paid'/u);
  assert.match(source, /status: 'waived'/u);
});

test('reservation search includes reservation, party, claim, and payer fields', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /reservation\.id/u);
  assert.match(source, /reservation\.phone/u);
  assert.match(source, /parties\.driver\?\.licenseNumber/u);
  assert.match(source, /parties\.contractor\?\.organizationName/u);
  assert.match(source, /parties\.payer\?\.insurerName/u);
  assert.match(source, /accidentClaim\?\.repairShopName/u);
  assert.match(source, /accidentClaim\?\.requesterOrganizationName/u);
});

test('action required domain action response exposes domain update summary', () => {
  const serviceSource = readProjectFile('src/services/actionRequired.ts');

  assert.match(serviceSource, /export interface ActionRequiredDomainUpdateSummary/u);
  assert.match(serviceSource, /domainUpdate\?: ActionRequiredDomainUpdateSummary \| null;/u);
  assert.match(serviceSource, /apiClient\.requestData<ActionRequiredDomainActionResult>/u);
});

test('revenue page exposes settlement ledger tab and csv download', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  assert.match(source, /type RevenueTab = 'summary' \| 'ledger';/u);
  assert.match(source, /정산 원장/u);
  assert.match(source, /getBillingLedger\(/u);
  assert.match(source, /getBillingLedgerCsv\(/u);
  assert.match(source, /CSV 다운로드/u);
  assert.match(source, /조회 기간에 정산 원장 데이터가 없습니다/u);
});

test('revenue page consumes backend rental and payer type breakdowns', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');
  const serviceSource = readProjectFile('src/services/revenue.ts');

  assert.match(serviceSource, /rentalTypes: RevenueRentalTypeBreakdown\[\];/u);
  assert.match(serviceSource, /payerTypes: RevenuePayerTypeBreakdown\[\];/u);
  assert.match(source, /summaryRentalTypes/u);
  assert.match(source, /summaryPayerTypes/u);
  assert.match(source, /렌트 유형별 매출/u);
  assert.match(source, /청구 주체별 매출/u);
});
