// 이슈 유형별 심각도 계산 로직

export type Severity = 'High' | 'Medium' | 'Low';

// 1. 반납 지연 심각도 계산
export function getReturnDelaySeverity(delayDays: number): Severity {
  if (delayDays >= 3) return 'High';
  if (delayDays >= 1) return 'Medium';
  return 'Low';
}

// 2. 사고 접수 데이터 구조
export interface AccidentReport {
  id: string;
  vehicleNumber: string;
  customerName: string;
  reportDate: string;
  accidentType: 'major' | 'medium' | 'minor'; // 대형, 중형, 경미
  severity: Severity;
  description: string;
  status: string;
  assignee: string;
}

export function getAccidentSeverity(accidentType: 'major' | 'medium' | 'minor'): Severity {
  switch (accidentType) {
    case 'major':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'minor':
      return 'Low';
  }
}

// 3. 단말 OFF 심각도 계산
export interface TerminalOffData {
  id: string;
  vehicleNumber: string;
  customerName: string;
  offSince: string; // ISO 날짜
  offHours: number;
}

export function getTerminalOffSeverity(offHours: number): Severity {
  if (offHours >= 24) return 'High';
  if (offHours >= 12) return 'Medium';
  return 'Low';
}

export function calculateOffHours(offSince: string): number {
  const offDate = new Date(offSince);
  const now = new Date();
  const diffMs = now.getTime() - offDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60)); // 시간 단위
}

// 4. 도난 의심 심각도 계산
export interface TheftSuspicionData {
  id: string;
  vehicleNumber: string;
  customerName: string;
  geofenceViolation: boolean; // 지오펜싱 위반
  terminalOffHours: number; // 단말 OFF 시간
  lastKnownLocation: string;
}

export function getTheftSuspicionSeverity(data: TheftSuspicionData): Severity {
  // 지오펜싱 위반 + 단말 24시간 이상 OFF = High
  if (data.geofenceViolation && data.terminalOffHours >= 24) return 'High';
  // 지오펜싱 위반 또는 단말 12시간 이상 OFF = Medium
  if (data.geofenceViolation || data.terminalOffHours >= 12) return 'Medium';
  return 'Low';
}

// 5. 차량이상 - 경고등 기반 심각도
export type WarningLightType = 
  | 'engine' // 엔진 경고등
  | 'brake' // 브레이크 경고등
  | 'battery' // 배터리 경고등
  | 'oil' // 엔진오일 경고등
  | 'tire' // 타이어 공기압 경고등
  | 'abs' // ABS 경고등
  | 'airbag' // 에어백 경고등
  | 'check_engine' // 체크 엔진
  | 'temperature' // 냉각수 온도
  | 'other'; // 기타

export interface VehicleMalfunctionData {
  id: string;
  vehicleNumber: string;
  customerName: string;
  warningLights: WarningLightType[];
  reportDate: string;
}

export function getVehicleMalfunctionSeverity(warningLights: WarningLightType[]): Severity {
  // 주행 불가 수준 (High)
  const criticalLights: WarningLightType[] = ['engine', 'brake', 'temperature', 'airbag'];
  if (warningLights.some(light => criticalLights.includes(light))) {
    return 'High';
  }
  
  // 주행 가능하나 정비 필요 (Medium)
  const moderateLights: WarningLightType[] = ['abs', 'battery', 'oil', 'check_engine'];
  if (warningLights.some(light => moderateLights.includes(light))) {
    return 'Medium';
  }
  
  // 경미한 이상 (Low)
  return 'Low';
}

export const warningLightLabels: Record<WarningLightType, string> = {
  engine: '엔진 경고등',
  brake: '브레이크 경고등',
  battery: '배터리 경고등',
  oil: '엔진오일 경고등',
  tire: '타이어 공기압 경고등',
  abs: 'ABS 경고등',
  airbag: '에어백 경고등',
  check_engine: '체크 엔진',
  temperature: '냉각수 온도 경고등',
  other: '기타 경고',
};

// 6. 과태료 심각도 계산
export interface FineData {
  id: string;
  vehicleNumber: string;
  customerName: string;
  fineAmount: number;
  fineType: string;
  issueDate: string;
}

export function getFineSeverity(fineAmount: number): Severity {
  if (fineAmount >= 200000) return 'High'; // 20만원 이상
  if (fineAmount >= 100000) return 'Medium'; // 10만원 이상
  return 'Low'; // 10만원 미만
}

// 7. 정기점검 심각도 계산
export interface MaintenanceData {
  id: string;
  vehicleNumber: string;
  customerName: string;
  scheduledDate: string;
  maintenanceType: string;
}

export function getMaintenanceSeverity(scheduledDate: string): Severity {
  const scheduled = new Date(scheduledDate);
  const now = new Date();
  const diffMs = scheduled.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (daysUntil <= 3) return 'High';
  if (daysUntil <= 5) return 'Medium';
  return 'Low';
}

