# 3단계: BE 개발 계획 (Legacy BE 개선 중심)

## 1. 목표
- `Project_Prometheus_BE`를 기반으로 현재 FE가 실제 데이터로 정상 동작하도록 백엔드를 확장/정비한다.
- 기존 레거시 FE 호환성은 유지하되, 현재 FE용 API 계약을 안정적으로 제공한다.

## 2. 레거시 BE 현황 요약

### 2.1 강점 (재사용 가능)
- 인증/회원/권한: `/auth`, `/members`
- 자산/렌탈 도메인: `/assets`, `/rentals`, `/dashboard`
- 파일/OCR: `/uploads/*`, `/ocr/*`
- 운영 부가: `/terminal-requests`, `/support/tickets`, `/geofences`
- 멀티테넌시 가드: `g.current_user.companyId` 기반 필터링
- 계약 상태머신: `services/contract_state_machine.py`
- 테스트 베이스 존재: `tests/api`, `tests/services`, `tests/storage`

### 2.2 현재 FE 관점의 공백
- 현재 FE 전용 응답 스키마 부재 (`vehicleNumber`, `ActionItem`, `Payment` 구조 등)
- 결제 도메인 전용 API 부재 (`/payments` 없음)
- 조치 필요 항목 조회/해결 API 부재 (`/issues`는 create only)
- 매출 API 부재 (`/revenue` 엔드포인트 실구현 없음)
- 디바이스 장착 작업(사진/시리얼/검증) 전용 API 부재
- CSV 대량 반영(import/export) API 부재

## 3. 개발 전략

### 3.1 호환성 전략
- 레거시 엔드포인트는 유지.
- 현재 FE용 `v2` 계층(또는 BFF)을 추가해 스키마 변환을 백엔드에서 흡수.
- 권장 prefix: `/api/v2/...`

### 3.2 데이터 변환 원칙
- 내부 저장 모델은 레거시 구조를 최대한 유지(리스크 최소화).
- FE 전달 모델은 화면 친화형 DTO로 분리.
- 변환 함수 위치:
  - `server/api/v2/serializers.py`
  - `server/api/v2/parsers.py`

## 4. API 워크스트림 설계

### 4.1 인증/세션
- [ ] `POST /api/v2/auth/login`
- [ ] `GET /api/v2/auth/me`
- [ ] `POST /api/v2/auth/logout` (토큰 무효화 정책 반영)

### 4.2 홈/대시보드
- [ ] `GET /api/v2/home/summary`
  - 오늘 예약/대여/반납 카운트
  - 상태이상 카테고리 카운트
  - 자산/계약 분포

### 4.3 자산
- [ ] `GET /api/v2/assets`
- [ ] `GET /api/v2/assets/:id`
- [ ] `POST /api/v2/assets`
- [ ] `PATCH /api/v2/assets/:id`
- [ ] `GET /api/v2/assets/:id/history` (예약/진단/메모 통합)

### 4.4 예약/계약
- [ ] `GET /api/v2/reservations`
- [ ] `POST /api/v2/reservations`
- [ ] `PATCH /api/v2/reservations/:id` (반납/취소/상태변경 포함)
- [ ] `POST /api/v2/reservations/:id/accident`

### 4.5 조치 필요 항목
- [ ] `GET /api/v2/action-items`
- [ ] `PATCH /api/v2/action-items/:id/status`
- [ ] `POST /api/v2/action-items/:id/memos`

### 4.6 결제/미납
- [ ] `GET /api/v2/payments`
- [ ] `PATCH /api/v2/payments/:id`
- [ ] `GET /api/v2/payments/unpaid-summary`

### 4.7 매출
- [ ] `GET /api/v2/revenue/summary?period=weekly|monthly|yearly`
- [ ] `GET /api/v2/revenue/charts`

### 4.8 설정/운영
- [ ] `GET/PATCH /api/v2/company`
- [ ] `GET/POST/PATCH/DELETE /api/v2/geofences`
- [ ] `GET/PATCH /api/v2/users` (필요 범위로 제한)
- [ ] `POST /api/v2/import/assets`, `POST /api/v2/import/reservations`

### 4.9 파일/OCR/장착
- [ ] `POST /api/v2/uploads/sign`
- [ ] `POST /api/v2/ocr/extract`
- [ ] `GET /api/v2/device-installations/tasks`
- [ ] `POST /api/v2/device-installations`

## 5. DB/모델 변경 계획

### 5.1 신규/확장 컬렉션
- [ ] `payments` 컬렉션 신설
- [ ] `action_items` 컬렉션 신설(또는 issues 확장 + 조회 인덱스 보강)
- [ ] `device_installations` 컬렉션 신설
- [ ] `notifications` 컬렉션(선택)

### 5.2 인덱스
- [ ] `companyId + dueDate + status` (payments)
- [ ] `companyId + category + status + dueDate` (action_items)
- [ ] `companyId + vehicleNumber + createdAt` (device_installations)

### 5.3 마이그레이션
- [ ] 기존 `vehicles.rental` 구조에서 결제/조치 데이터 추출 스크립트 작성
- [ ] 무중단 배포를 위한 backward-compatible migration (읽기 우선)

## 6. 권한/보안 계획
- [ ] role 정책 정합화 (`super_admin/admin/member/installer`)
- [ ] installer 권한을 현재 FE 단말 장착 흐름에 맞게 세분화
- [ ] 멀티테넌시 필터 강제(모든 v2 endpoint)
- [ ] 감사 로그(누가 어떤 상태를 바꿨는지) 저장

## 7. 테스트 전략

### 7.1 단위 테스트
- serializer/parser 변환 테스트
- 상태 전환/미납 계산 규칙 테스트

### 7.2 API 통합 테스트
- 인증 성공/실패/권한 오류
- 자산/예약/조치/결제 CRUD + 테넌시 격리
- 업로드/OCR 실패 케이스

### 7.3 회귀 테스트
- 레거시 endpoint smoke test 유지
- camelCase 응답 강제 테스트 유지/확장

## 8. 실행 단계 (권장 순서)
1. P0 기반 구축: v2 라우팅/공통 응답/에러/권한 미들웨어
2. 읽기 API 우선: home/assets/reservations/action-items/payments/revenue 조회
3. 쓰기 API: 자산 수정, 계약 상태변경, 이슈 처리, 결제 반영
4. 파일/OCR/장착/설정 import 기능 추가
5. 테스트/성능/배포 자동화 정리

## 9. Step 3 완료 기준 (DoD)
- 현재 FE 화면에서 필요한 모든 도메인에 대해 최소 1개 이상의 읽기/쓰기 경로가 확보된다.
- 멀티테넌시/권한/응답 스키마가 일관되게 강제된다.
- FE 연동 단계에서 mock 제거가 가능한 수준의 API 계약과 테스트가 준비된다.
