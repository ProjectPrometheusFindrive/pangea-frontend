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

// 오늘 날짜 (2026-02-19)
const TODAY = new Date('2026-02-19');

// 연체 일수 계산
export function calculateOverdueDays(dueDate: string): number {
  const due = new Date(dueDate);
  const diffTime = TODAY.getTime() - due.getTime();
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
export function getUnpaidStatsByPeriod(): UnpaidStatsByPeriod {
  const unpaid = getUnpaidPayments(mockPayments);
  
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

// 결제 예시 데이터
export const mockPayments: Payment[] = [
  // 미납 건들
  {
    id: 'pay-1',
    reservationId: '2',
    vehicleNumber: '45나7890',
    customerName: '이준호',
    type: '본결제',
    amount: 380000,
    dueDate: '2026-02-10',  // 9일 연체
    status: '미납',
    method: '현금',
    description: '대여료 잔금'
  },
  {
    id: 'pay-2',
    reservationId: '3',
    vehicleNumber: '88라9999',
    customerName: '박서연',
    type: '추가정산',
    amount: 85000,
    dueDate: '2026-02-15',  // 4일 연체
    status: '미납',
    method: '카드',
    description: '과속 과태료'
  },
  {
    id: 'pay-3',
    reservationId: '10',
    vehicleNumber: '11가1111',
    customerName: '오세훈',
    type: '본결제',
    amount: 280000,
    dueDate: '2026-02-17',  // 2일 연체
    status: '미납',
    method: '카드',
    description: '대여료 잔금'
  },
  {
    id: 'pay-4',
    reservationId: '5',
    vehicleNumber: '77나7777',
    customerName: '최유진',
    type: '추가정산',
    amount: 1200000,
    dueDate: '2026-02-05',  // 14일 연체 (고액)
    status: '미납',
    method: '카드',
    description: '차량 파손 수리비'
  },
  {
    id: 'pay-5',
    reservationId: '7',
    vehicleNumber: '99허9999',
    customerName: '강지훈',
    type: '예약금',
    amount: 100000,
    dueDate: '2026-02-18',  // 1일 연체
    status: '미납',
    method: '현금',
    description: '예약금'
  },
  
  // 정상 결제 완료 건들
  {
    id: 'pay-6',
    reservationId: '1',
    vehicleNumber: '12가3456',
    customerName: '김민수',
    type: '본결제',
    amount: 450000,
    dueDate: '2026-02-13',
    paidDate: '2026-02-13',
    status: '완료',
    method: '카드',
    description: '대여료'
  },
  {
    id: 'pay-7',
    reservationId: '4',
    vehicleNumber: '33다2222',
    customerName: '정우진',
    type: '본결제',
    amount: 400000,
    dueDate: '2026-02-14',
    paidDate: '2026-02-14',
    status: '완료',
    method: '계좌이체',
    description: '대여료'
  },
  {
    id: 'pay-8',
    reservationId: '6',
    vehicleNumber: '11가1111',
    customerName: '오세훈',
    type: '예약금',
    amount: 200000,
    dueDate: '2026-02-12',
    paidDate: '2026-02-12',
    status: '완료',
    method: '카드',
    description: '예약금'
  },
  {
    id: 'pay-9',
    reservationId: '8',
    vehicleNumber: '22허8888',
    customerName: '한지민',
    type: '본결제',
    amount: 420000,
    dueDate: '2026-02-16',
    paidDate: '2026-02-16',
    status: '완료',
    method: '카드',
    description: '대여료'
  },
  
  // 대기 중 (아직 결제일 안됨)
  {
    id: 'pay-10',
    reservationId: '5',
    vehicleNumber: '77나7777',
    customerName: '최유진',
    type: '본결제',
    amount: 600000,
    dueDate: '2026-02-22',
    status: '대기',
    method: '카드',
    description: '대여료'
  },
  {
    id: 'pay-11',
    reservationId: '7',
    vehicleNumber: '99허9999',
    customerName: '강지훈',
    type: '본결제',
    amount: 350000,
    dueDate: '2026-02-24',
    status: '대기',
    method: '현금',
    description: '대여료'
  },
];