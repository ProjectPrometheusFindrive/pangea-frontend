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
  assert.match(source, /group: '위험 조치', tone: 'danger'/u);
  assert.match(source, /function groupOperationalDomainActions\(actions: OperationalDomainActionConfig\[\]\)/u);
  assert.match(source, /getOperationalDomainActionButtonClassName\(entry\.tone\)/u);
  assert.match(source, /canUseOperationalDomainActions/u);
  assert.match(source, /writeError\.fields/u);
});

test('accident claim card stores payer account and difference memo fields', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const service = readProjectFile('src/services/accidentClaims.ts');

  assert.match(source, /folder: `accident-claims\/\$\{reservationId\}\/\$\{folderName\}`/u);
  assert.match(source, /uploadAccidentClaimFiles\(reservationId, accidentApprovalDocumentFiles, 'approval-documents'\)/u);
  assert.match(source, /uploadAccidentClaimFiles\(reservationId, \[accidentClaimDocumentFile\], 'documents'\)/u);
  assert.match(source, /billingAccount: ''/u);
  assert.match(source, /supplementMemo: ''/u);
  assert.match(source, /placeholder="보험사 청구 계정"/u);
  assert.match(source, /placeholder="차액\/분쟁 메모"/u);
  assert.match(source, /billingAccount: accidentClaimDraft\.billingAccount\.trim\(\)/u);
  assert.match(source, /supplementMemo: accidentClaimDraft\.supplementMemo\.trim\(\)/u);
  assert.match(service, /billingAccount\?: string;/u);
  assert.match(service, /supplementMemo\?: string;/u);
});

test('accident replacement approval and driver-license card use the merged workflow', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const actionService = readProjectFile('src/services/actionRequired.ts');
  const claimService = readProjectFile('src/services/accidentClaims.ts');
  const taxonomy = readProjectFile('src/app/utils/actionItemTaxonomy.ts');

  assert.match(source, /accident_replacement_driver_license_required/u);
  assert.match(source, /운전자\/면허 정보/u);
  assert.match(source, /운전자\/면허 정보 저장/u);
  assert.match(source, /승인 근거 문서 선택/u);
  assert.match(source, /approvalDocumentObjectNames/u);
  assert.match(source, /setPreviewDocument/u);
  assert.match(actionService, /rejectActionRequiredAccidentApproval/u);
  assert.match(actionService, /accident-approval-rejection/u);
  assert.match(claimService, /approvalDocumentObjectNames\?: string\[\];/u);
  assert.match(taxonomy, /accident_replacement_driver_license_required: '운전자\/면허 정보 입력 필요'/u);
  assert.doesNotMatch(source, /placeholder="승인 문서 objectName"/u);
});

test('Action Required issue cards use action copy and app file picker UI', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const workContext = readProjectFile('src/app/pages/action-required/workContext.tsx');
  const backendActionItems = fs.readFileSync(path.resolve(projectRoot, '../backend/server/api/v2/action_items.py'), 'utf8');
  const backendTaxonomy = fs.readFileSync(path.resolve(projectRoot, '../backend/server/services/action_item_taxonomy.py'), 'utf8');

  assert.match(source, /function FilePickerCard/u);
  assert.match(source, /승인 반려로 저장하면 예약이 취소되고 관련 후속 이슈가 정리됩니다\./u);
  assert.match(source, /getAccidentClaimPanelTitle/u);
  assert.match(workContext, /currentSituation\?: string;/u);
  assert.match(workContext, /requiredAction\?: string;/u);
  assert.match(workContext, /completionCriteria\?: string;/u);
  assert.match(backendTaxonomy, /_WORK_GUIDANCE_BY_ISSUE_CODE/u);
  assert.match(backendActionItems, /"label": "완료 기준"/u);
  assert.doesNotMatch(source, /사고대차 보험청구/u);
  assert.doesNotMatch(source, /보험청구 정보'/u);
  assert.doesNotMatch(source, /className="block w-full text-sm text-gray-700"/u);
  assert.doesNotMatch(source, /className="block w-full text-xs text-gray-700"/u);
  assert.doesNotMatch(backendActionItems, /대차\/보험청구 이슈/u);
  assert.doesNotMatch(backendActionItems, /정산\/수납 이슈/u);
  assert.doesNotMatch(backendActionItems, /반납\/회수 이슈/u);
  assert.doesNotMatch(backendActionItems, /차량 의무관리 이슈/u);
});

