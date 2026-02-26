// 중앙 집중식 Mock 데이터
// 모든 페이지에서 이 데이터를 참조하여 일관성 유지

import type { DTCRecord, VehicleAsset, VehicleDeviceStatus } from '../types/assets';

export type { DTCRecord, VehicleAsset, VehicleDeviceStatus } from '../types/assets';

export interface Reservation {
  id: string;
  vehicleNumber: string;
  customer: string;
  startDate: number; // 0부터 시작하는 날짜 오프셋 (2025-02-20 기준)
  endDate: number;
  type: 'reservation' | 'rental' | 'return';
  issues?: string[];
  phone: string;
  paymentMethod: '카드' | '현금' | '계좌이체';
  amount: string;
  deposit: string;
  paymentStatus: '대기' | '완료' | '미납' | '부분납부'; // 결제 상태
  startDateFull?: string; // 실제 날짜 (YYYY-MM-DD)
  endDateFull?: string;
}

export interface MemoLog {
  id: string;
  content: string;
  timestamp: string;
  author: string;
  status: 'pending' | 'in-progress' | 'resolved';
  statusLabel: string;
}

export interface ActionItem {
  id: string;
  category: string;
  vehicleNumber: string;
  customer?: string;
  issue: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'resolved';
  assignee?: string;
  description?: string;
  memos?: MemoLog[];
}

