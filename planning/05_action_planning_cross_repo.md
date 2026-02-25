# 5단계: Action Planning (FE 레포 + BE 레포 실행 순서)

## 1. 목적
- 실제 개발 착수 시 혼선 없이 진행할 수 있도록, 작업 순서를 "의존성 기준"으로 고정한다.
- FE 레포(`pangea-front`)와 BE 레포(`Project_Prometheus_BE`)의 할 일을 분리하되, 동기화 포인트를 명확히 한다.

## 2. 권장 진행 원칙
- 원칙 1: API 계약을 먼저 고정하고 UI 연결을 시작한다.
- 원칙 2: 페이지 단위가 아니라 "수직 슬라이스(조회+수정+검증)" 단위로 끝낸다.
- 원칙 3: mock 제거는 단계적으로 하되, phase 종료 시 해당 범위 mock은 완전히 제거한다.

## 3. 전체 실행 순서

1. Phase A: 계약 고정 (공통)
2. Phase B: 기반 구축 (BE 우선, FE 병행)
3. Phase C: Core 도메인 1차 연동 (자산/예약/조치)
4. Phase D: Core 도메인 2차 연동 (매출/설정/권한)
5. Phase E: 확장 기능 연동 (OCR/업로드/단말/고객센터)
6. Phase F: 통합 QA 및 운영 전환

## 4. Phase별 액션 플랜

## Phase A. 계약 고정

### FE 레포에서 할 일 (`pangea-front`)
- [ ] 화면별 필요한 데이터 필드 목록 고정 (`Home`, `Assets`, `Reservations`, `ActionRequired`, `Revenue`, `Settings`, `DeviceInstallation`)
- [ ] 현재 FE 타입 정의를 API DTO 기준으로 분리 초안 작성 (`view model` vs `api model`)
- [ ] 기존 mock 의존 지점 목록화 및 제거 순서 확정

### BE 레포에서 할 일 (`Project_Prometheus_BE`)
- [ ] v2 API 범위 확정 (`/api/v2/...` 권장)
- [ ] endpoint/요청/응답 스키마 문서화
- [ ] role/tenant 규칙 문서화 (`super_admin/admin/member/installer`)

### 동기화 체크포인트
- [ ] FE/BE가 동일한 용어를 사용하도록 사전 확정 (`vehicleNumber`, `vin`, `plate`, `contractStatus`)

## Phase B. 기반 구축

### FE 레포에서 할 일
- [ ] `src/api` 또는 `src/services` 계층 생성
- [ ] 공통 HTTP 클라이언트(토큰 주입, 에러 표준화, timeout, retry) 구현
- [ ] `AuthContext`를 JWT 세션 기반으로 교체
- [ ] `CompanyContext` 추가
- [ ] 페이지 공통 로딩/에러/빈 상태 컴포넌트 도입

### BE 레포에서 할 일
- [ ] v2 라우팅 스켈레톤 생성
- [ ] 공통 응답 래퍼/에러 포맷 통일
- [ ] 인증 미들웨어 + tenant guard v2 적용
- [ ] 필수 인덱스/컬렉션 준비 (`payments`, `action_items`, `device_installations`)

### 동기화 체크포인트
- [ ] 로그인 + `/me`까지 E2E 확인

## Phase C. Core 1차 연동

### FE 레포에서 할 일
- [ ] `Assets` 조회/상세/수정 API 연결
- [ ] `Reservations` 조회/등록/반납/사고등록 API 연결
- [ ] `ActionRequired` 조회/상태변경/메모 API 연결
- [ ] 해당 화면 mock import 제거

### BE 레포에서 할 일
- [ ] `assets` v2 조회/수정 API 완성
- [ ] `reservations/rentals` v2 조회/쓰기 API 완성
- [ ] `action-items` v2 조회/상태/메모 API 완성
- [ ] 계약 상태 전환 규칙(상태머신) v2 연결

### 동기화 체크포인트
- [ ] 시나리오 검증: 차량 상세 수정 -> 예약 생성 -> 반납/사고 -> 조치항목 반영

## Phase D. Core 2차 연동

### FE 레포에서 할 일
- [ ] `Home` 대시보드 집계 API 연결
- [ ] `Revenue` 하드코딩 차트 제거 후 서버 집계 연결
- [ ] `Settings` 회사/지오펜스/계정 관련 쓰기 연결

### BE 레포에서 할 일
- [ ] `home/summary` 또는 dashboard v2 집계 API 제공
- [ ] `revenue` v2 API 제공
- [ ] `company/geofences/members` v2 관리 API 정리

### 동기화 체크포인트
- [ ] 시나리오 검증: 계약/결제 변경 시 홈/매출 지표 반영

## Phase E. 확장 기능 연동

### FE 레포에서 할 일
- [ ] OCR 업로드 플로우를 실제 API로 전환 (`Assets`, `NewContractModal`)
- [ ] `PremiumBanner` CTA를 단말 신청 API로 연결
- [ ] 고객센터 UI(신규 또는 Settings 탭) 연결
- [ ] 장착 작업(DeviceInstallation) 서버 저장 연결

### BE 레포에서 할 일
- [ ] `uploads/sign`, `ocr/extract` v2 안정화
- [ ] `terminal-requests` v2 또는 기존 endpoint 호환 확정
- [ ] `support/tickets` v2 또는 기존 endpoint 호환 확정
- [ ] 장착 작업 API(`device-installations`) 구현

### 동기화 체크포인트
- [ ] 시나리오 검증: 파일 업로드 -> OCR 제안 -> 저장 -> 장착신청/문의접수 성공

## Phase F. 통합 QA + 운영 전환

### FE 레포에서 할 일
- [ ] mock 완전 제거
- [ ] 에러 핸들링/권한별 접근/빈 상태 UX 점검
- [ ] 주요 플로우 E2E 테스트 추가

### BE 레포에서 할 일
- [ ] API 통합 테스트 보강
- [ ] 테넌시/권한 회귀 테스트
- [ ] 배포 설정 점검(환경변수, CORS, 업로드 권한)

### 동기화 체크포인트
- [ ] UAT 시나리오 통과 후 운영 배포 승인

## 5. 병렬 작업 가이드

- FE 선행 가능:
  - API client 스캐폴딩
  - 상태/에러 컴포넌트 정비
  - mock 제거 대상 코드 분리

- BE 선행 가능:
  - v2 라우트/DTO/인덱스
  - 인증/권한/테넌시 테스트

- 반드시 동기화 후 착수:
  - DTO 필드명 고정 전 화면 바인딩 작업
  - 상태머신 전환 로직 연동

## 6. "지금 당장" 시작 순서 (실행용)

1. FE/BE 공통 API 계약서 1차 고정
2. BE: `auth/me`, `assets list/detail`, `reservations list/create` v2 오픈
3. FE: `AuthContext` 교체 + `Assets/Reservations` API 연결
4. BE: `action-items`, `payments`, `revenue` 오픈
5. FE: `ActionRequired/Home/Revenue` 연결
6. 확장 기능(OCR/장착/문의) 연결 후 mock 제거 완료
