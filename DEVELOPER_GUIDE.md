# 렌터카 사업 운영 관리 SaaS 개발 문서

> **작성일:** 2026년 2월 24일  
> **버전:** v2.0  
> **대상:** 개발팀

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [핵심 개념](#핵심-개념)
5. [데이터 모델](#데이터-모델)
6. [주요 컴포넌트](#주요-컴포넌트)
7. [라우팅 구조](#라우팅-구조)
8. [유틸리티 함수](#유틸리티-함수)
9. [결제 상태 관리](#결제-상태-관리)
10. [권한 관리 시스템](#권한-관리-시스템)
11. [단말 장착 관리](#단말-장착-관리)
12. [개발 가이드](#개발-가이드)
13. [코딩 컨벤션](#코딩-컨벤션)

---

## 🎯 프로젝트 개요

### 서비스 소개

한국 렌터카 사업자를 위한 **사업 운영 관리 SaaS 웹 대시보드**

### 핵심 기능

- ✅ **차량 자산 관리** - 100대 규모 차량 실시간 상태 관리
- ✅ **대여 예약 관리** - 캘린더 기반 드래그 앤 드롭 예약
- ✅ **조치 필요 항목** - 보험/점검 만료, 미납, 차량 이상 통합 관리
- ✅ **OCR 자동 전산화** - 차량등록증, 대여계약서 자동 입력
- ✅ **매출 요약** - 일/주/월/연 단위 매출 분석
- ✅ **프리미엄 서비스** - 차량 단말 센서 기반 실시간 모니터링
- ✅ **단말 장착 관리** - 단말 장착사 계정 및 장착 현황 관리 (v2.0 추가)
- ✅ **권한 기반 접근** - 사용자 역할별 메뉴 표시/숨김 (v2.0 추가)

### 비즈니스 모델 (Freemium)

- **무료:** 기본 ERP 기능 (차량/예약/매출 관리)
- **유료:** 차량 단말 장착 → 도난 감지, 차량 이상 알림, 실시간 센서 데이터

### 화면 설계

- **해상도:** Desktop 1440×900 기준
- **레이아웃:** 좌측 사이드바(240px) + 상단 탑바(56px) + 카드형 대시보드

---

## 🛠 기술 스택

### Frontend

| 기술             | 버전   | 용도                     |
| ---------------- | ------ | ------------------------ |
| **React**        | 18.3.1 | UI 프레임워크            |
| **TypeScript**   | Latest | 타입 안전성              |
| **React Router** | 7.13.0 | 클라이언트 사이드 라우팅 |
| **Tailwind CSS** | 4.1.12 | 스타일링                 |
| **Vite**         | 6.3.5  | 빌드 도구                |

### UI 라이브러리

| 라이브러리                 | 용도                                           |
| -------------------------- | ---------------------------------------------- |
| **Radix UI**               | Headless UI 컴포넌트 (Dialog, Select, Tabs 등) |
| **Lucide React**           | 아이콘                                         |
| **Recharts**               | 차트/그래프                                    |
| **Motion (Framer Motion)** | 애니메이션                                     |
| **React DnD**              | 드래그 앤 드롭                                 |
| **Material UI**            | 일부 고급 컴포넌트                             |
| **date-fns**               | 날짜 처리                                      |
| **PapaParse**              | CSV 파싱                                       |

---

## 📁 프로젝트 구조

```
/src
├── /app
│   ├── App.tsx                      # 메인 앱 (RouterProvider)
│   ├── routes.ts                    # 라우팅 설정
│   │
│   ├── /pages                       # 페이지 컴포넌트
│   │   ├── Home.tsx                 # 홈 (대시보드)
│   │   ├── ActionRequired.tsx       # 조치 필요 항목
│   │   ├── Assets.tsx               # 차량 자산
│   │   ├── Reservations.tsx         # 대여 예약 (캘린더)
│   │   ├── Revenue.tsx              # 매출 요약
│   │   ├── DeviceInstallation.tsx   # 단말 장착/관리 (v2.0 추가)
│   │   └── Settings.tsx             # 설정
│   │
│   ├── /components                  # 공통 컴포넌트
│   │   ├── Layout.tsx               # 레이아웃 (사이드바 + 탑바)
│   │   ├── NewContractModal.tsx     # 새 계약 등록 모달
│   │   ├── VehicleDetailModal.tsx   # 차량 상세 모달
│   │   ├── AccidentReportModal.tsx  # 사고 신고 모달
│   │   ├── PremiumBanner.tsx        # 프리미엄 안내 배너
│   │   └── /ui                      # Radix UI 기반 재사용 컴포넌트
│   │
│   ├── /data
│   │   └── mockData.ts              # 중앙 집중식 Mock 데이터
│   │
│   └── /utils
│       ├── issueUtils.ts            # 상태이상 관리 유틸
│       └── paymentUtils.ts          # 결제/미납 관리 유틸
│
└── /styles
    ├── index.css                    # 글로벌 스타일
    ├── theme.css                    # Tailwind 테마 토큰
    ├── fonts.css                    # 폰트 임포트
    └── tailwind.css                 # Tailwind 진입점
```

---

## 🔑 핵심 개념

### 1. 중앙 집중식 Mock 데이터 (`mockData.ts`)

- **모든 페이지에서 동일한 데이터 소스를 참조**하여 일관성 유지
- 차량 자산(100대), 예약(50개), 조치 필요 항목 등 포함
- 실제 백엔드 연동 시 API 호출로 대체 가능

### 2. 상태이상 관리 시스템

**8가지 카테고리:**

1. 보험 만료 임박
2. 정기점검 필요
3. 미납/결제 지연
4. 도난 의심 (프리미엄)
5. 차량 센서 이상 (프리미엄)
6. 반납 지연
7. 사고 발생
8. 과태료 미처리

### 3. 프리미엄 단말 기능

- `hasPremiumDevice: boolean` - 단말 장착 여부
- `deviceStatus: VehicleDeviceStatus` - 실시간 센서 데이터
  - 엔진 경고등, 배터리 전압, 오일 압력, 냉각수 온도, 타이어 공기압 등

### 4. 결제 상태 관리 (2026-02-20 추가)

- **수동 관리 방식** - PG 연동 없이 현장 결제 체크
- 4가지 상태: `대기` / `완료` / `미납` / `부분납부`
- 계약 등록 시 결제 상태 선택
- 예약 상세에서 결제 상태 변경 가능

### 5. 권한 관리 시스템 (2026-02-24 추가)

#### 개요 (v2.0 추가)

사용자 역할에 따라 메뉴와 기능에 대한 접근을 제어하는 시스템

#### 사용자 역할

| 역할           | 영문 코드           | 접근 가능 메뉴                                                          |
| -------------- | ------------------- | ----------------------------------------------------------------------- |
| **관리자**     | `admin`             | 모든 메뉴 접근 가능                                                     |
| **직원**       | `staff`             | 홈, 조치 필요 항목, 차량 자산, 대여 예약, 매출 요약, 설정               |
| **단말 장착사** | `device_installer` | 단말 장착/관리만 접근 가능 (홈, 설정 숨김)                              |

#### AuthContext 구조

**파일:** `/src/app/context/AuthContext.tsx`

```typescript
interface User {
  id: string;
  name: string;
  role: 'admin' | 'staff' | 'device_installer';
}

interface AuthContextType {
  user: User | null;
  login: (role: 'admin' | 'staff' | 'device_installer') => void;
  logout: () => void;
}
```

#### 권한 기반 메뉴 표시

**Layout.tsx에서 사용:**

```typescript
const { user } = useAuth();

// 단말 장착사는 홈과 설정을 볼 수 없음
const canViewHome = user?.role !== 'device_installer';
const canViewDeviceInstallation = user?.role !== 'staff';
```

#### 메뉴 표시 규칙

```typescript
// 홈, 조치 필요 항목, 차량 자산, 대여 예약, 매출 요약
{user?.role !== 'device_installer' && (
  <NavLink to="/">홈</NavLink>
)}

// 단말 장착/관리
{user?.role !== 'staff' && (
  <NavLink to="/device-installation">단말 장착/관리</NavLink>
)}

// 설정
{user?.role !== 'device_installer' && (
  <NavLink to="/settings">설정</NavLink>
)}
```

#### 사용 예시

```typescript
// 로그인 시 역할 설정
const { login } = useAuth();
login('device_installer'); // 단말 장착사로 로그인

// 현재 사용자 확인
const { user } = useAuth();
console.log(user?.role); // "device_installer"
```

### 6. 단말 장착 관리 (2026-02-24 추가)

#### 개요 (v2.0 추가)

단말 장착사가 차량에 단말을 장착하고 관리하는 전용 페이지

#### 주요 기능

##### 1️⃣ **한 줄 입력 폼**

단말 장착을 위한 모든 정보를 한 줄에 입력 가능

```
[차량번호 선택] [시리얼번호 입력] [📷 장착사진] [썸네일] [📷 시리얼사진] [썸네일] [⚡ 장착완료]
```

**필드:**
- 차량번호: 드롭다운 (장착 대기 중인 차량만 표시)
- 단말 시리얼 번호: 텍스트 입력 (자동 대문자 변환)
- 장착 사진: 파일 업로드 + 카메라 촬영 (필수 *)
- 시리얼 번호 사진: 파일 업로드 + 카메라 촬영 (필수 *)

##### 2️⃣ **이중 사진 업로드**

장착 현장과 단말 시리얼 번호를 각각 촬영/업로드

```typescript
// 상태 관리
const [installationPhotoFile, setInstallationPhotoFile] = useState<File | null>(null);
const [installationPhotoPreview, setInstallationPhotoPreview] = useState<string | null>(null);

const [serialPhotoFile, setSerialPhotoFile] = useState<File | null>(null);
const [serialPhotoPreview, setSerialPhotoPreview] = useState<string | null>(null);
```

**특징:**
- `capture="environment"` 속성으로 모바일에서 후면 카메라 자동 실행
- 업로드 즉시 미리보기 썸네일 표시
- 미리보기 클릭 시 새 창에서 큰 이미지로 확인

##### 3️⃣ **장착 현황 테이블**

| 차량번호  | 모델      | 시리얼 번호   | 장착일     | 장착사진 | 시리얼사진 | Health Check |
| --------- | --------- | ------------- | ---------- | -------- | ---------- | ------------ |
| 12가3456  | 소나타    | DEV-2024-001  | 2026-02-20 | [보기]   | [보기]     | ✅ 정상      |
| 34나5678  | 아반떼    | DEV-2024-002  | 2026-02-21 | [보기]   | [보기]     | ⚠️ 주의     |

**사진 보기 기능:**
- 장착사진 "보기" 링크 → 장착 현장 사진 팝업
- 시리얼사진 "보기" 링크 → 단말 시리얼 번호 사진 팝업

##### 4️⃣ **Health Check 정보**

단말 장착 후 상태 확인

```typescript
interface DeviceHealthCheck {
  status: 'healthy' | 'warning' | 'error';
  batteryLevel: number; // 배터리 잔량 (%)
  signalStrength: number; // 신호 강도 (0-5)
  lastPing: string; // 마지막 통신 시간
}
```

**표시 방식:**
- ✅ 정상 (초록색) - 모든 지표 정상
- ⚠️ 주의 (노란색) - 일부 지표 이상
- ❌ 오류 (빨간색) - 통신 불가

##### 5️⃣ **장착 완료 프로세스**

1. 차량번호 선택
2. 단말 시리얼 번호 입력
3. 장착 사진 촬영/업로드
4. 시리얼 번호 사진 촬영/업로드
5. "장착 완료" 버튼 클릭
6. 차량의 `installationStatus`가 `pending` → `completed`로 변경
7. 테이블에서 즉시 확인 가능

#### 데이터 모델

```typescript
interface DeviceInstallation {
  vehicleNumber: string;
  model: string;
  deviceSerial: string;
  installDate: string; // YYYY-MM-DD
  installationPhoto: string; // 장착 사진 URL
  serialPhoto: string; // 시리얼 번호 사진 URL
  installationStatus: 'pending' | 'completed';
  healthCheck?: DeviceHealthCheck;
}
```

#### 주요 컴포넌트

**파일:** `/src/app/pages/DeviceInstallation.tsx`

```typescript
export default function DeviceInstallation() {
  const [vehicles, setVehicles] = useState<DeviceInstallation[]>([]);
  const [selectedVehicleNumber, setSelectedVehicleNumber] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [installationPhotoFile, setInstallationPhotoFile] = useState<File | null>(null);
  const [serialPhotoFile, setSerialPhotoFile] = useState<File | null>(null);
  
  const handleInstallDevice = () => {
    // 장착 완료 처리
    // 사진 업로드 및 상태 변경
  };
  
  return (
    <Layout title="단말 장착/관리">
      {/* 입력 폼 */}
      {/* 장착 현황 테이블 */}
    </Layout>
  );
}
```

#### 카메라 촬영 기능

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"  {/* 모바일 후면 카메라 */}
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      setInstallationPhotoFile(file);
      setInstallationPhotoPreview(URL.createObjectURL(file));
    }
  }}
  id="photo-upload"
  className="hidden"
/>
```

#### 사진 보기 팝업

```typescript
const handleViewPhoto = (photoUrl: string, title: string) => {
  window.open(photoUrl, '_blank');
};
```

또는

```tsx
<button 
  onClick={() => setSelectedPhoto(photoUrl)}
  className="text-blue-600 hover:underline"
>
  보기
</button>

{/* 모달로 표시 */}
{selectedPhoto && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
    <img src={selectedPhoto} alt="확대 이미지" className="max-w-4xl max-h-[90vh]" />
  </div>
)}
```

---

## 📊 데이터 모델

### VehicleAsset (차량 자산)

```typescript
export interface VehicleAsset {
  vehicleNumber: string; // 차량번호 (예: "12가3456")
  model: string; // 차종
  status: "대여중" | "예약" | "가용" | "정비중";
  issues: string[]; // 상태이상 목록
  insuranceExpiry: string; // 보험 만료일 (YYYY-MM-DD)
  nextInspection: string; // 정기점검일 (YYYY-MM-DD)
  vin: string; // 차대번호
  year: string; // 연식
  owner: string; // 소유자
  hasPremiumDevice?: boolean; // 프리미엄 단말 장착 여부
  deviceStatus?: VehicleDeviceStatus; // 센서 데이터
}
```

### Reservation (예약/계약)

```typescript
export interface Reservation {
  id: string;
  vehicleNumber: string;
  customer: string;
  startDate: number; // 날짜 오프셋 (0부터 시작)
  endDate: number;
  type: "reservation" | "rental" | "return";
  issues?: string[];
  phone: string;
  paymentMethod: "카드" | "현금" | "계좌이체";
  amount: string; // 대여 요금
  deposit: string; // 선금
  paymentStatus: "대기" | "완료" | "미납" | "부분납부"; // 결제 상태
  startDateFull?: string; // 실제 날짜 (YYYY-MM-DD)
  endDateFull?: string;
}
```

### ActionItem (조치 필요 항목)

```typescript
export interface ActionItem {
  id: string;
  category: string; // 카테고리 (보험만료/정기점검 등)
  vehicleNumber: string;
  customer?: string;
  issue: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "resolved";
  assignee?: string;
  description?: string;
  memos?: MemoLog[];
}
```

### Payment (결제 정보)

```typescript
export interface Payment {
  id: string;
  reservationId: string;
  vehicleNumber: string;
  customerName: string;
  type: "예약금" | "본결제" | "추가정산" | "월렌트";
  amount: number;
  dueDate: string; // 결제 예정일
  paidDate?: string; // 실제 결제일
  status: "대기" | "완료" | "미납" | "부분납부";
  method: "카드" | "현금" | "계좌이체";
  description?: string;
}
```

### VehicleDeviceStatus (센서 데이터)

```typescript
export interface VehicleDeviceStatus {
  engineWarning: boolean; // 엔진 경고등
  batteryVoltage: number; // 배터리 전압 (정상: 12.5-14.5V)
  oilPressure: number; // 오일 압력 (정상: 25-65 PSI)
  coolantTemp: number; // 냉각수 온도 (정상: 85-105°C)
  tirePressure: [number, number, number, number]; // 타이어 공기압 (FL, FR, RL, RR)
  brakeFluid: number; // 브레이크액 잔량 (%)
  absWarning: boolean; // ABS 경고
  airbagWarning: boolean; // 에어백 경고
  transmissionTemp: number; // 변속기 온도 (정상: 80-100°C)
  fuelLevel: number; // 연료량 (%)
  lastUpdate: string; // 마지막 업데이트
}
```

---

## 🧩 주요 컴포넌트

### 1. Layout.tsx (레이아웃)

- **좌측 사이드바**: 6개 메뉴 네비게이션
- **상단 탑바**: 페이지 타이틀, 프리미엄 배너, 새 계약 등록 버튼
- 모든 페이지를 감싸는 공통 레이아웃

### 2. NewContractModal.tsx (계약 등록 모달)

**3단계 프로세스:**

1. **선택 확인** - 차량, 날짜, 시간 선택/확인
2. **고객 정보** - 이름, 연락처, 주민번호, 면허번호, 주소, 대여/반납 장소, 요금, 선금, 결제 방법, **결제 상태**
3. **서류 업로드** - 운전면허증, 대여계약서 (OCR 가능)

**특징:**

- 캘린더 드래그로 예약한 경우 자동으로 차량/날짜 입력
- 수동 입력도 지원
- **결제 상태 선택 필드 포함** (대기/완납/미납/부분납부)

### 3. VehicleDetailModal.tsx (차량 상세 모달)

- 차량 기본 정보 (차량번호, 모델, 연식, 차대번호, 소유자)
- 보험/점검 만료일
- **프리미엄 센서 데이터** 실시간 표시 (단말 장착 차량)
- 배터리, 오일, 냉각수, 타이어 공기압 등

### 4. AccidentReportModal.tsx (사고 신고 모달)

- 사고 차량, 고객, 사고 일시, 장소, 유형 입력
- 사고 내용 상세 설명

### 5. PremiumBanner.tsx (프리미엄 배너)

- 무료 사용자에게 프리미엄 기능 안내
- 단말 장착 유도

---

## 🗺 라우팅 구조

| 경로                   | 컴포넌트                 | 설명                                         | 권한                |
| ---------------------- | ------------------------ | -------------------------------------------- | ------------------- |
| `/`                    | `Home.tsx`               | 홈 대시보드 (오늘 할 일 + 8개 상태이상 카드) | 관리자, 직원        |
| `/action-required`     | `ActionRequired.tsx`     | 조치 필요 항목 목록                          | 관리자, 직원        |
| `/assets`              | `Assets.tsx`             | 차량 자산 관리 (100대)                       | 관리자, 직원        |
| `/reservations`        | `Reservations.tsx`       | 대여 예약 캘린더 (드래그 앤 드롭)            | 관리자, 직원        |
| `/revenue`             | `Revenue.tsx`            | 매출 요약 (일/주/월/연)                      | 관리자, 직원        |
| `/device-installation` | `DeviceInstallation.tsx` | 단말 장착/관리 (v2.0 추가)                   | 관리자, 단말 장착사 |
| `/settings`            | `Settings.tsx`           | 설정                                         | 관리자, 직원        |

**라우팅 설정 파일:** `/src/app/routes.ts`

```typescript
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/action-required", Component: ActionRequired },
  { path: "/assets", Component: Assets },
  { path: "/reservations", Component: Reservations },
  { path: "/revenue", Component: Revenue },
  { path: "/device-installation", Component: DeviceInstallation },
  { path: "/settings", Component: Settings },
]);
```

---

## 🔧 유틸리티 함수

### issueUtils.ts (상태이상 관리)

```typescript
// 차량의 이슈 수집
export function collectVehicleIssues(
  vehicle: VehicleAsset,
): string[];

// 심각도 판단
export function getIssueSeverity(
  issue: string,
): "High" | "Medium" | "Low";

// 이슈별 조치 필요 항목 생성
export function generateActionItems(
  vehicles: VehicleAsset[],
  reservations: Reservation[],
): ActionItem[];

// 카테고리별 필터링
export function getActionItemsByCategory(
  items: ActionItem[],
  category: string,
): ActionItem[];
```

### paymentUtils.ts (결제/미납 관리)

```typescript
// 연체 일수 계산
export function calculateOverdueDays(dueDate: string): number;

// 연체료 계산 (일 2% 복리)
export function calculateLateFee(
  amount: number,
  overdueDays: number,
): number;

// 미납 건 감지
export function getUnpaidPayments(
  payments: Payment[],
): Payment[];

// 심각도 분류
export function getPaymentSeverity(
  payment: Payment,
): "High" | "Medium" | "Low";

// 기간별 미납금 통계
export function getUnpaidStatsByPeriod(): UnpaidStatsByPeriod;
```

---

## 💳 결제 상태 관리

### 배경

- PG 결제 모듈 연동 없이 **현장 결제를 수동으로 관리**
- 렌터카 사업 특성상 카드 단말기, 현금, 계좌이체 등 다양한 결제 방식 존재

### 결제 상태 (4가지)

| 상태         | 설명                      | 사용 시나리오           |
| ------------ | ------------------------- | ----------------------- |
| **대기**     | 아직 결제 예정일 전       | 계약 등록 시 기본값     |
| **완료**     | 전액 결제 완료 (완납)     | 현장에서 결제 받은 경우 |
| **미납**     | 결제일 지났는데 결제 안됨 | 고객이 결제하지 않음    |
| **부분납부** | 일부만 결제됨             | 선금만 받고 잔금 미납   |

### 사용 흐름

#### 1️⃣ **계약 등록 시**

- `NewContractModal.tsx`의 **2단계 (고객 정보)** 에서 결제 상태 선택
- 드롭다운으로 4가지 상태 중 선택
- 기본값: `대기`

```typescript
const [paymentStatus, setPaymentStatus] = useState<
  "대기" | "완료" | "미납" | "부분납부"
>("대기");
```

#### 2️⃣ **조치 필요 항목에서 미납 감지**

- `paymentUtils.ts`의 `getUnpaidPayments()` 함수가 결제 상태 체크
- 연체 일수 자동 계산
- 연체료 자동 계산 (일 2% 복리)

#### 3️⃣ **예약 상세에서 결제 상태 변경** (향후 구현 예정)

- 예약 상세 모달에서 결제 상태 드롭다운 표시
- 상태 변경 시 실시간 업데이트

### 자동 미납 감지 로직

```typescript
export function getUnpaidPayments(
  payments: Payment[],
): Payment[] {
  return payments.filter((payment) => {
    if (payment.status === "완료") return false;
    const overdueDays = calculateOverdueDays(payment.dueDate);
    return overdueDays > 0;
  });
}
```

---

## 🚀 개발 가이드

### 개발 환경 설정

```bash
# 패키지 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 빌드
pnpm build
```

### 새 페이지 추가하기

1. `/src/app/pages/`에 새 페이지 컴포넌트 생성
2. `/src/app/routes.ts`에 라우트 추가
3. `Layout.tsx`의 사이드바에 메뉴 추가

```typescript
// routes.ts
import NewPage from "./pages/NewPage";

export const router = createBrowserRouter([
  // ... 기존 라우트
  { path: "/new-page", Component: NewPage },
]);
```

### Mock 데이터 수정하기

**중앙 집중식 데이터 관리:** `/src/app/data/mockData.ts`

```typescript
// 차량 추가
export const vehicleAssets: VehicleAsset[] = [
  {
    vehicleNumber: "99가9999",
    model: "테슬라 모델 3",
    status: "가용",
    // ...
  },
  // ...
];
```

### 새 상태이상 카테고리 추가하기

1. `issueUtils.ts`의 `collectVehicleIssues()` 수정
2. `ActionRequired.tsx`의 카테고리 필터에 추가
3. `Home.tsx`의 상태이상 카드에 추가

---

## 📝 코딩 컨벤션

### TypeScript

- **명명 규칙**
  - 컴포넌트: PascalCase (예: `NewContractModal.tsx`)
  - 함수/변수: camelCase (예: `calculateOverdueDays`)
  - 상수: UPPER_SNAKE_CASE (예: `BASE_DATE`)
  - 인터페이스: PascalCase (예: `VehicleAsset`)

### React 컴포넌트

- 함수형 컴포넌트 사용
- Props는 인터페이스로 정의
- Export는 named export 또는 default export

```typescript
interface MyComponentProps {
  title: string;
  onClose: () => void;
}

export function MyComponent({ title, onClose }: MyComponentProps) {
  return <div>{title}</div>;
}
```

### Tailwind CSS

- **유틸리티 클래스 사용**
- 커스텀 컬러는 `/src/styles/theme.css`에 정의
- 반응형: `sm:`, `md:`, `lg:` 접두사 사용

```tsx
<div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
  버튼
</div>
```

### 날짜 처리

- **기준 날짜:** 2025-02-20 (BASE_DATE)
- `date-fns` 라이브러리 사용
- 날짜는 `YYYY-MM-DD` 형식

```typescript
import { format, addDays } from "date-fns";

const baseDate = new Date(2025, 1, 20); // 2025-02-20
const tomorrow = addDays(baseDate, 1);
```

### 상태 관리

- `useState` 훅 사용
- 복잡한 상태는 여러 개로 분리
- Props drilling 최소화

---

## 🔐 보안 고려사항

### 개인정보 보호

- 주민번호, 면허번호는 암호화 저장 필요 (백엔드 구현 시)
- 고객 데이터는 최소한으로 수집

### 파일 업로드

- OCR 파일 업로드 시 파일 타입 검증
- 이미지 용량 제한 (5MB 이하 권장)

---

## 🐛 알려진 이슈 & TODO

### TODO

- [ ] 백엔드 API 연동
- [ ] 실제 OCR 구현 (Tesseract.js 또는 클라우드 OCR)
- [ ] 예약 상세 모달에서 결제 상태 변경 기능
- [ ] 사용자 인증/권한 관리
- [ ] 실시간 알림 시스템
- [ ] 차량 단말 연동 (WebSocket)

### 알려진 이슈

- Mock 데이터로 동작하므로 새로고침 시 데이터 초기화
- 드래그 앤 드롭 예약 시 시간대 겹침 검증 미구현

---

## 📞 연락처 & 참고 자료

### 팀 구성

- **프론트엔드 개발:** [팀원 이름]
- **백엔드 개발:** [팀원 이름]
- **PM/기획:** [팀원 이름]

### 참고 문서

- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [React Router 문서](https://reactrouter.com/)
- [Radix UI 문서](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)

---

**문서 작성:** AI Assistant  
**최종 업데이트:** 2026년 2월 24일