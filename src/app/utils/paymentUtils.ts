// 결제 관련 타입 정의
export interface Payment {
  id: string;
  reservationId: string;
  vehicleNumber: string;
  customerName: string;
  type: '예약금' | '본결제' | '추가정산' | '월렌트';
  amount: number;
  dueDate: string;          // 결제 예정일
  paidDate?: string;        // 실제 결제일
  status: '대기' | '완료' | '미납' | '부분납부';
  method: '카드' | '현금' | '계좌이체';
  description?: string;
}

// 연체 일수 계산
export function calculateOverdueDays(dueDate: string, referenceDate: Date = new Date()): number {
  const due = new Date(dueDate);
  const diffTime = referenceDate.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// 연체료 계산 (일 2% 복리)
export function calculateLateFee(amount: number, overdueDays: number): number {
  if (overdueDays === 0) return 0;
  const dailyRate = 0.02; // 2% per day
  return Math.floor(amount * dailyRate * overdueDays);
}

// 미납 건 감지
export function getUnpaidPayments(payments: Payment[]): Payment[] {
  return payments.filter(payment => {
    if (payment.status === '완료') return false;
    const overdueDays = calculateOverdueDays(payment.dueDate);
    return overdueDays > 0;
  });
}

// 심각도 분류
export function getPaymentSeverity(payment: Payment): 'High' | 'Medium' | 'Low' {
  const overdueDays = calculateOverdueDays(payment.dueDate);
  const lateFee = calculateLateFee(payment.amount, overdueDays);
  const totalAmount = payment.amount + lateFee;

  // High: 7일 이상 연체 or 100만원 이상
  if (overdueDays >= 7 || totalAmount >= 1000000) return 'High';
  
  // Medium: 3-6일 연체 or 50-100만원
  if (overdueDays >= 3 || totalAmount >= 500000) return 'Medium';
  
  // Low: 1-2일 연체 or 50만원 미만
  return 'Low';
}

// 미납 상태 문자열 생성
export function getPaymentStatusLabel(payment: Payment): string {
  const overdueDays = calculateOverdueDays(payment.dueDate);
  if (overdueDays === 0) return payment.status;
  return `${overdueDays}일 연체`;
}

// 기간별 미납금 통계
export interface UnpaidStatsByPeriod {
  weekly: { amount: number; count: number };
  monthly: { amount: number; count: number };
  yearly: { amount: number; count: number };
}

// 기간별 미납금 계산
export function getUnpaidStatsByPeriod(payments: Payment[]): UnpaidStatsByPeriod {
  const unpaid = getUnpaidPayments(payments);
  
  // 주간 (최근 7일 이내에 연체된 것)
  const weeklyUnpaid = unpaid.filter(p => {
    const overdueDays = calculateOverdueDays(p.dueDate);
    return overdueDays <= 7;
  });
  const weeklyAmount = weeklyUnpaid.reduce((sum, p) => {
    const overdueDays = calculateOverdueDays(p.dueDate);
    const lateFee = calculateLateFee(p.amount, overdueDays);
    return sum + p.amount + lateFee;
  }, 0);

  // 월간 (최근 30일 이내에 연체된 것)
  const monthlyUnpaid = unpaid.filter(p => {
    const overdueDays = calculateOverdueDays(p.dueDate);
    return overdueDays <= 30;
  });
  const monthlyAmount = monthlyUnpaid.reduce((sum, p) => {
    const overdueDays = calculateOverdueDays(p.dueDate);
    const lateFee = calculateLateFee(p.amount, overdueDays);
    return sum + p.amount + lateFee;
  }, 0);

  // 연간 (전체 미납)
  const yearlyAmount = unpaid.reduce((sum, p) => {
    const overdueDays = calculateOverdueDays(p.dueDate);
    const lateFee = calculateLateFee(p.amount, overdueDays);
    return sum + p.amount + lateFee;
  }, 0);

  return {
    weekly: { amount: weeklyAmount, count: weeklyUnpaid.length },
    monthly: { amount: monthlyAmount, count: monthlyUnpaid.length },
    yearly: { amount: yearlyAmount, count: unpaid.length },
  };
}