export function calculateDaysUntil(scheduledDate: string): number {
  const scheduled = new Date(scheduledDate);
  const now = new Date();
  const diffMs = scheduled.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// 반납 지연 데이터 구조
export interface ReturnDelayData {
  id: string;
  vehicleNumber: string;
  customerName: string;
  expectedReturnDate: string;
  delayDays: number;
}

export function calculateDelayDays(expectedReturnDate: string): number {
  const expected = new Date(expectedReturnDate);
  const now = new Date();
  const diffMs = now.getTime() - expected.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// Mock 데이터들
export const mockReturnDelays: ReturnDelayData[] = [
  // mockData.ts의 actionItems에서 반납 지연 항목 사용
  // 실제로는 ActionRequired.tsx에서 mockData.ts의 actionItems 직접 사용하도록 변경 예정
  { id: 'rd1', vehicleNumber: '33다2222', customerName: '박서연', expectedReturnDate: '2025-02-14', delayDays: 5 },
  { id: 'rd2', vehicleNumber: '88라9999', customerName: '정우진', expectedReturnDate: '2025-02-15', delayDays: 4 },
  { id: 'rd3', vehicleNumber: '99허1234', customerName: '한지민', expectedReturnDate: '2025-02-16', delayDays: 3 },
  { id: 'rd4', vehicleNumber: '22바7777', customerName: '송민재', expectedReturnDate: '2025-02-16', delayDays: 3 },
  { id: 'rd5', vehicleNumber: '55사9999', customerName: '윤서준', expectedReturnDate: '2025-02-17', delayDays: 2 },
];

export const mockAccidents: AccidentReport[] = [
  { id: 'ac1', vehicleNumber: '12가3456', customerName: '김민수', reportDate: '2025-02-15', accidentType: 'major', severity: 'High', description: '후방 추돌 사고', status: '신규', assignee: '이영희' },
  { id: 'ac2', vehicleNumber: '45나7890', customerName: '이준호', reportDate: '2025-02-16', accidentType: 'medium', severity: 'Medium', description: '측면 접촉', status: '진행', assignee: '박철수' },
  { id: 'ac3', vehicleNumber: '77나5555', customerName: '장수빈', reportDate: '2025-02-17', accidentType: 'major', severity: 'High', description: '전방 충돌', status: '신규', assignee: '최지우' },
];

export const mockTerminalOff: TerminalOffData[] = [
  { id: 'to1', vehicleNumber: '22허8888', customerName: '강지훈', offSince: '2025-02-18T06:00:00', offHours: 18 },
  { id: 'to2', vehicleNumber: '44하4444', customerName: '이도윤', offSince: '2025-02-18T18:00:00', offHours: 6 },
  { id: 'to3', vehicleNumber: '77허2222', customerName: '박준영', offSince: '2025-02-18T00:00:00', offHours: 24 },
  { id: 'to4', vehicleNumber: '88허3333', customerName: '김현우', offSince: '2025-02-18T12:00:00', offHours: 12 },
];

export const mockTheftSuspicion: TheftSuspicionData[] = [
  { id: 'th1', vehicleNumber: '10루1000', customerName: '강민호', geofenceViolation: true, terminalOffHours: 36, lastKnownLocation: '경기도 광명시' },
];

export const mockVehicleMalfunction: VehicleMalfunctionData[] = [
  { id: 'vm1', vehicleNumber: '88라9999', customerName: '정우진', warningLights: ['engine', 'temperature'], reportDate: '2025-02-16' },
  { id: 'vm2', vehicleNumber: '99허9999', customerName: '강지훈', warningLights: ['battery', 'oil'], reportDate: '2025-02-17' },
  { id: 'vm3', vehicleNumber: '33다3333', customerName: '이민서', warningLights: ['tire'], reportDate: '2025-02-17' },
];

export const mockFines: FineData[] = [
  { id: 'fn1', vehicleNumber: '33거5555', customerName: '박지훈', fineAmount: 60000, fineType: '과속', issueDate: '2025-02-12' },
  { id: 'fn2', vehicleNumber: '99너6666', customerName: '정민수', fineAmount: 150000, fineType: '신호위반', issueDate: '2025-02-13' },
  { id: 'fn3', vehicleNumber: '11거1111', customerName: '최서연', fineAmount: 80000, fineType: '주정차위반', issueDate: '2025-02-14' },
  { id: 'fn4', vehicleNumber: '22거2222', customerName: '김태현', fineAmount: 120000, fineType: '버스전용차로', issueDate: '2025-02-15' },
  { id: 'fn5', vehicleNumber: '44거4444', customerName: '이지은', fineAmount: 70000, fineType: '안전띠 미착용', issueDate: '2025-02-16' },
  { id: 'fn6', vehicleNumber: '55거5555', customerName: '홍길동', fineAmount: 200000, fineType: '음주운전', issueDate: '2025-02-17' },
];

export const mockMaintenance: MaintenanceData[] = [
  { id: 'mt1', vehicleNumber: '30부3000', customerName: '윤지호', scheduledDate: '2025-02-20', maintenanceType: '정기점검' },
  { id: 'mt2', vehicleNumber: '40수4000', customerName: '서민준', scheduledDate: '2025-02-21', maintenanceType: '정기점검' },
  { id: 'mt3', vehicleNumber: '50아5000', customerName: '정유나', scheduledDate: '2025-02-22', maintenanceType: '오일 교환' },
  { id: 'mt4', vehicleNumber: '60자6000', customerName: '이하은', scheduledDate: '2025-02-23', maintenanceType: '타이어 교체' },
  { id: 'mt5', vehicleNumber: '70차7000', customerName: '박시우', scheduledDate: '2025-02-24', maintenanceType: '정기점검' },
  { id: 'mt6', vehicleNumber: '80카8000', customerName: '최예준', scheduledDate: '2025-02-25', maintenanceType: '정기점검' },
  { id: 'mt7', vehicleNumber: '90타9000', customerName: '한서윤', scheduledDate: '2025-02-26', maintenanceType: '정기점검' },
  { id: 'mt8', vehicleNumber: '11파1111', customerName: '송지훈', scheduledDate: '2025-02-27', maintenanceType: '정기점검' },
];

// ⚠️ 경고: 이 파일의 mock 데이터는 더 이상 사용되지 않습니다
// /src/app/data/mockData.ts의 통합 데이터를 사용하세요