// =====================================================
// 차량 자산 데이터 (50대)
// =====================================================
export const vehicleAssets: VehicleAsset[] = [
  // 프리미엄 단말 장착 차량 (10대)
  {
    vehicleNumber: '11가1111',
    model: '그랜저',
    status: '대여중',
    issues: ['반납 지연'],
    insuranceExpiry: '2025-12-15',
    nextInspection: '2025-09-10',
    vin: 'KMHD041CBPU123456',
    year: '2023',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-001',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 13.2,
      oilPressure: 45,
      coolantTemp: 92,
      tirePressure: [34, 33, 35, 34],
      brakeFluid: 95,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 88,
      fuelLevel: 45,
      lastUpdate: '2025-02-22T10:30:00',
    },
  },
  {
    vehicleNumber: '22나2222',
    model: '아반떼',
    status: '대여중',
    issues: ['사고 접수'],
    insuranceExpiry: '2025-11-20',
    nextInspection: '2025-08-15',
    vin: 'KMHD141ABPU789012',
    year: '2022',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-002',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 12.8,
      oilPressure: 42,
      coolantTemp: 90,
      tirePressure: [32, 33, 32, 33],
      brakeFluid: 88,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 85,
      fuelLevel: 62,
      lastUpdate: '2025-02-22T10:25:00',
    },
  },
  {
    vehicleNumber: '33다3333',
    model: '쏘나타',
    status: '대여중',
    issues: ['차량이상'],
    insuranceExpiry: '2025-10-30',
    nextInspection: '2025-07-22',
    vin: 'KMHE241CBPU345678',
    year: '2022',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-003',
    deviceStatus: {
      engineWarning: true, // 엔진 경고등 점등
      batteryVoltage: 11.5, // 배터리 저전압
      oilPressure: 22,      // 오일 압력 낮음
      coolantTemp: 95,
      tirePressure: [28, 29, 30, 28], // 타이어 공기압 낮음
      brakeFluid: 92,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 92,
      fuelLevel: 38,
      lastUpdate: '2025-02-22T10:20:00',
    },
    dtcHistory: [
      {
        id: 'DTC001',
        vehicleNumber: '33다3333',
        dtcCode: 'P0420',
        description: '촉매 변환기 효율 저하',
        detectedAt: '2025-02-22T08:15:00',
        severity: 'high',
        status: 'pending',
      },
      {
        id: 'DTC002',
        vehicleNumber: '33다3333',
        dtcCode: 'P0171',
        description: '연료 혼합비 과다 (희박)',
        detectedAt: '2025-02-21T14:30:00',
        severity: 'medium',
        status: 'in-progress',
        notes: '정비 예약 완료',
      },
      {
        id: 'DTC003',
        vehicleNumber: '33다3333',
        dtcCode: 'C0035',
        description: '좌측 앞 휠 속도 센서 오류',
        detectedAt: '2025-02-18T16:45:00',
        severity: 'low',
        status: 'resolved',
        resolvedAt: '2025-02-19T11:20:00',
        resolvedBy: '정비팀 이철수',
        notes: '센서 교체 완료',
      },
    ],
  },
  {
    vehicleNumber: '44라4444',
    model: '투싼',
    status: '대여중',
    issues: ['미납/결제 문제'],
    insuranceExpiry: '2026-01-10',
    nextInspection: '2025-10-05',
    vin: 'KMHF341DBPU901234',
    year: '2023',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-004',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 13.5,
      oilPressure: 48,
      coolantTemp: 88,
      tirePressure: [35, 35, 34, 35],
      brakeFluid: 98,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 82,
      fuelLevel: 72,
      lastUpdate: '2025-02-22T10:35:00',
    },
  },
  {
    vehicleNumber: '55마5555',
    model: '스포티지',
    status: '대여중',
    issues: ['단말 OFF'],
    insuranceExpiry: '2025-09-18',
    nextInspection: '2025-06-14',
    vin: 'KMHG441EBPU567890',
    year: '2021',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-005',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 0, // 단말 OFF
      oilPressure: 0,
      coolantTemp: 0,
      tirePressure: [0, 0, 0, 0],
      brakeFluid: 0,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 0,
      fuelLevel: 0,
      lastUpdate: '2025-02-21T18:30:00', // 18시간 전
    },
  },
  {
    vehicleNumber: '66바6666',
    model: '셀토스',
    status: '대여중',
    issues: ['도난 의심'],
    insuranceExpiry: '2025-08-25',
    nextInspection: '2025-05-20',
    vin: 'KMHH541FBPU678901',
    year: '2022',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-006',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 0, // 단말 OFF (48시간)
      oilPressure: 0,
      coolantTemp: 0,
      tirePressure: [0, 0, 0, 0],
      brakeFluid: 0,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 0,
      fuelLevel: 0,
      lastUpdate: '2025-02-20T10:00:00', // 48시간 전
    },
  },
  {
    vehicleNumber: '77사7777',
    model: '카니발',
    status: '가용',
    issues: ['정기점검'],
    insuranceExpiry: '2026-03-15',
    nextInspection: '2025-02-23', // 내일
    vin: 'KMHI641GBPU789012',
    year: '2024',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-007',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 13.8,
      oilPressure: 52,
      coolantTemp: 89,
      tirePressure: [36, 36, 35, 36],
      brakeFluid: 100,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 84,
      fuelLevel: 85,
      lastUpdate: '2025-02-22T10:40:00',
    },
  },
  {
    vehicleNumber: '88아8888',
    model: '팰리세이드',
    status: '대여중',
    issues: ['보험 만료 임박'],
    insuranceExpiry: '2025-02-28', // 6일 후
    nextInspection: '2025-11-10',
    vin: 'KMHJ741HBPU890123',
    year: '2023',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-008',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 13.4,
      oilPressure: 46,
      coolantTemp: 91,
      tirePressure: [34, 35, 34, 35],
      brakeFluid: 94,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 86,
      fuelLevel: 55,
      lastUpdate: '2025-02-22T10:38:00',
    },
  },
  {
    vehicleNumber: '99자9999',
    model: '코나',
    status: '대여중',
    issues: [],
    insuranceExpiry: '2026-05-20',
    nextInspection: '2026-01-15',
    vin: 'KMHK841IBPU901234',
    year: '2024',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-009',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 13.6,
      oilPressure: 50,
      coolantTemp: 90,
      tirePressure: [35, 35, 35, 35],
      brakeFluid: 97,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 87,
      fuelLevel: 68,
      lastUpdate: '2025-02-22T10:42:00',
    },
  },
  {
    vehicleNumber: '00차0000',
    model: 'EV6',
    status: '가용',
    issues: [],
    insuranceExpiry: '2026-07-10',
    nextInspection: '2026-03-25',
    vin: 'KMHL941JBPU012345',
    year: '2024',
    owner: '렌터카(주)',
    hasPremiumDevice: true,
    deviceSerialNumber: 'DEV-2023-010',
    deviceStatus: {
      engineWarning: false,
      batteryVoltage: 13.9,
      oilPressure: 48,
      coolantTemp: 88,
      tirePressure: [36, 36, 36, 36],
      brakeFluid: 99,
      absWarning: false,
      airbagWarning: false,
      transmissionTemp: 83,
      fuelLevel: 90,
      lastUpdate: '2025-02-22T10:44:00',
    },
  },
  // 일반 차량 (단말 미장착, 40대)
  ...Array.from({ length: 40 }, (_, i) => {
    const index = i + 10;
    const plateNum = String(index + 1).padStart(4, '0');
    const models = ['그랜저', '쏘나타', '아반떼', '투싼', '스포티지', '셀토스', '카니발', '코나'];
    const statuses: Array<'대여중' | '예약' | '가용' | '정비중'> = ['대여중', '예약', '가용', '정비중'];
    
    return {
      vehicleNumber: `${plateNum.slice(0, 2)}카${plateNum.slice(2)}`,
      model: models[i % models.length],
      status: statuses[i % statuses.length],
      issues: [],
      insuranceExpiry: `2025-${String((i % 12) + 1).padStart(2, '0')}-15`,
      nextInspection: `2025-${String((i % 12) + 1).padStart(2, '0')}-20`,
      vin: `KMH${String.fromCharCode(65 + (i % 26))}${String(i + 100).padStart(3, '0')}KBPU${String(i + 100000).padStart(6, '0')}`,
      year: String(2020 + (i % 5)),
      owner: '렌터카(주)',
      hasPremiumDevice: false,
    };
  }),
];