test('Action Required work actions are scoped by issue detail type', () => {
  const workContext = readProjectFile('src/app/pages/action-required/workContext.tsx');
  const backendTaxonomy = fs.readFileSync(path.resolve(projectRoot, '../backend/server/services/action_item_taxonomy.py'), 'utf8');

  assert.match(backendTaxonomy, /_ACTIONS_BY_ISSUE_CODE/u);
  assert.match(backendTaxonomy, /"accident_claim\.driver_license_required": \["accident_claim_update", "memo_add", "status_update"\]/u);
  assert.match(backendTaxonomy, /"accident_claim\.submission_required": \["accident_claim_update", "accident_claim_submit", "memo_add", "status_update"\]/u);
  assert.match(backendTaxonomy, /"accident_claim\.settlement_required": \["accident_claim_update", "accident_claim_recognize", "memo_add", "status_update"\]/u);
  assert.match(backendTaxonomy, /"payment\.deposit_refund_due": \["refund_complete", "memo_add", "status_update"\]/u);
  assert.match(workContext, /WORK_CONTEXT_ACTIONS_BY_ISSUE_CODE/u);
  assert.match(workContext, /'accident_claim\.driver_license_required': new Set\(\['status_update'\]\)/u);
  assert.match(workContext, /'accident_claim\.submission_required': new Set\(\['status_update', 'accident_claim_submit'\]\)/u);
  assert.match(workContext, /'accident_claim\.settlement_required': new Set\(\['status_update', 'accident_claim_recognize'\]\)/u);
  assert.match(workContext, /'payment\.deposit_refund_due': new Set\(\['refund_complete', 'status_update'\]\)/u);
});

test('payment issue cards use compact settlement UI instead of repeated work context panels', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /function getPrimarySettlementCharge\(item: ActionItem\): ActionItemWorkChargeItem \| null/u);
  assert.match(source, /function getSettlementSummaryText\(item: ActionItem\): string/u);
  assert.match(source, /function getSettlementStatusLabel\(status: string \| undefined\): string \| null/u);
  assert.match(source, /!isPaymentActionItem\(selectedItem\)/u);
  assert.match(source, /현재 필요한 조치/u);
  assert.match(source, /selectedItem\.workContext\?\.module === 'payment_deposit_refund' \? '보증금 반환' : '정산 처리'/u);
  assert.match(source, /환불 완료 처리/u);
  assert.match(source, /결제 완료 처리/u);
  assert.match(source, /결제 면제 처리/u);
  assert.match(source, /추가 결제 금액 직접 수정/u);
  assert.doesNotMatch(source, /상태 \$\{charge\.status\}/u);
});

