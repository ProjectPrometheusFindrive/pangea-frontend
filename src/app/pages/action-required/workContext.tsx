export type WorkChecklistStatus = 'done' | 'required' | 'blocked' | 'optional';

export type IssueWorkModuleKey =
  | 'payment_additional_fee'
  | 'payment_deposit_refund'
  | 'payment_monthly'
  | 'return_late'
  | 'return_closeout'
  | 'rental_accident_followup'
  | 'accident_claim_intake'
  | 'accident_claim_approval'
  | 'accident_claim_submission'
  | 'asset_compliance'
  | 'vehicle_ops'
  | 'fallback';

export interface ActionItemWorkChecklistItem {
  key: string;
  label: string;
  status: WorkChecklistStatus;
  message?: string;
  value?: unknown;
}

export interface ActionItemWorkAction {
  key: string;
  label: string;
  intent: 'save' | 'submit' | 'resolve' | 'waive' | 'upload' | 'domain_action';
  target?: Record<string, unknown>;
  disabledReason?: string;
}

export interface WorkContextSummary {
  situation: string;
  nextAction: string;
  completion: string;
}

export interface ActionItemWorkContext {
  issueCode: string;
  module: IssueWorkModuleKey;
  title: string;
  outcome: string;
  entityRefs: Record<string, unknown>;
  sourceSnapshot: Record<string, unknown>;
  checklist: ActionItemWorkChecklistItem[];
  actions: ActionItemWorkAction[];
}

export interface ActionItemWorkChargeItem {
  id: string;
  chargeType?: string;
  description?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status?: string;
  payerType?: string;
  dueDate?: string;
  refundReason?: string;
}

const ISSUE_WORK_MODULE_LABELS: Record<IssueWorkModuleKey, string> = {
  payment_additional_fee: '추가요금 수납',
  payment_deposit_refund: '보증금 반환',
  payment_monthly: '월/미납 정산',
  return_late: '반납 지연',
  return_closeout: '종료 정산',
  rental_accident_followup: '대여 중 사고',
  accident_claim_intake: '보험청구 접수',
  accident_claim_approval: '대차 승인',
  accident_claim_submission: '보험청구 진행',
  asset_compliance: '차량 의무관리',
  vehicle_ops: '차량 운영 조치',
  fallback: '수동 조치',
};

const ISSUE_WORK_MODULE_REGISTRY: Record<IssueWorkModuleKey, { label: string; accentClassName: string }> = {
  payment_additional_fee: { label: ISSUE_WORK_MODULE_LABELS.payment_additional_fee, accentClassName: 'border-red-200 bg-red-50' },
  payment_deposit_refund: { label: ISSUE_WORK_MODULE_LABELS.payment_deposit_refund, accentClassName: 'border-emerald-200 bg-emerald-50' },
  payment_monthly: { label: ISSUE_WORK_MODULE_LABELS.payment_monthly, accentClassName: 'border-red-200 bg-red-50' },
  return_late: { label: ISSUE_WORK_MODULE_LABELS.return_late, accentClassName: 'border-amber-200 bg-amber-50' },
  return_closeout: { label: ISSUE_WORK_MODULE_LABELS.return_closeout, accentClassName: 'border-amber-200 bg-amber-50' },
  rental_accident_followup: { label: ISSUE_WORK_MODULE_LABELS.rental_accident_followup, accentClassName: 'border-orange-200 bg-orange-50' },
  accident_claim_intake: { label: ISSUE_WORK_MODULE_LABELS.accident_claim_intake, accentClassName: 'border-blue-200 bg-blue-50' },
  accident_claim_approval: { label: ISSUE_WORK_MODULE_LABELS.accident_claim_approval, accentClassName: 'border-blue-200 bg-blue-50' },
  accident_claim_submission: { label: ISSUE_WORK_MODULE_LABELS.accident_claim_submission, accentClassName: 'border-blue-200 bg-blue-50' },
  asset_compliance: { label: ISSUE_WORK_MODULE_LABELS.asset_compliance, accentClassName: 'border-green-200 bg-green-50' },
  vehicle_ops: { label: ISSUE_WORK_MODULE_LABELS.vehicle_ops, accentClassName: 'border-slate-200 bg-slate-50' },
  fallback: { label: ISSUE_WORK_MODULE_LABELS.fallback, accentClassName: 'border-gray-200 bg-gray-50' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function normalizeWorkModuleKey(value: unknown): IssueWorkModuleKey {
  const normalized = toStringValue(value);
  if (normalized && normalized in ISSUE_WORK_MODULE_REGISTRY) {
    return normalized as IssueWorkModuleKey;
  }
  return 'fallback';
}

function normalizeChecklistStatus(value: unknown): WorkChecklistStatus {
  const normalized = toStringValue(value);
  if (normalized === 'done' || normalized === 'required' || normalized === 'blocked' || normalized === 'optional') {
    return normalized;
  }
  return 'optional';
}

function toWorkChecklistItems(value: unknown): ActionItemWorkChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }
    const key = pickString(item, ['key']) ?? `check-${index + 1}`;
    const label = pickString(item, ['label', 'key']) ?? key;
    return [{
      key,
      label,
      status: normalizeChecklistStatus(item.status),
      message: pickString(item, ['message']) ?? undefined,
      value: item.value,
    }];
  });
}

