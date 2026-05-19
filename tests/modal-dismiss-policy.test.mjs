import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('common modal dismiss hook gates Escape and backdrop dismissal', () => {
  const source = readProjectFile('src/app/hooks/useModalDismiss.ts');

  assert.match(source, /export function useModalDismiss/u);
  assert.match(source, /closeOnEscape = true/u);
  assert.match(source, /closeOnBackdrop = true/u);
  assert.match(source, /event\.key === 'Escape'/u);
  assert.match(source, /event\.target !== event\.currentTarget/u);
  assert.match(source, /disabled/u);
});

test('primary reservation modals use the shared dismiss policy', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /import \{ useModalDismiss \} from '\.\.\/hooks\/useModalDismiss';/u);
  assert.match(source, /handleReservationDetailBackdropMouseDown/u);
  assert.match(source, /handleDragConflictBackdropMouseDown/u);
  assert.match(source, /handleCancelReservationBackdropMouseDown/u);
  assert.match(source, /handleReturnConfirmBackdropMouseDown/u);
  assert.match(source, /data-testid="reservation-detail-modal"[^>]+onMouseDown=\{handleReservationDetailBackdropMouseDown\}/u);
  assert.match(source, /data-testid="reservation-return-confirm-modal"[^>]+onMouseDown=\{handleReturnConfirmBackdropMouseDown\}/u);
});

test('asset and contract modals preserve dirty or saving guards while adding dismiss shortcuts', () => {
  const assetsSource = readProjectFile('src/app/pages/Assets.tsx');
  const vehicleDetailSource = readProjectFile('src/app/components/VehicleDetailModal.tsx');
  const newContractSource = readProjectFile('src/app/components/NewContractModal.tsx');
  const accidentSource = readProjectFile('src/app/components/AccidentReportModal.tsx');

  assert.match(assetsSource, /handleCreateModalBackdropMouseDown/u);
  assert.match(vehicleDetailSource, /disabled: isSaving \|\| isDeleting/u);
  assert.match(newContractSource, /const isMainModalDirty = useMemo/u);
  assert.match(newContractSource, /입력 중인 계약 정보가 있습니다\. 닫으시겠습니까\?/u);
  assert.match(newContractSource, /입력 중인 차고지 정보가 있습니다\. 닫으시겠습니까\?/u);
  assert.match(newContractSource, /activeLocationRegistrationTarget !== null \|\| pendingDriverRemovalIndex !== null/u);
  assert.match(accidentSource, /입력 중인 사고 접수 정보가 있습니다\. 닫으시겠습니까\?/u);
  assert.match(accidentSource, /onMouseDown=\{handleBackdropMouseDown\}/u);
});

test('action required confirmation modals use Escape and backdrop dismissal consistently', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /handleActionDetailBackdropMouseDown/u);
  assert.match(source, /const isActionDetailDismissBlocked = \(/u);
  assert.match(source, /isOpen: Boolean\(selectedItem\),[\s\S]*onDismiss: handleCloseDetail,[\s\S]*disabled: isActionDetailDismissBlocked/u);
  assert.match(source, /relatedContextKind !== null[\s\S]*Boolean\(issueAssetPrompt\)[\s\S]*lateReturnResolveDialog !== null[\s\S]*Boolean\(pendingPaymentConfirmation\)[\s\S]*paymentIssueResolveDialog !== null[\s\S]*accidentApprovalRejectConfirmOpen[\s\S]*Boolean\(previewDocument\)/u);
  assert.match(source, /fixed inset-0 z-50 flex justify-end bg-black\/20" onMouseDown=\{handleActionDetailBackdropMouseDown\}/u);
  assert.match(source, /handleLateReturnResolveBackdropMouseDown/u);
  assert.match(source, /handlePendingPaymentConfirmationBackdropMouseDown/u);
  assert.match(source, /handlePaymentResolutionBackdropMouseDown/u);
  assert.match(source, /handleAccidentRejectBackdropMouseDown/u);
  assert.match(source, /handlePreviewDocumentBackdropMouseDown/u);
  assert.match(source, /onMouseDown=\{handlePendingPaymentConfirmationBackdropMouseDown\}/u);
  assert.match(source, /onMouseDown=\{handlePaymentResolutionBackdropMouseDown\}/u);
});
