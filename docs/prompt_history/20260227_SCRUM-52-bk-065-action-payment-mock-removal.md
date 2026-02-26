# SCRUM-52 BK-065 Action/Payment Mock Removal

- Date: 2026-02-27 08:00
- Author: Codex (GPT-5)
- Branch: fix/SCRUM-52-action-payment-mock-removal
- Tags: scrum-52,bk-065,action-required,payments,mock-removal,api-single-source

## Start Context
- Start Prompt 기준으로 `dev` 기반 worktree(`../SCRUM-52-action-payment-mock-removal`)에서 작업했고, Jira `SCRUM-52`를 `진행 중`으로 전환한 뒤 작업 계획 코멘트를 등록했다.
- Jira AC 핵심:
  - Action/Payment 경로에서 mock source 제거 및 실 API 단일 소스 유지
  - `GET /api/v2/action-required`, `GET /api/v2/payments/status?reservationId={id}`, `GET /api/v2/payments/{paymentId}` 기준으로 조회 경로 정리
  - API 실패 시 mock fallback 금지, Retry 제공, `401/403/404/5xx` 분기 유지
  - 지연 응답 경합 시 최신 응답만 반영

## Changes Summary
- ActionRequired 경로의 mock 타입 의존 제거:
  - `src/app/pages/ActionRequired.tsx`에서 `../data/mockData`의 `MemoLog` 타입 import를 제거하고 페이지 내부 타입으로 대체해 mockData 의존을 끊었다.
- 결제 상태 동기화 경로를 지정 endpoint-only로 정리:
  - `src/app/utils/paymentStatusSync.ts`에서 `/api/v2/payments` 리스트 fallback(`getPaymentsList`)과 관련 보조 로직을 제거했다.
  - 결제 상태 동기화는 `/api/v2/payments/status` + `/api/v2/payments/{paymentId}` + 기존 fallback/cache(마지막 정상 상태)만 사용하도록 정리했다.
  - status endpoint 오류 처리에서 list fallback 전제를 제거하고, 기존 `401/403/404/5xx` 에러 매핑과 Retry 흐름을 유지했다.
- `mockPayments` 의존 제거:
  - `src/app/utils/paymentUtils.ts`에서 `mockPayments` fixture export를 삭제했다.
  - `getUnpaidStatsByPeriod`는 외부 결제 배열을 입력받도록 변경해 하드코딩 mock 데이터 없는 구조로 정리했다.
  - `calculateOverdueDays`는 고정 날짜 대신 런타임 기준 날짜를 사용하도록 정리했다.

## Diffs & Files
- `src/app/pages/ActionRequired.tsx`
  - mockData 타입 import 제거, 로컬 `MemoLog` 타입 정의 추가
- `src/app/utils/paymentStatusSync.ts`
  - `getPaymentsList` import 제거
  - `payments-list` source 및 list fallback 병합 로직 제거
  - status/detail endpoint 중심 동기화로 단순화
- `src/app/utils/paymentUtils.ts`
  - `mockPayments` fixture 제거
  - `getUnpaidStatsByPeriod(payments)` 시그니처 변경
  - 연체 계산 기준 날짜를 동적 기준으로 변경
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.30 메타데이터 갱신 및 BK-065 prompt_history 증빙 규칙 추가

## Validation
```bash
npm run build
# 실패: sh: 1: vite: not found

npm install
# 의존성 설치 성공 (react-router engine warning: node >=20 권장)

npm run build
# vite build 성공
# output: 2271 modules transformed, dist 생성 완료
```

## Notes
- 이 레포지토리 `package.json`에는 `lint`/`test` 스크립트가 없어 추가 자동 검증은 수행하지 못했다.
- 로컬 Node `v18.19.1`에서 `react-router@7.13.0`의 engine warning이 출력되지만, 빌드는 정상 완료되었다.