test('rental accident issue cards expose detail-type compact panels', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');
  const modal = readProjectFile('src/app/components/AccidentReportModal.tsx');
  const service = readProjectFile('src/services/reservations.ts');

  assert.match(source, /type RentalAccidentIssueMode = 'intake' \| 'evidence' \| 'insurance'/u);
  assert.match(source, /function getRentalAccidentIssueMode\(item: ActionItem \| null \| undefined\): RentalAccidentIssueMode/u);
  assert.match(source, /function getRentalAccidentPanelTitle\(mode: RentalAccidentIssueMode\): string/u);
  assert.match(source, /function getRentalAccidentSummaryText\(mode: RentalAccidentIssueMode\): string/u);
  assert.match(source, /function isRentalAccidentIssueCompleteForMode\(mode: RentalAccidentIssueMode, draft: RentalAccidentDraft\): boolean/u);
  assert.match(source, /function getRentalAccidentSaveButtonLabel\(mode: RentalAccidentIssueMode\): string/u);
  assert.match(source, /!isRentalAccidentActionItem\(selectedItem\)/u);
  assert.match(source, /사고 접수 정보 입력 필요/u);
  assert.match(source, /사고자료 준비 필요/u);
  assert.match(source, /보험처리 결과 확인 필요/u);
  assert.match(source, /사고자료 상태/u);
  assert.match(source, /보험처리 상태/u);
  assert.match(source, /사고 증빙 자료/u);
  assert.match(source, /사고 기본 정보/u);
  assert.match(source, /registrationDescription/u);
  assert.match(source, /최초 사고 등록 메모/u);
  assert.match(source, /buildFallbackDocumentDetail\(initialBlackboxObjectName, initialBlackboxFileName\)/u);
  assert.match(source, /actionItemId: selectedItem\.id/u);
  assert.match(source, /현재 단계 이력을 완료 처리/u);
  assert.doesNotMatch(source, /사고 후속 정보를 저장하고 이슈 완료를 시도했습니다/u);
  assert.match(source, /shouldShowRentalAccidentCustomerCharge/u);
  assert.match(modal, /blackboxFile\?: File \| null/u);
  assert.match(modal, /선택 항목입니다\. 최대 50MB/u);
  assert.match(modal, /max-h-\[calc\(100dvh-2rem\)\]/u);
  assert.match(modal, /flex-col overflow-hidden/u);
  assert.match(modal, /flex-1 space-y-4 overflow-y-auto/u);
  assert.match(modal, /flex shrink-0 items-center justify-end/u);
  assert.match(modal, /aria-label="사고 등록 닫기"/u);
  assert.match(modal, /event\.key === 'Escape'/u);
  assert.doesNotMatch(modal, /블랙박스 첨부는 필수입니다\./u);
  assert.doesNotMatch(modal, /담당자를 선택해 주세요\./u);
  assert.match(service, /blackboxFileName\?: string/u);
  assert.match(service, /accidentType\?: string/u);
  assert.match(service, /actionItemId\?: string;/u);
  assert.doesNotMatch(source, /type RentalAccidentIssueMode = 'reported' \| 'evidence' \| 'insurance'/u);
});

test('reservation detail exposes accident processing tab only for accident reports', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');
  const types = readProjectFile('src/app/types/reservations.ts');

  assert.match(source, /'reservation' \| 'payment' \| 'vehicle' \| 'accident'/u);
  assert.match(source, /hasSelectedReservationAccidentReport && \(/u);
  assert.match(source, /사고 처리/u);
  assert.match(source, /activeTab === 'accident' && selectedReservationAccidentReport/u);
  assert.match(source, /최초 사고 등록 메모/u);
  assert.match(source, /사고 증빙 자료/u);
  assert.match(source, /selectedReservationAccidentBlackboxObjectName/u);
  assert.match(source, /handleOpenReservationDocument\(objectName\)/u);
  assert.match(types, /accidentEvidenceDocuments\?: Record<string, string>;/u);
  assert.match(types, /accidentEvidenceDocumentDetails\?: Record<string,/u);
});