// =====================================================
// 조치 필요 항목 데이터
// =====================================================
export const actionItems: ActionItem[] = [
  // 1. 반납 지연 (2건)
  {
    id: 'ACT001',
    category: '반납 지연',
    vehicleNumber: '11가1111',
    customer: '김철수',
    issue: '반납 예정일 3일 경과',
    dueDate: '2025-02-19',
    priority: 'high',
    status: 'pending',
    assignee: '박민수',
    description: '고객 연락 두절 상태',
  },
  {
    id: 'ACT002',
    category: '반납 지연',
    vehicleNumber: '12카1234',
    customer: '이영희',
    issue: '반납 예정일 1일 경과',
    dueDate: '2025-02-21',
    priority: 'medium',
    status: 'in-progress',
    assignee: '정수진',
    description: '고객 연장 협의 중',
  },

  // 2. 사고 접수 (3건)
  {
    id: 'ACT003',
    category: '사고 접수',
    vehicleNumber: '22나2222',
    customer: '박민수',
    issue: '후방 접촉 사고',
    dueDate: '2025-02-22',
    priority: 'high',
    status: 'pending',
    assignee: '최동욱',
    description: '보험 접수 대기',
  },
  {
    id: 'ACT004',
    category: '사고 접수',
    vehicleNumber: '13카1345',
    customer: '정수진',
    issue: '측면 스크래치',
    dueDate: '2025-02-21',
    priority: 'medium',
    status: 'in-progress',
    assignee: '강민호',
    description: '정비소 견적 확인 중',
  },
  {
    id: 'ACT005',
    category: '사고 접수',
    vehicleNumber: '14카1456',
    customer: '최동욱',
    issue: '전방 충돌',
    dueDate: '2025-02-20',
    priority: 'high',
    status: 'in-progress',
    assignee: '윤서연',
    description: '보험사 실사 진행 중',
  },

  // 3. 미납/결제 문제 (4건)
  {
    id: 'ACT006',
    category: '미납/결제 문제',
    vehicleNumber: '44라4444',
    customer: '강민호',
    issue: '대여료 미납 (5일 경과)',
    dueDate: '2025-02-17',
    priority: 'high',
    status: 'pending',
    assignee: '조현우',
    description: '총 청구액: 520,000원',
  },
  {
    id: 'ACT007',
    category: '미납/결제 문제',
    vehicleNumber: '15카1567',
    customer: '윤서연',
    issue: '대여료 미납 (3일 경과)',
    dueDate: '2025-02-19',
    priority: 'high',
    status: 'in-progress',
    assignee: '한지민',
    description: '고객 연락 완료, 내일 입금 예정',
  },
  {
    id: 'ACT008',
    category: '미납/결제 문제',
    vehicleNumber: '16카1678',
    customer: '조현우',
    issue: '부분 납부 (잔액 150,000원)',
    dueDate: '2025-02-20',
    priority: 'medium',
    status: 'pending',
    assignee: '백승호',
  },
  {
    id: 'ACT009',
    category: '미납/결제 문제',
    vehicleNumber: '17카1789',
    customer: '한지민',
    issue: '대여료 미납 (2일 경과)',
    dueDate: '2025-02-20',
    priority: 'medium',
    status: 'in-progress',
    assignee: '홍길동',
  },

  // 4. 단말 OFF (5건)
  {
    id: 'ACT010',
    category: '단말 OFF',
    vehicleNumber: '55마5555',
    customer: '백승호',
    issue: '단말 연결 끊김 (18시간)',
    dueDate: '2025-02-22',
    priority: 'medium',
    status: 'pending',
    assignee: '김민재',
    description: '고객 연락 필요',
  },
  {
    id: 'ACT011',
    category: '단말 OFF',
    vehicleNumber: '18카1890',
    customer: '홍길동',
    issue: '단말 연결 끊김 (12시간)',
    dueDate: '2025-02-22',
    priority: 'medium',
    status: 'pending',
    assignee: '이강인',
  },
  {
    id: 'ACT012',
    category: '단말 OFF',
    vehicleNumber: '19카1901',
    customer: '김민재',
    issue: '단말 연결 끊김 (8시간)',
    dueDate: '2025-02-22',
    priority: 'low',
    status: 'pending',
    assignee: '황희찬',
  },
  {
    id: 'ACT013',
    category: '단말 OFF',
    vehicleNumber: '20카2012',
    customer: '이강인',
    issue: '단말 연결 끊김 (6시간)',
    dueDate: '2025-02-22',
    priority: 'low',
    status: 'in-progress',
    assignee: '황의조',
  },
  {
    id: 'ACT014',
    category: '단말 OFF',
    vehicleNumber: '21카2123',
    customer: '황희찬',
    issue: '단말 연결 끊김 (15시간)',
    dueDate: '2025-02-22',
    priority: 'medium',
    status: 'pending',
    assignee: '손흥민',
  },

  // 5. 도난 의심 (1건)
  {
    id: 'ACT015',
    category: '도난 의심',
    vehicleNumber: '66바6666',
    customer: '황의조',
    issue: '지오펜스 이탈 + 단말 OFF (48시간)',
    dueDate: '2025-02-22',
    priority: 'high',
    status: 'pending',
    assignee: '이청용',
    description: '긴급 확인 필요, 경찰 신고 검토',
  },

  // 6. 차량이상 (6건)
  {
    id: 'ACT016',
    category: '차량이상',
    vehicleNumber: '33다3333',
    customer: '손흥민',
    issue: '엔진 경고등 점등',
    dueDate: '2025-02-22',
    priority: 'high',
    status: 'pending',
    assignee: '기성용',
    description: 'DTC 코드: P0420',
  },
  {
    id: 'ACT017',
    category: '차량이상',
    vehicleNumber: '22카2234',
    customer: '이청용',
    issue: '타이어 공기압 부족',
    dueDate: '2025-02-22',
    priority: 'medium',
    status: 'in-progress',
    assignee: '박지성',
  },
  {
    id: 'ACT018',
    category: '차량이상',
    vehicleNumber: '23카2345',
    customer: '기성용',
    issue: '배터리 전압 저하',
    dueDate: '2025-02-22',
    priority: 'medium',
    status: 'pending',
    assignee: '차범근',
  },
  {
    id: 'ACT019',
    category: '차량이상',
    vehicleNumber: '24카2456',
    customer: '박지성',
    issue: 'ABS 경고등 점등',
    dueDate: '2025-02-21',
    priority: 'high',
    status: 'in-progress',
    assignee: '김수현',
  },
  {
    id: 'ACT020',
    category: '차량이상',
    vehicleNumber: '25카2567',
    customer: '차범근',
    issue: '브레이크액 부족',
    dueDate: '2025-02-21',
    priority: 'high',
    status: 'pending',
    assignee: '전지현',
  },
  {
    id: 'ACT021',
    category: '차량이상',
    vehicleNumber: '26카2678',
    customer: '김수현',
    issue: '냉각수 온도 과열',
    dueDate: '2025-02-20',
    priority: 'high',
    status: 'in-progress',
    assignee: '송중기',
  },

  // 7. 정기점검 (8건)
  {
    id: 'ACT022',
    category: '정기점검',
    vehicleNumber: '77사7777',
    customer: '-',
    issue: '정기점검 예정 (1일 후)',
    dueDate: '2025-02-23',
    priority: 'high',
    status: 'pending',
    assignee: '송혜교',
  },
  {
    id: 'ACT023',
    category: '정기점검',
    vehicleNumber: '27카2789',
    customer: '-',
    issue: '정기점검 예정 (2일 후)',
    dueDate: '2025-02-24',
    priority: 'medium',
    status: 'pending',
    assignee: '공유',
  },
  {
    id: 'ACT024',
    category: '정기점검',
    vehicleNumber: '28카2890',
    customer: '-',
    issue: '정기점검 예정 (3일 후)',
    dueDate: '2025-02-25',
    priority: 'medium',
    status: 'pending',
    assignee: '이민호',
  },
  {
    id: 'ACT025',
    category: '정기점검',
    vehicleNumber: '29카2901',
    customer: '-',
    issue: '정기점검 예정 (4일 후)',
    dueDate: '2025-02-26',
    priority: 'low',
    status: 'pending',
    assignee: '박보검',
  },
  {
    id: 'ACT026',
    category: '정기점검',
    vehicleNumber: '30카3012',
    customer: '-',
    issue: '정기점검 예정 (5일 후)',
    dueDate: '2025-02-27',
    priority: 'low',
    status: 'pending',
    assignee: '수지',
  },
  {
    id: 'ACT027',
    category: '정기점검',
    vehicleNumber: '31카3123',
    customer: '-',
    issue: '정기점검 예정 (6일 후)',
    dueDate: '2025-02-28',
    priority: 'low',
    status: 'pending',
    assignee: '아이유',
  },
  {
    id: 'ACT028',
    category: '정기점검',
    vehicleNumber: '32카3234',
    customer: '-',
    issue: '정기점검 예정 (7일 후)',
    dueDate: '2025-03-01',
    priority: 'low',
    status: 'pending',
    assignee: '임윤아',
  },
  {
    id: 'ACT029',
    category: '정기점검',
    vehicleNumber: '33카3345',
    customer: '-',
    issue: '정기점검 예정 (8일 후)',
    dueDate: '2025-03-02',
    priority: 'low',
    status: 'pending',
    assignee: '유재석',
  },

  // 8. 보험 만료 임박 (3건)
  {
    id: 'ACT030',
    category: '보험 만료 임박',
    vehicleNumber: '88아8888',
    customer: '-',
    issue: '보험 만료 6일 전',
    dueDate: '2025-02-28',
    priority: 'high',
    status: 'pending',
    assignee: '강호동',
    description: '보험 갱신 필요',
  },
  {
    id: 'ACT031',
    category: '보험 만료 임박',
    vehicleNumber: '34카3456',
    customer: '-',
    issue: '보험 만료 10일 전',
    dueDate: '2025-03-04',
    priority: 'medium',
    status: 'pending',
    assignee: '신동엽',
  },
  {
    id: 'ACT032',
    category: '보험 만료 임박',
    vehicleNumber: '35카3567',
    customer: '-',
    issue: '보험 만료 15일 전',
    dueDate: '2025-03-09',
    priority: 'low',
    status: 'pending',
    assignee: '김구라',
  },
];

