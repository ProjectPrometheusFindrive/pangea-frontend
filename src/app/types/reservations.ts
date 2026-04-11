export interface Reservation {
  id: string;
  companyId?: string;
  vehicleNumber: string;
  vin?: string;
  customer: string;
  startDate: number;
  endDate: number;
  returnedAt?: string;
  contractStatus?: string;
  scheduledStartAt?: string;
  type: 'reservation' | 'rental' | 'return';
  issues?: string[];
  phone: string;
  paymentMethod: '카드' | '현금' | '계좌이체';
  amount: string;
  deposit: string;
  paymentStatus: '대기' | '완료' | '미납' | '부분납부';
  startDateFull?: string;
  endDateFull?: string;
}
