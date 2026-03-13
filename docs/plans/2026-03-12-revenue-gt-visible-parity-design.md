# Revenue GT Visible Parity Design

## Goal

`Revenue` 화면을 `Pangea_v2_v127`의 매출요약 화면과 시각적으로 같은 구조로 맞춘다. 현재 revenue summary/trend API와 집계 계산 로직은 최대한 유지하고, Chrome에서 사용자가 직접 보는 카드, 필터, 차트 제목, 범례, 표/보조 안내만 GT 기준으로 정렬한다.

## Scope

- 상단 KPI 카드, 기간/집계 필터, 차트 섹션, 보조 카드 또는 표, 빈 상태/오류 문구의 visible structure를 GT에 맞춘다.
- GT에 없는 도움말, 버튼, 안내 문구, placeholder section은 비노출하거나 GT 문구로 치환한다.
- GT에 있는 제목, 섹션 순서, 범례, 카드 이름, 보조 설명은 그대로 맞춘다.
- 현재 `getRevenueSummary`, `getRevenueTrend`, `settleRevenueHydration`, `dashboardCompanyScope` 흐름은 가능한 한 유지한다.

## Non-Goals

- revenue API 응답 구조를 GT 데이터 모델로 재설계하지 않는다.
- 백엔드가 주지 않는 분류를 프론트에서 새로 추정해 만들어내지 않는다.
- 수치 데이터 자체를 GT 샘플과 동일하게 맞추는 작업은 하지 않는다.
- 현재 company scope, refresh, error handling의 내부 로직을 이번 작업에서 재작성하지 않는다.

## Design Approach

### Option 1: Visible parity only

- 현재 API와 계산 로직은 유지하고, 사용자가 보는 UI 계층만 GT처럼 맞춘다.
- 장점: 가장 안전하고 빠르다.
- 단점: GT 내부 계산 모델과는 다를 수 있다.

### Option 2: Visible parity plus KPI remapping

- 카드 구조뿐 아니라 KPI 계산 분류와 차트 구성을 GT 의미 체계에 더 가깝게 재배치한다.
- 장점: 체감 일치도가 더 높다.
- 단점: API가 없는 정보를 프론트에서 과도하게 추정하게 될 수 있다.

### Recommendation

- 이번 작업은 Option 1로 진행한다.
- 요구사항이 “보이는 것만 GT와 같게”이므로, 화면 정합을 먼저 끝내고 데이터 분류는 현재 계약을 보존한다.

## Comparison Method

- `http://localhost:5173/revenue`와 GT 매출요약 화면을 Chrome에서 나란히 비교한다.
- 다음 항목을 기준으로 mismatch를 정리한다.
  - 상단 KPI 카드 순서와 제목
  - 기간 preset, granularity, refresh/reset, 회사 선택 노출 여부
  - 메인 차트 제목, 축 라벨, 범례, 보조 설명
  - 추가 요약 블록 또는 표의 제목/열/빈 상태
  - empty/error state copy

## Testing Strategy

- `Revenue.tsx`의 GT visible contract를 고정하는 전용 테스트를 추가한다.
- 기존 revenue copy/figma/empty-state tests와 충돌하는 경우 최소 범위로 갱신한다.
- 마지막에 브라우저 재확인과 production build를 수행한다.