test('accident claim issue cards expose stage-specific compact panels', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /type AccidentClaimIssueMode = 'intake' \| 'submission' \| 'settlement' \| 'payment' \| 'difference' \| 'other'/u);
  assert.match(source, /type SettlementPaymentCheckStatus = 'required' \| 'completed' \| 'waiting' \| 'not_applicable'/u);
  assert.match(source, /type SettlementDifferenceStatus = 'required' \| 'settled' \| 'not_applicable'/u);
  assert.match(source, /function getAccidentClaimIssueMode\(item: ActionItem \| null \| undefined\): AccidentClaimIssueMode/u);
  assert.match(source, /function isCompactAccidentClaimActionItem\(item: ActionItem \| null \| undefined\): item is ActionItem/u);
  assert.match(source, /function getAccidentClaimSummaryText\(mode: AccidentClaimIssueMode\): string/u);
  assert.match(source, /function getAccidentClaimDifferenceAmount\(draft: AccidentClaimDraft\): number/u);
  assert.match(source, /function normalizeSettlementPaymentCheckStatus\(item: ActionItem\): SettlementPaymentCheckStatus/u);
  assert.match(source, /function DifferencePayerRadioCards/u);
  assert.match(source, /documentStatus: string;/u);
  assert.match(source, /claimStatus: string;/u);
  assert.match(source, /submittedAt: string;/u);
  assert.match(source, /!isCompactAccidentClaimActionItem\(selectedItem\)/u);
  assert.match(source, /추가 접수 정보/u);
  assert.match(source, /청구금액 및 차액 정보/u);
  assert.match(source, /청구 제출 지연/u);
  assert.match(source, /claim_preparing/u);
  assert.match(source, /청구 준비 중/u);
  assert.match(source, /ready_to_claim/u);
  assert.match(source, /제출 가능/u);
  assert.match(source, /partial_recognized/u);
  assert.match(source, /일부 인정/u);
  assert.match(source, /선택된 파일 없음/u);
  assert.match(source, /저장된 청구 서류/u);
  assert.match(source, /미제출/u);
  assert.match(source, /보험사에 청구 제출 처리/u);
  assert.match(source, /제출하면 청구 상태가 진행 중으로 변경됩니다\./u);
  assert.match(source, /정리할 차액/u);
  assert.match(source, /정산 체크리스트/u);
  assert.match(source, /보험금 입금 상태와 대차료 차액 정산 상태를 확인하세요\./u);
  assert.match(source, /보험 인정금액/u);
  assert.match(source, /차액 처리 방식/u);
  assert.match(source, /고객에게 청구/u);
  assert.match(source, /보험사에 재청구/u);
  assert.match(source, /차액 면제 처리/u);
  assert.match(source, /보험 인정금액 입력 후 차액 처리 방식을 선택할 수 있습니다\./u);
  assert.doesNotMatch(source, /보험금 입금 확인 완료\/대상 아님/u);
  assert.doesNotMatch(source, /보험금 입금 여부와 대차료 차액 정리 상태를 한 카드에서 확인합니다\./u);
  assert.doesNotMatch(source, /자산 페이지로 이동/u);
  assert.doesNotMatch(source, /예약 페이지로 이동/u);
});

test('remaining review 05 issue cards expose repair-return and theft-risk hierarchy', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /function isRepairDoneNotReturnedActionItem\(item: ActionItem \| null \| undefined\): item is ActionItem/u);
  assert.match(source, /item\.issueCode === 'return\.followup_required'/u);
  assert.match(source, /item\.reasonType === 'accident_replacement_repair_done_not_returned'/u);
  assert.match(source, /function getRepairDoneNotReturnedSummary\(item: ActionItem\)/u);
  assert.match(source, /!isReturnFollowupActionItem\(selectedItem\)/u);
  assert.match(source, /차량 반납\/회수 확인/u);
  assert.match(source, /수리완료일/u);
  assert.match(source, /정비소/u);
  assert.match(source, /반납 완료 처리/u);
  assert.match(source, /수리완료 후 대차 차량이 반납되었습니까\?/u);
  assert.match(source, /위험 조치/u);
  assert.match(source, /신고 처리/u);
  assert.match(source, /차량 회수/u);
});

test('action required detail-type filters hide taxonomy candidates without dedicated implementation', () => {
  const taxonomy = readProjectFile('src/app/utils/actionItemTaxonomy.ts');
  const filterSource = taxonomy.match(/export const ACTION_SUBCATEGORIES_BY_CATEGORY[\s\S]*?;\n/u)?.[0] ?? '';

  for (const hiddenOption of [
    '선금 확인',
    '잔금 미수',
    '인수 전 결제 확인',
    '장기연체 회수 검토',
    '사고대차 접수',
    '보험 담당자 확인',
  ]) {
    assert.doesNotMatch(filterSource, new RegExp(hiddenOption, 'u'));
  }

  for (const visibleOption of [
    '월 렌트료 납부 예정',
    '월 렌트료 연체',
    '추가요금 미수',
    '차량 반납\/회수 확인',
    '종료 정산 필요',
    '사고정보 입력 필요',
    '보험청구 제출\/보완',
    '보험금 정산 확인',
  ]) {
    assert.match(filterSource, new RegExp(visibleOption, 'u'));
  }
});