function toWorkActions(value: unknown): ActionItemWorkAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const key = pickString(item, ['key']);
    if (!key) {
      return [];
    }
    const intent = pickString(item, ['intent']);
    return [{
      key,
      label: pickString(item, ['label']) ?? key,
      intent: (
        intent === 'save'
        || intent === 'submit'
        || intent === 'resolve'
        || intent === 'waive'
        || intent === 'upload'
        || intent === 'domain_action'
      ) ? intent : 'save',
      target: isRecord(item.target) ? item.target : undefined,
      disabledReason: pickString(item, ['disabledReason']) ?? undefined,
    }];
  });
}

export function toWorkContext(source: Record<string, unknown>): ActionItemWorkContext | undefined {
  if (!isRecord(source.workContext)) {
    return undefined;
  }
  const workSource = source.workContext;
  const issueCode = pickString(workSource, ['issueCode']) ?? pickString(source, ['issueCode']) ?? '';
  const module = normalizeWorkModuleKey(workSource.module);
  return {
    issueCode,
    module,
    title: pickString(workSource, ['title']) ?? ISSUE_WORK_MODULE_REGISTRY[module].label,
    outcome: pickString(workSource, ['outcome']) ?? '',
    entityRefs: isRecord(workSource.entityRefs) ? workSource.entityRefs : {},
    sourceSnapshot: isRecord(workSource.sourceSnapshot) ? workSource.sourceSnapshot : {},
    checklist: toWorkChecklistItems(workSource.checklist),
    actions: toWorkActions(workSource.actions),
  };
}

export function toWorkChargeItems(workContext: ActionItemWorkContext | undefined): ActionItemWorkChargeItem[] {
  const sourceSnapshot = workContext?.sourceSnapshot;
  if (!sourceSnapshot || !Array.isArray(sourceSnapshot.chargeItems)) {
    return [];
  }
  return sourceSnapshot.chargeItems.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const id = pickString(item, ['id']);
    if (!id) {
      return [];
    }
    return [{
      id,
      chargeType: pickString(item, ['chargeType']) ?? undefined,
      description: pickString(item, ['description', 'memo']) ?? undefined,
      amount: toNumberValue(item.amount) ?? 0,
      paidAmount: toNumberValue(item.paidAmount) ?? 0,
      remainingAmount: toNumberValue(item.remainingAmount) ?? 0,
      status: pickString(item, ['status']) ?? undefined,
      payerType: pickString(item, ['payerType']) ?? undefined,
      dueDate: pickString(item, ['dueDate']) ?? undefined,
      refundReason: pickString(item, ['refundReason']) ?? undefined,
    }];
  });
}

export function isRefundChargeItem(charge: ActionItemWorkChargeItem): boolean {
  return charge.chargeType === 'refund' || charge.status === 'refund_due' || charge.refundReason === 'deposit_refund';
}

