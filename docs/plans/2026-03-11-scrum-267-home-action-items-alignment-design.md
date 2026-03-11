# SCRUM-267 / SCRUM-288 Home Action Items Alignment Design

## Goal

홈 `관리해야 할 이슈` 카드의 숫자와 클릭 후 `조치 필요 항목` 상세 목록이 같은 기준을 사용하도록 정렬하고, 같은 구간의 Figma 8카드 레이아웃 parity를 복구한다.

## Current Gap

- Home은 `/api/v2/home/summary`의 `alerts.overdue`, `kpis.unpaidContracts`, `managementStage` 값을 직접 카드 숫자로 사용한다.
- Action Required는 `/api/v2/action-items`만 목록 소스로 사용한다.
- 따라서 같은 카드라도 Home 숫자와 상세 페이지 총합이 쉽게 어긋난다.
- Home issue grid는 desktop에서 `xl:grid-cols-3`로 렌더링되어 Figma의 4열 배치와 다르다.

## Approved Direction

- Home issue cards의 기준을 `action-items` 기준으로 통일한다.
- 카드 클릭 동선은 계속 `/action-required?filter=...`를 유지한다.
- Action Required는 상세 뷰 역할에 집중하고, Home은 같은 기준에서 집계된 카운트를 사용한다.
- 같은 변경에서 desktop issue grid를 4열로 복구한다.

## Implementation Shape

### Shared issue taxonomy

- Home과 Action Required가 공통으로 해석할 수 있는 issue type 정규화 로직을 둔다.
- 최소 범위는 `반납 지연`, `미납/결제 문제`, `정기점검 만료 임박`, `보험 만료 임박`, `사고 접수`, `차량이상`, `도난 의심`, `단말 OFF` 8종이다.

### Shared count source

- `action-items` payload에서 타입별 카운트를 계산하는 공통 집계 유틸을 만든다.
- Home에서는 summary 기반 숫자 대신 이 집계 결과를 issue card 숫자로 쓴다.
- 프리미엄/placeholder 카드(`차량이상`, `단말 OFF`)의 copy와 modal 동선은 유지하되, 집계 표시가 가능한 데이터는 그대로 반영할 수 있게 열어 둔다.

### Layout parity

- Home issue grid를 desktop 기준 4열로 조정한다.
- 기존 mobile/tablet 동작은 유지한다.

## Testing Strategy

- Home issue card가 `action-items` 기준 카운트를 사용한다는 정적 회귀 테스트를 추가한다.
- Home issue grid가 desktop 4열 class를 유지한다는 레이아웃 테스트를 추가한다.
- 기존 Home / Action Required 관련 회귀 테스트를 함께 실행해 라벨 정합성과 placeholder 동선을 다시 확인한다.
