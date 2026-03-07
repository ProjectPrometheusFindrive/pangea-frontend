# SCRUM-183 Home Overdue vs Unpaid Split Design

## Goal

홈 대시보드에서 `반납 지연`과 `미납/연체 계약`이 같은 숫자를 보여주는 문제를 해결한다.  
`반납 지연`은 대여 기간 초과 + 미반납 계약을 유지하고, `미납/연체 계약`은 결제 상태 기반 집계로 분리한다.

## Why This Design

- 현재 BE `home` summary는 `overdue_contracts` 하나를 `alerts.overdue`와 `kpis.overdueContracts`에 동시에 사용한다.
- FE는 `반납 지연` 카드에 `alerts.overdue`, `미납/연체 계약` 카드에 `kpis.overdueContracts`를 사용하므로 둘이 항상 같은 값이 된다.
- 기존 Jira 코멘트에는 수정 완료로 남아 있지만 최신 `dev`에는 해당 변경이 없다. 이번 작업은 실제 코드와 계약을 다시 일치시키는 목적이다.

## Chosen Approach

### Backend

- `GET /api/v2/home/summary` 응답의 `kpis`에 `unpaidContracts`를 추가한다.
- `alerts.overdue`는 기존 의미를 유지한다.
  - 기준: `contractStatus == "대여중"` + `rentalPeriod.end < now` + `returnConfirmed != true`
- `kpis.unpaidContracts`는 선택된 기간에 포함되는 계약 중 `paymentStatus`가 미납 계열인 건수를 센다.
  - 허용 값: `미납`, `연체`, `unpaid`, `overdue`
  - 이번 티켓에서는 `대기`, `pending`, `부분납부`는 포함하지 않는다.

### Frontend

- 홈 API 타입에 `kpis.unpaidContracts`를 추가한다.
- 홈 카드의 `미납/연체 계약`은 `kpis.unpaidContracts`를 사용한다.
- 홈 empty 판정에도 `unpaidContracts`를 포함한다.
- 계약 분포 fallback의 세 번째 값도 `overdueContracts` 대신 `unpaidContracts`를 사용하고, 라벨을 `미납/연체`로 맞춘다.
- `연체 안전도` 같은 실제 연체 의미의 계산은 기존 `overdueContracts`를 유지한다.

## Scope

### Backend

- `server/api/v2/home.py`
- `tests/api/test_v2_home_summary.py`
- `docs/openapi/openapi_v2_draft.yaml`

### Frontend

- `src/services/home.ts`
- `src/app/pages/Home.tsx`
- `e2e/home.spec.ts`

## Testing Strategy

- BE: `tests/api/test_v2_home_summary.py`에 분리 집계 회귀 테스트 추가
- FE: Playwright mock 기반 `e2e/home.spec.ts` 추가
- 검증:
  - `python -m pytest tests/api/test_v2_home_summary.py`
  - `npm.cmd run test:e2e -- e2e/home.spec.ts`
  - `npm.cmd run build`
