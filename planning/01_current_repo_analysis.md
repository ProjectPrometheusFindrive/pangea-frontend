# 1단계: 현재 레포 분석 (구조/아키텍처)

## 1. 목적
- 현재 레포(`pangea-front`)의 프론트엔드 구조와 데이터 흐름을 정확히 파악한다.
- "정상 동작" 기준에서 즉시 보완이 필요한 기술적 공백을 식별한다.

## 2. 현재 레포 구조 요약

### 루트
- `src/`: 현재 버전 FE 소스
- `_legacy/Project_Prometheus_FE`: 이전 FE
- `_legacy/Project_Prometheus_BE`: 이전 BE
- 문서: `DEVELOPER_GUIDE.md`, `USER_MANUAL_FOR_PPT.md`

### 현재 FE 핵심 디렉터리
- `src/app/pages`: `Home`, `ActionRequired`, `Assets`, `Reservations`, `Revenue`, `Settings`, `DeviceInstallation`
- `src/app/components`: `Layout`, `NewContractModal`, `VehicleDetailModal`, `AccidentReportModal` 등
- `src/app/context`: `AuthContext.tsx` (단일 로컬 상태)
- `src/app/data/mockData.ts`: 차량/예약/조치항목 핵심 mock 데이터
- `src/app/utils`: `paymentUtils.ts`, `issueUtils.ts`

## 3. 아키텍처 분석

### 3.1 라우팅
- `createBrowserRouter` 기반 단순 페이지 라우팅.
- 인증 가드/권한 가드 없음.
- 라우트:
  - `/`, `/action-required`, `/assets`, `/reservations`, `/revenue`, `/settings`, `/device-installation`

### 3.2 상태 관리
- 전역 상태는 사실상 `AuthContext` 하나이며, 기본 사용자 하드코딩.
- 각 페이지는 로컬 `useState/useMemo` 중심.
- 서버 동기화 상태(loading/error/retry/stale) 관리 체계 없음.

### 3.3 데이터 계층
- API 클라이언트 레이어 부재 (`src/api` 없음).
- 페이지/컴포넌트가 직접 `mockData.ts`와 유틸 mock(`mockPayments`)를 사용.
- 실제 네트워크 호출(`fetch/axios`) 거의 없음.

### 3.4 권한/인증
- `AuthContext` 사용자/역할이 메모리 내 고정.
- 토큰 저장, 세션 복원, 만료 처리, 로그아웃 API 연동 없음.

### 3.5 파일/OCR/외부 연동
- OCR, 업로드, 지오펜스, 단말 설치 신청, 고객센터 접수는 `alert`, `setTimeout`, 로컬 상태로 시뮬레이션.
- 실제 저장소(GCS), OCR API, 메일/팩스 연동 없음.

## 4. 페이지별 기능과 현재 데이터 소스

### Home
- 차량 상태/계약 통계/조치항목 집계.
- 소스: `vehicleAssets`, `reservations`, `actionItems`, `mockPayments`.

### ActionRequired
- 카테고리별 이슈 목록, 검색/정렬, 메모 추가, 해결 처리.
- 소스: `actionItems` + `mockPayments`.
- 해결 처리도 로컬 `Set`으로만 반영.

### Assets
- 자산 목록/필터/검색/상세, 차량 등록(OCR 시뮬레이션), 보험/점검 수정.
- 소스: `mockVehicleAssets`.
- 등록/수정/서류업로드 모두 로컬 상태 + 알림.

### Reservations
- 캘린더형 예약/대여/반납 뷰, 새 계약 모달, 반납 처리, 사고 등록.
- 소스: `mockReservations`, `mockVehicleAssets`.
- 반납/사고 등록은 로컬 반영 또는 TODO 상태.

### Revenue
- 차트/지표 대부분 하드코딩된 배열 데이터 + 일부 미납 통계.

### Settings
- CSV 업/다운로드, 지오펜스/계정 관리 탭 UI.
- 실제 서버 반영 없음.

### DeviceInstallation
- 장착 대기/완료 상태, 사진 업로드, 시리얼 검증.
- 로컬 데이터만 변경.

## 5. 기술 리스크 (정상 동작 관점)

### P0 리스크
- API 계층 부재로 서버 연동 불가.
- 인증/권한 체계 부재로 멀티테넌시/보안 요구 충족 불가.
- 핵심 업무 데이터(자산/계약/결제/이슈) 영속성 없음.
- 현재 날짜/통계가 고정값(2025/2026 기준 하드코딩)이라 운영 데이터 왜곡.

### P1 리스크
- 페이지별 데이터 모델이 레거시 BE 계약과 직접 불일치(예: `vehicleNumber` vs `plate/vin`, 계약 상태 체계 차이).
- 에러 처리/재시도/로딩 상태 표준화가 없어 통합 시 장애 대응 난이도 높음.

### P2 리스크
- 테스트 코드 부재로 회귀 리스크 높음.
- 운영 로깅/관측 포인트 부재.

## 6. 정상 동작을 위한 선결 작업 (체크리스트)

- [ ] FE API/BFF 계층 설계 (`src/services` 또는 `src/api`)
- [ ] 인증/세션/권한 컨텍스트 재구성 (JWT + role + companyId)
- [ ] mock 데이터 의존 제거 및 서버 데이터 주도 렌더링 전환
- [ ] 자산/예약/이슈/결제/매출 도메인별 타입 계약 정의
- [ ] 파일 업로드/OCR/알림/지오펜스 연동 경로 확정
- [ ] 날짜/통계 계산 로직을 실제 시간/서버 데이터 기반으로 변경

## 7. 완료 기준 (Step 1 DoD)
- 현재 FE의 구조, 데이터 흐름, 리스크가 문서화되어 후속 단계(차이 분석/BE 설계) 입력으로 사용 가능하다.
- 페이지별로 "어떤 API/DB 데이터가 필요한지" 추적 가능한 수준의 분석이 완료된다.