export function isWorkChargeSettled(charge: ActionItemWorkChargeItem): boolean {
  if (['paid', 'waived', 'refunded'].includes(charge.status ?? '')) {
    return true;
  }
  if (charge.status === 'disputed') {
    return true;
  }
  return charge.remainingAmount <= 0;
}

function formatWorkContextValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

const RAW_FIELD_LABELS = new Set([
  'relatedChargeItemId',
  'relatedChargeItemIds',
  'remainingAmount',
  'contractStatus',
  'documentStatus',
  'approvalStatus',
  'approvalDocumentObjectName',
  'claimStatus',
  'insuranceDocObjectName',
  'inspectionDocObjectName',
]);

const ACTIONS_RENDERED_ELSEWHERE = new Set([
  'memo_add',
  'additional_charge_create',
  'accident_claim_update',
  'accident_followup_update',
  'asset_update',
  'asset_document_upload',
]);

const WORK_CONTEXT_PANEL_ACTIONS = new Set([
  'payment_record_create',
  'payment_waive',
  'refund_complete',
  'closeout_settle',
  'return_reservation',
  'status_update',
  'accident_claim_submit',
  'accident_claim_recognize',
]);

const DOMAIN_ACTION_KEYS = new Set([
  'maintenance_requested',
  'maintenance_completed',
  'diagnostic_resolved',
  'communication_confirmed',
  'terminal_checked',
  'terminal_replaced',
  'customer_contacted',
  'false_alarm',
  'reported_to_authority',
  'vehicle_recovered',
]);

