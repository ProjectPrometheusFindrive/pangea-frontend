# SCRUM-184 Premium CTA Routing Design

## Goal

홈 프리미엄 모달, 레이아웃 배너, 차량 상세 모달에 남아 있는 `alert('프리미엄 문의: 1588-XXXX')` 흐름을 제거하고, 실제 문의 경로로 연결한다.
추가로 홈 대시보드의 `단말 OFF` 카드에 남아 있는 `count: 0` 하드코딩을 정리해 프리미엄 데이터 부재를 명시적으로 드러낸다.

## Problem Summary

- 프리미엄 CTA가 모두 placeholder 전화번호 `1588-XXXX` alert에 묶여 있어 실제 문의 접수가 불가능하다.
- `/device-installation`은 설치 기사 전용 라우트라 렌터카 사업자 문의 진입점으로 부적절하다.
- `/support-center`는 렌터카 사업자가 이미 접근 가능한 실제 문의 채널이지만, 프리미엄 문의용 초기값 프리필이 없다.
- 홈의 `단말 OFF` 카드는 데이터 연동 없이 `0`을 고정 출력해, 실제로 데이터가 0건인지 아직 제공되지 않는지 구분되지 않는다.

## Chosen Approach

### Routing

- 프리미엄 문의 CTA의 공통 목적지는 `/support-center`로 통일한다.
- CTA별 맥락은 `location.state`로 전달한다.
  - category: `프리미엄 단말 문의`
  - title/content: CTA 위치에 따라 다른 기본 문구

### Shared CTA helper

- 프리미엄 문의 이동 로직을 공통 helper로 추출한다.
- `Home`, `Layout`, `VehicleDetailModal`은 이 helper만 호출하고 각자 `alert`를 보유하지 않는다.
- helper는 `useNavigate`를 받는 hook 형태로 두어 화면별 중복 라우팅 구성을 제거한다.

### Support Center prefill

- `SupportCenter`는 첫 진입 시 `location.state`를 읽어 문의 폼을 프리필한다.
- 프리필은 사용자가 직접 수정할 수 있으며, 이미 입력 중인 값은 불필요하게 덮어쓰지 않는다.
- 카테고리 목록에 프리필 값이 없더라도 직접 입력 모드로 진입해 값이 유지되도록 한다.

### Home premium card fallback

- `단말 OFF` 카드는 숫자 `0` 대신 데이터 부재를 명시하는 표시로 바꾼다.
- 클릭 동작은 유지하되, "현재 데이터 없음"이라는 의미가 분명하도록 카드 설명과 값 표시를 조정한다.
- 기존 `도난 분실` 카드와 프리미엄 모달 구조는 유지한다.

## Scope

- `src/app/pages/Home.tsx`
- `src/app/components/Layout.tsx`
- `src/app/components/VehicleDetailModal.tsx`
- `src/app/pages/SupportCenter.tsx`
- `src/app/...` 신규 프리미엄 문의 helper 1개
- `e2e/home.spec.ts`
- `e2e/support-center.spec.ts`

## Testing Strategy

- Playwright 회귀 테스트를 먼저 추가한다.
- 홈 테스트:
  - `단말 OFF` 카드가 숫자 `0`이 아닌 데이터 부재 상태로 보이는지 확인
  - 홈 프리미엄 CTA가 `/support-center`로 이동하는지 확인
- 고객센터 테스트:
  - 프리필 state로 진입 시 카테고리/제목/내용이 자동 채워지는지 확인
- 검증:
  - `npm.cmd run test:e2e -- e2e/home.spec.ts`
  - `npm.cmd run test:e2e -- e2e/support-center.spec.ts`
  - `npm.cmd run build`
