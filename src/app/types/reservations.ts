export interface ReservationPaymentInfo {
  paymentId?: string;
  reservationId?: string;
  status?: string;
  amount: number;
  principalAmount: number;
  additionalAmount: number;
  overdueDays: number;
  dueDate?: string;
  method?: string;
  updatedAt?: string;
}

export interface BillingChangeHistoryEntry {
  action?: string;
  changedAt?: string;
  changedByName?: string;
  changedBy?: string;
  changes?: Record<string, { from?: unknown; to?: unknown }>;
}

export interface ReservationChargeItem {
  id: string;
  reservationId?: string;
  rentalType?: string;
  sequenceNo?: number;
  chargeType: string;
  payerType?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  dueDate?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  memo?: string;
  refundCompletedAt?: string;
  refundMethod?: string;
  refundReason?: string;
  evidenceRefs?: Array<{
    objectName: string;
    fileName?: string;
    contentType?: string;
    attachedAt?: string;
    attachedByName?: string;
  }>;
  changeHistory?: BillingChangeHistoryEntry[];
}

export interface ReservationPaymentRecord {
  id: string;
  reservationId?: string;
  payerType?: string;
  paidAt?: string;
  amount: number;
  method?: string;
  confirmationStatus: string;
  depositorName?: string;
  approvalNo?: string;
  allocations?: Array<{
    chargeItemId?: string;
    amount?: number;
  }>;
  evidenceRefs?: Array<{
    objectName: string;
    fileName?: string;
    contentType?: string;
    attachedAt?: string;
    attachedByName?: string;
  }>;
  status?: string;
  memo?: string;
  changeHistory?: BillingChangeHistoryEntry[];
}

export interface ReservationBillingSummary {
  reservationId?: string;
  paymentSummaryStatus: string;
  paymentSummaryLabel: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overdueAmount: number;
  refundAmount: number;
  chargeItemCount: number;
  paymentRecordCount: number;
  confirmationNeededCount: number;
  currency?: string;
  billingPlan?: {
    id?: string;
    reservationId?: string;
    monthlyAmount?: number;
    billingDay?: number;
    billingTiming?: string;
    cycleMonths?: number;
    graceDays?: number;
    deposit?: number;
    advancePayment?: number;
    installmentCount?: number;
    payerType?: string;
  } | null;
  chargeItems?: ReservationChargeItem[];
  paymentRecords?: ReservationPaymentRecord[];
}

export interface ReservationAccidentClaim {
  id?: string;
  reservationId?: string;
  requestSource?: string;
  requesterOrganizationName?: string;
  requesterName?: string;
  requesterPhone?: string;
  insurerName?: string;
  claimNo?: string;
  adjusterName?: string;
  adjusterPhone?: string;
  repairShopName?: string;
  repairShopLocation?: string;
  repairCompletedAt?: string;
  damagedVehicleNumber?: string;
  damagedVehicleModel?: string;
  deliveryLocation?: string;
  billedAmount?: number;
  recognizedAmount?: number;
  differenceAmount?: number;
  differencePayerType?: string;
  documentStatus?: string;
  claimStatus?: string;
  documentObjectNames?: string[];
  submittedAt?: string;
  supplementMemo?: string;
}

export interface ReservationAccidentReport {
  accidentDate?: string;
  accidentDateTime?: string;
  accidentDisplayTime?: string;
  blackboxFileName?: string;
  blackboxGcsObjectName?: string;
  handlerName?: string;
  accidentLocation?: string;
  opponentInfo?: string;
  insuranceClaimNo?: string;
  evidenceStatus?: string;
  insuranceProcessStatus?: string;
  repairCompletedAt?: string;
  customerChargeAmount?: number;
  customerChargeStatus?: string;
  followupUpdatedAt?: string;
  memo?: string;
}

export interface ReservationParty {
  type?: string;
  source?: string;
  name?: string;
  organizationName?: string;
  contactName?: string;
  phone?: string;
  businessNumber?: string;
  address?: string;
  licenseNumber?: string;
  licenseDocumentObjectName?: string;
  billingAccount?: string;
  insurerName?: string;
  claimNo?: string;
  externalRequestNo?: string;
}

export interface ReservationParties {
  contractor?: ReservationParty;
  driver?: ReservationParty;
  additionalDrivers?: ReservationParty[];
  requester?: ReservationParty;
  payer?: ReservationParty;
}

export interface ReservationDocumentChecklistItem {
  key: string;
  label: string;
  required: boolean;
  status: 'ready' | 'missing' | 'optional' | 'pickup_blocked' | 'action_required' | 'not_applicable' | string;
  objectName?: string;
  detail?: {
    objectName: string;
    fileName?: string;
    contentType?: string;
    url?: string;
    documentType?: string;
  };
  details?: Array<{
    objectName: string;
    fileName?: string;
    contentType?: string;
    url?: string;
    documentType?: string;
  }>;
  reasonType?: string;
}

export interface Reservation {
  id: string;
  companyId?: string;
  rentalType?: string;
  creationMode?: string;
  vehicleNumber: string;
  vin?: string;
  customer: string;
  startDate: number;
  endDate: number;
  returnedAt?: string;
  lateReturn?: boolean;
  contractStatus?: string;
  workflowStatus?: string;
  workflowStatusLabel?: string;
  closeoutStatus?: string;
  closeoutStatusLabel?: string;
  cancellationSettlementStatus?: string;
  cancellationSettlementStatusLabel?: string;
  longTermAccountStatus?: string;
  longTermAccountStatusLabel?: string;
  accidentReplacementStatus?: string;
  accidentReplacementStatusLabel?: string;
  workflowVersion?: number;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  type: 'reservation' | 'rental' | 'return';
  issues?: string[];
  phone: string;
  paymentMethod: '카드' | '현금' | '계좌이체';
  amount: string;
  deposit: string;
  licenseDocumentObjectName?: string;
  contractDocumentObjectName?: string;
  contractDocumentType?: string;
  contractDocuments?: Array<{
    objectName: string;
    fileName?: string;
    documentType?: string;
  }>;
  documentChecklist?: ReservationDocumentChecklistItem[];
  paymentStatus: '대기' | '완료' | '미납' | '부분납부';
  hasPaymentInfo?: boolean;
  additionalPaymentAmount?: number;
  paymentInfo?: ReservationPaymentInfo;
  paymentSummaryStatus?: string;
  billingSummary?: ReservationBillingSummary;
  chargeItemsPreview?: ReservationChargeItem[];
  accidentClaim?: ReservationAccidentClaim;
  accidentReport?: ReservationAccidentReport;
  parties?: ReservationParties;
  startDateFull?: string;
  endDateFull?: string;
}