function getWorkChecklistStatusClassName(status: WorkChecklistStatus): string {
  if (status === 'done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (status === 'required') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600';
}

function getWorkChecklistStatusLabel(status: WorkChecklistStatus): string {
  if (status === 'done') {
    return '완료';
  }
  if (status === 'blocked') {
    return '먼저 처리 필요';
  }
  if (status === 'required') {
    return '처리 필요';
  }
  return '선택';
}

function getChargeTypeLabel(value: string | undefined, isRefund: boolean): string {
  if (isRefund) {
    return '환불 항목';
  }
  switch (value) {
    case 'additional_fee':
      return '추가요금';
    case 'late_fee':
      return '지연료';
    case 'monthly_fee':
      return '월 렌트료';
    case 'deductible':
      return '고객부담금';
    case 'difference':
      return '대차료 차액';
    case 'rental_fee':
      return '대여료';
    default:
      return value || '청구 항목';
  }
}

function getChargeStatusLabel(value: string | undefined): string {
  switch (value) {
    case 'paid':
      return '수납 완료';
    case 'waived':
      return '면제';
    case 'refunded':
      return '환불 완료';
    case 'refund_due':
      return '환불 필요';
    case 'overdue':
      return '연체';
    case 'partial':
      return '일부 정리';
    case 'pending':
      return '처리 대기';
    case 'scheduled':
      return '예정';
    case 'disputed':
      return '분쟁/보류';
    default:
      return value || '-';
  }
}

function getPayerTypeLabel(value: string | undefined): string | null {
  switch (value) {
    case 'customer':
      return '고객 부담';
    case 'insurer':
      return '보험사 부담';
    case 'company':
      return '자사 부담';
    case 'partner_platform':
      return '제휴사 부담';
    case 'repair_shop':
      return '정비소 부담';
    default:
      return value || null;
  }
}

function getWorkActionGuide(module: IssueWorkModuleKey, chargeItems: ActionItemWorkChargeItem[]): string {
  const unsettledCount = chargeItems.filter((charge) => !isWorkChargeSettled(charge)).length;
  switch (module) {
    case 'payment_deposit_refund':
      return '환불 금액과 증빙을 확인한 뒤 환불 완료 처리하세요.';
    case 'return_closeout':
      return unsettledCount > 0
        ? `미정리 청구/환불 항목 ${unsettledCount}건을 모두 정리해야 완료할 수 있습니다.`
        : '모든 정산 항목이 정리되었습니다. 이슈 완료 처리를 진행할 수 있습니다.';
    case 'payment_additional_fee':
    case 'payment_monthly':
      return '미수 금액을 수납하거나 면제 처리한 뒤 완료 상태를 확인하세요.';
    case 'return_late':
      return '실제 반납 여부를 확인하고 반납 완료 처리를 진행하세요.';
    case 'rental_accident_followup':
      return '사고 정보와 증빙, 보험처리 상태를 보완한 뒤 저장하세요.';
    case 'accident_claim_approval':
      return '대차 승인 상태와 승인 근거를 확인하고 저장하세요.';
    case 'accident_claim_submission':
      return '보험청구 제출, 보험금 인정, 차액 정리 중 현재 필요한 단계를 처리하세요.';
    case 'accident_claim_intake':
      return '보험청구 기본 정보를 입력해 청구 진행이 가능하도록 만드세요.';
    case 'asset_compliance':
      return '만료일 또는 점검일과 증빙 문서를 갱신하세요.';
    case 'vehicle_ops':
      return '차량 상태를 확인하고 필요한 운영 조치를 실행하세요.';
    default:
      return '필요한 정보를 확인한 뒤 메모 또는 상태 변경으로 처리하세요.';
  }
}

function shouldShowChecklistValue(item: ActionItemWorkChecklistItem): boolean {
  const value = formatWorkContextValue(item.value);
  if (!value) {
    return false;
  }
  return !RAW_FIELD_LABELS.has(item.label)
    && !RAW_FIELD_LABELS.has(item.key)
    && !/id$/i.test(item.key)
    && !item.key.includes('ChargeItem');
}

function shouldShowChecklistItem(item: ActionItemWorkChecklistItem): boolean {
  return !item.key.startsWith('source.')
    && !RAW_FIELD_LABELS.has(item.key)
    && !RAW_FIELD_LABELS.has(item.label);
}

function shouldRenderWorkAction(action: ActionItemWorkAction): boolean {
  if (ACTIONS_RENDERED_ELSEWHERE.has(action.key)) {
    return false;
  }
  return WORK_CONTEXT_PANEL_ACTIONS.has(action.key) || DOMAIN_ACTION_KEYS.has(action.key);
}

export function getWorkContextSummary(workContext: ActionItemWorkContext): WorkContextSummary {
  const chargeItems = toWorkChargeItems(workContext);
  const unsettledCount = chargeItems.filter((charge) => !isWorkChargeSettled(charge)).length;
  const defaultCompletion = unsettledCount > 0
    ? `미정리 항목 ${unsettledCount}건을 정리해야 완료할 수 있습니다.`
    : '완료 전 확인사항이 해소되면 이슈 완료 처리를 진행할 수 있습니다.';

  switch (workContext.module) {
    case 'payment_deposit_refund':
      return {
        situation: workContext.outcome || '보증금 반환 대상이 남아 있습니다.',
        nextAction: '환불 금액, 환불 수단, 환불일과 증빙을 확인한 뒤 환불 완료 처리하세요.',
        completion: unsettledCount > 0 ? '연결된 환불 항목이 환불 완료 또는 면제 상태가 되어야 합니다.' : defaultCompletion,
      };
    case 'payment_additional_fee':
    case 'payment_monthly':
      return {
        situation: workContext.outcome || '정리되지 않은 미수 청구가 있습니다.',
        nextAction: '미수 금액을 수납하거나 면제 처리하세요.',
        completion: unsettledCount > 0 ? '연결된 청구 항목의 잔액이 정리되어야 합니다.' : defaultCompletion,
      };
    case 'return_closeout':
      return {
        situation: workContext.outcome || '장기렌트 종료 후 정산 항목이 남아 있습니다.',
        nextAction: '미정리 청구/환불 항목을 수납, 면제 또는 환불 완료 처리하세요.',
        completion: unsettledCount > 0 ? `미정리 청구/환불 항목 ${unsettledCount}건을 모두 정리해야 합니다.` : '모든 정산 항목이 정리되었습니다.',
      };
    case 'return_late':
      return {
        situation: workContext.outcome || '반납 예정 시간이 지났지만 반납 완료가 확인되지 않았습니다.',
        nextAction: '실제 반납 여부를 확인하고 반납 완료 처리를 진행하세요.',
        completion: '예약이 반납 완료 상태가 되면 이슈 완료 처리를 진행할 수 있습니다.',
      };
    case 'rental_accident_followup':
      return {
        situation: workContext.outcome || '대여 중 사고 후속 정보가 필요합니다.',
        nextAction: '사고 정보, 증빙, 보험처리 상태를 보완하고 저장하세요.',
        completion: '필요한 사고 후속 정보가 저장되면 완료 처리할 수 있습니다.',
      };
    case 'accident_claim_intake':
      return {
        situation: workContext.outcome || '보험청구 기본 정보가 부족합니다.',
        nextAction: '사고접수번호, 보험사, 정비공장 등 기본 정보를 입력하세요.',
        completion: '필수 보험청구 정보가 저장되면 청구 진행이 가능합니다.',
      };
    case 'accident_claim_approval':
      return {
        situation: workContext.outcome || '대차 승인 확인이 필요합니다.',
        nextAction: '승인 상태와 승인 근거를 확인하고 저장하세요.',
        completion: '대차 승인 상태가 승인 완료로 저장되어야 합니다.',
      };
    case 'accident_claim_submission':
      return {
        situation: workContext.outcome || '보험청구 진행 또는 차액 정리가 필요합니다.',
        nextAction: '청구 제출, 보험금 입금 확인, 차액 부담 주체 정리를 진행하세요.',
        completion: '보험청구가 제출/인정되고 관련 차액 항목이 정리되어야 합니다.',
      };
    case 'asset_compliance':
      return {
        situation: workContext.outcome || '차량 의무관리 정보 갱신이 필요합니다.',
        nextAction: '만료일 또는 점검일과 증빙 문서를 갱신하세요.',
        completion: '갱신된 일자와 증빙이 저장되면 완료 처리할 수 있습니다.',
      };
    case 'vehicle_ops':
      return {
        situation: workContext.outcome || '차량 운영 상태 확인이 필요합니다.',
        nextAction: '차량 상태를 확인하고 필요한 운영 조치를 실행하세요.',
        completion: '운영 조치 이력이 남으면 완료 처리할 수 있습니다.',
      };
    default:
      return {
        situation: workContext.outcome || '수동 확인이 필요한 조치 항목입니다.',
        nextAction: '필요한 정보를 확인한 뒤 메모 또는 상태 변경으로 처리하세요.',
        completion: defaultCompletion,
      };
  }
}

function CloseoutSummary({ chargeItems }: { chargeItems: ActionItemWorkChargeItem[] }) {
  if (chargeItems.length === 0) {
    return null;
  }
  const settledCount = chargeItems.filter(isWorkChargeSettled).length;
  const refundDueCount = chargeItems.filter((charge) => isRefundChargeItem(charge) && !isWorkChargeSettled(charge)).length;
  const remainingAmount = chargeItems
    .filter((charge) => !isWorkChargeSettled(charge))
    .reduce((sum, charge) => sum + Math.max(charge.remainingAmount, 0), 0);

  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <div className="rounded-md border border-white/70 bg-white/70 px-3 py-2">
        <p className="text-xs font-semibold text-gray-500">정리 상태</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{settledCount}/{chargeItems.length}</p>
      </div>
      <div className="rounded-md border border-white/70 bg-white/70 px-3 py-2">
        <p className="text-xs font-semibold text-gray-500">남은 금액</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{remainingAmount.toLocaleString()}원</p>
      </div>
      <div className="rounded-md border border-white/70 bg-white/70 px-3 py-2">
        <p className="text-xs font-semibold text-gray-500">환불 대기</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{refundDueCount}건</p>
      </div>
      <div className="rounded-md border border-white/70 bg-white/70 px-3 py-2">
        <p className="text-xs font-semibold text-gray-500">전체 항목</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{chargeItems.length}건</p>
      </div>
    </div>
  );
}

