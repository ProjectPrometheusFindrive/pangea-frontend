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

export interface Reservation {
  id: string;
  companyId?: string;
  vehicleNumber: string;
  vin?: string;
  customer: string;
  startDate: number;
  endDate: number;
  returnedAt?: string;
  lateReturn?: boolean;
  contractStatus?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  type: 'reservation' | 'rental' | 'return';
  issues?: string[];
  phone: string;
  paymentMethod: '카드' | '현금' | '계좌이체';
  amount: string;
  deposit: string;
  paymentStatus: '대기' | '완료' | '미납' | '부분납부';
  hasPaymentInfo?: boolean;
  additionalPaymentAmount?: number;
  paymentInfo?: ReservationPaymentInfo;
  startDateFull?: string;
  endDateFull?: string;
}