// =====================================================
// 예약 데이터 (50건)
// =====================================================
const BASE_DATE = new Date(2025, 1, 22); // 2025-02-22

export const reservations: Reservation[] = [
  // 오늘 예약 (5건)
  ...Array.from({ length: 5 }, (_, i) => {
    const startDate = new Date(BASE_DATE);
    startDate.setDate(startDate.getDate() + 0); // 오늘
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3);
    
    return {
      id: `RSV${String(i + 1).padStart(3, '0')}`,
      vehicleNumber: vehicleAssets[i + 10].vehicleNumber,
      customer: ['김철수', '이영희', '박민수', '정수진', '최동욱'][i],
      startDate: 0,
      endDate: 3,
      type: 'reservation' as const,
      phone: `010-${String(1000 + i).padStart(4, '0')}-${String(1000 + i).padStart(4, '0')}`,
      paymentMethod: ['카드', '현금', '계좌이체'][i % 3] as '카드' | '현금' | '계좌이체',
      amount: `${300 + i * 50},000원`,
      deposit: '100,000원',
      paymentStatus: '대기',
      startDateFull: startDate.toISOString().split('T')[0],
      endDateFull: endDate.toISOString().split('T')[0],
    };
  }),
  
  // 오늘 대여 (3건)
  ...Array.from({ length: 3 }, (_, i) => {
    const startDate = new Date(BASE_DATE);
    startDate.setDate(startDate.getDate() + 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
    
    return {
      id: `RNT${String(i + 1).padStart(3, '0')}`,
      vehicleNumber: vehicleAssets[i + 15].vehicleNumber,
      customer: ['강민호', '윤서연', '조현우'][i],
      startDate: 0,
      endDate: 5,
      type: 'rental' as const,
      phone: `010-${String(2000 + i).padStart(4, '0')}-${String(2000 + i).padStart(4, '0')}`,
      paymentMethod: ['카드', '계좌이체', '카드'][i] as '카드' | '현금' | '계좌이체',
      amount: `${400 + i * 50},000원`,
      deposit: '200,000원',
      paymentStatus: '완료',
      startDateFull: startDate.toISOString().split('T')[0],
      endDateFull: endDate.toISOString().split('T')[0],
    };
  }),
  
  // 오늘 반납 (2건)
  ...Array.from({ length: 2 }, (_, i) => {
    const endDate = new Date(BASE_DATE);
    endDate.setDate(endDate.getDate() + 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
    
    return {
      id: `RTN${String(i + 1).padStart(3, '0')}`,
      vehicleNumber: vehicleAssets[i + 18].vehicleNumber,
      customer: ['한지민', '백승호'][i],
      startDate: -7,
      endDate: 0,
      type: 'return' as const,
      phone: `010-${String(3000 + i).padStart(4, '0')}-${String(3000 + i).padStart(4, '0')}`,
      paymentMethod: ['현금', '계좌이체'][i] as '카드' | '현금' | '계좌이체',
      amount: `${350 + i * 50},000원`,
      deposit: '150,000원',
      paymentStatus: '완료',
      startDateFull: startDate.toISOString().split('T')[0],
      endDateFull: endDate.toISOString().split('T')[0],
    };
  }),
  
  // 나머지 예약들 (40건)
  ...Array.from({ length: 40 }, (_, i) => {
    const daysOffset = (i % 10) + 1;
    const startDate = new Date(BASE_DATE);
    startDate.setDate(startDate.getDate() + daysOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (3 + (i % 5)));
    
    return {
      id: `RSV${String(i + 100).padStart(3, '0')}`,
      vehicleNumber: vehicleAssets[i + 10].vehicleNumber,
      customer: ['홍길동', '김민재', '이강인', '황희찬', '황의조'][i % 5],
      startDate: daysOffset,
      endDate: daysOffset + (3 + (i % 5)),
      type: 'reservation' as const,
      phone: `010-${String(4000 + i).padStart(4, '0')}-${String(4000 + i).padStart(4, '0')}`,
      paymentMethod: ['카드', '현금', '계좌이체'][i % 3] as '카드' | '현금' | '계좌이체',
      amount: `${300 + (i % 10) * 30},000원`,
      deposit: '100,000원',
      paymentStatus: ['대기', '완료', '미납', '부분납부'][i % 4] as '대기' | '완료' | '미납' | '부분납부',
      startDateFull: startDate.toISOString().split('T')[0],
      endDateFull: endDate.toISOString().split('T')[0],
    };
  }),
];

// =====================================================
// 오늘 할 일 통계 계산 함수
// =====================================================
export function getTodayStats() {
  const today = new Date(2025, 1, 22); // 2025-02-22
  const todayStr = today.toISOString().split('T')[0];
  
  // 오늘 예약 시작
  const todayReservations = reservations.filter(r => 
    r.type === 'reservation' && r.startDateFull === todayStr
  ).length;
  
  // 오늘 대여 시작
  const todayRentals = reservations.filter(r => 
    r.type === 'rental' && r.startDateFull === todayStr
  ).length;
  
  // 오늘 반납 예정
  const todayReturns = reservations.filter(r => 
    r.endDateFull === todayStr
  ).length;
  
  return [
    { label: '오늘 예약', count: todayReservations, icon: 'Calendar', filter: 'reservation' },
    { label: '오늘 대여', count: todayRentals, icon: 'FileText', filter: 'rental' },
    { label: '오늘 반납', count: todayReturns, icon: 'Clock', filter: 'return' },
  ];
}
