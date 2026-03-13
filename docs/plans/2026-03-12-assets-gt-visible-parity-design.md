# Assets GT Visible Parity Design

## Goal

`Assets` 화면을 `Pangea_v2_v127`의 차량 자산 화면과 시각적으로 동일한 구조로 맞춘다. 현재 API 연동과 자산 생성/상세/수정 로직은 최대한 유지하고, 사용자가 Chrome에서 보는 정보 구조와 카피만 GT 기준으로 정렬한다.

## Scope

- 상단 헤더, 요약 카드, 필터/검색 영역, 리스트 또는 테이블, 상세 패널의 보이는 구조를 GT와 맞춘다.
- GT에 없는 필터, 보조 문구, 버튼, 안내 텍스트는 비노출 또는 대체한다.
- GT에 있는 제목, 섹션 순서, 상태 라벨, 버튼 카피, 배치와 간격을 우선 정렬한다.
- 현재 `getAssetsList`, `getAssetDetail`, `patchAsset`, `createAsset`, `deleteAsset` 같은 API 흐름은 가능하면 유지한다.

## Non-Goals

- 자산 생성/수정/삭제 API 자체를 GT의 데이터 모델로 바꾸지 않는다.
- 백엔드 응답 구조를 바로 변경하지 않는다.
- GT에 보이지 않는 내부 상태 구조나 URL 파라미터 체계를 이번 작업에서 정리하지 않는다.

## Design Approach

### Option 1: Visible parity only

- 현재 데이터/상태 모델은 유지하고, 렌더링 결과만 GT에 맞춘다.
- 장점: 변경 범위가 작고 안전하다.
- 단점: 내부 구현은 GT와 다를 수 있다.

### Option 2: Visible parity plus interaction cleanup

- 화면 구조와 함께 보이는 필터 상호작용과 일부 상태 전환 affordance도 GT에 가깝게 맞춘다.
- 장점: 체감 일치도가 더 높다.
- 단점: 로직 변경 범위가 커진다.

### Recommendation

- 이번 작업은 Option 1로 진행한다.
- 사용자가 요구한 기준은 “보이는 것만 GT와 같으면 된다”이므로, 화면 정합을 우선하고 데이터/행동 로직은 최대한 보존한다.

## Comparison Method

- `http://localhost:5173/assets`와 로컬 GT 빌드의 차량 자산 화면을 Chrome에서 나란히 비교한다.
- 스크린샷과 a11y snapshot으로 다음을 확인한다.
  - 전체 레이아웃
  - 상단 요약 영역
  - 검색/필터 노출 여부와 순서
  - 리스트/테이블 헤더와 카드 구성
  - 상세 패널 또는 모달의 보이는 섹션
  - 버튼 카피와 보조 텍스트

## Testing Strategy

- `Assets.tsx`의 GT 가시 계약을 고정하는 테스트를 추가한다.
- GT에 없는 요소가 비노출인지, GT 핵심 제목/섹션/버튼 문구가 존재하는지 소스 기반 테스트로 확인한다.
- 마지막에 브라우저 재확인과 production build를 실행한다.