export function WorkContextPanel({
  workContext,
  onAction,
  isSaving,
}: {
  workContext: ActionItemWorkContext;
  onAction: (actionKey: string, chargeItem?: ActionItemWorkChargeItem) => void;
  isSaving: boolean;
}) {
  const moduleSpec = ISSUE_WORK_MODULE_REGISTRY[workContext.module] ?? ISSUE_WORK_MODULE_REGISTRY.fallback;
  const chargeItems = toWorkChargeItems(workContext);
  const summary = getWorkContextSummary(workContext);
  const visibleChecklist = workContext.checklist.filter(shouldShowChecklistItem);
  const visibleActions = workContext.actions.filter(shouldRenderWorkAction);

  return (
    <div className={`rounded-lg border p-4 ${moduleSpec.accentClassName}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{moduleSpec.label}</p>
          <h3 className="mt-1 text-base font-bold text-gray-900">{workContext.title}</h3>
          {workContext.outcome && (
            <p className="mt-1 text-sm text-gray-700">{workContext.outcome}</p>
          )}
        </div>
      </div>

      <div className="mb-3 grid gap-2">
        <div className="rounded-md border border-white/70 bg-white/75 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500">현재 상황</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{summary.situation}</p>
        </div>
        <div className="rounded-md border border-white/70 bg-white/75 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500">해야 할 일</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{summary.nextAction}</p>
        </div>
        <div className="rounded-md border border-white/70 bg-white/75 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500">완료 기준</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{summary.completion}</p>
        </div>
      </div>

      {workContext.module === 'return_closeout' && (
        <CloseoutSummary chargeItems={chargeItems} />
      )}

      {visibleChecklist.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">완료 전 확인사항</p>
          {visibleChecklist.map((item) => (
            <div key={item.key} className="rounded-md border border-white/70 bg-white/75 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  {item.message && (
                    <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                  )}
                  {shouldShowChecklistValue(item) && (
                    <p className="mt-1 text-xs text-gray-500">현재값: {formatWorkContextValue(item.value)}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${getWorkChecklistStatusClassName(item.status)}`}>
                  {getWorkChecklistStatusLabel(item.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {chargeItems.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600">연결 청구/환불 항목</p>
          {chargeItems.map((charge) => {
            const isRefund = isRefundChargeItem(charge);
            const isSettled = isWorkChargeSettled(charge);
            return (
              <div key={charge.id} className="rounded-md border border-white/70 bg-white/75 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {charge.description || getChargeTypeLabel(charge.chargeType, isRefund)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                      <span>{getChargeStatusLabel(charge.status)}</span>
                      <span>잔액 {Math.max(charge.remainingAmount, 0).toLocaleString()}원</span>
                      <span>청구액 {Math.max(charge.amount, 0).toLocaleString()}원</span>
                      {charge.dueDate && <span>기한 {charge.dueDate}</span>}
                      {getPayerTypeLabel(charge.payerType) && <span>{getPayerTypeLabel(charge.payerType)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isSettled ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        정리 완료
                      </span>
                    ) : isRefund ? (
                      <button
                        type="button"
                        onClick={() => onAction('refund_complete', charge)}
                        disabled={isSaving}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        환불 완료
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onAction('charge_paid', charge)}
                          disabled={isSaving}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          수납 완료
                        </button>
                        <button
                          type="button"
                          onClick={() => onAction('charge_waive', charge)}
                          disabled={isSaving}
                          className="rounded-md bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          면제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visibleActions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleActions.map((action) => (
            <span key={action.key} className="inline-flex flex-col">
              <button
                type="button"
                onClick={() => onAction(action.key)}
                disabled={isSaving || Boolean(action.disabledReason)}
                title={action.disabledReason}
                className="rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action.key === 'status_update' ? '이슈 완료 처리' : action.label}
              </button>
              {action.disabledReason && (
                <span className="mt-1 max-w-52 text-xs text-red-600">{action.disabledReason}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
