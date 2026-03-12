# Reservations GT Visible Parity Design

## Goal

`Reservations` 화면을 `Pangea_v2_v127`의 대여 예약 화면과 시각적으로 동일한 구조로 맞춘다. 현재 예약/결제/상태 전환 API와 내부 상태 모델은 최대한 유지하고, Chrome에서 사용자가 보는 정보 구조와 카피만 GT 기준으로 정렬한다.

## Scope

- 상단 검색/필터/버튼 영역을 GT 기준으로 정렬한다.
- 캘린더 또는 리스트 본문의 섹션 배치, 컬럼/카드 라벨, 상태 표시, CTA 문구를 GT와 맞춘다.
- GT에 없는 보조 문구나 visible control은 비노출 또는 치환한다.
- 상세 패널/모달이 있으면 보이는 섹션과 버튼 흐름을 GT에 맞춘다.

## Non-Goals

- 예약 생성/취소/반납/사고 접수 API 구조를 바꾸지 않는다.
- 결제 동기화나 차량 조회 내부 로직을 GT 데이터 모델로 다시 짜지 않는다.
- 데이터 샘플 자체를 GT와 동일하게 맞추려 하지 않는다.

## Approach

### Option 1: Visible parity only

- 현재 API와 상태 구조는 유지하고 화면만 GT처럼 맞춘다.
- 장점: 빠르고 안전하다.
- 단점: 내부 동작은 GT와 다를 수 있다.

### Option 2: Visible parity plus interaction cleanup

- 보이는 구조와 함께 달력 이동, 필터 토글, 정렬/선택 흐름도 GT에 더 가깝게 맞춘다.
- 장점: 체감 일치도가 더 높다.
- 단점: 변경 범위가 커진다.

### Recommendation

- 이번 작업은 Option 1로 진행한다.
- 사용자 요구는 “보이는 것만 GT와 같게”이므로 시각 정합을 우선하고, 동작 로직은 최대한 보존한다.

## Comparison Method

- `http://localhost:5173/reservations`와 로컬 GT 빌드의 같은 화면을 Chrome에서 나란히 비교한다.
- 다음 항목을 기준으로 차이를 정리한다.
  - 상단 검색/필터/버튼
  - 캘린더 헤더와 날짜 그리드 또는 예약 목록 헤더
  - 예약 상태 배지와 금액/이슈 보조 정보
  - 상세 패널/모달의 섹션 순서와 CTA

## Testing Strategy

- `Reservations.tsx`의 GT 가시 계약을 고정하는 테스트를 추가한다.
- 이번 정합과 충돌하는 기존 예약 테스트는 최소 범위로 업데이트한다.
- 마지막에 브라우저 재확인과 production build를 실행한다.
