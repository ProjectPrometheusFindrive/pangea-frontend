# SCRUM-50 BK-064 Payment Status Sync Integration

- Date: 2026-02-26 23:55
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-50-payment-status-sync
- Tags: scrum-50,bk-064,frontend,payments,integration,reservations,home,action-required

## Start Context
- Start Prompt 기준으로 Jira `SCRUM-50` AC를 먼저 확인하고 상태를 `진행 중`으로 전환한 뒤 작업 계획 코멘트를 등록했다.
- Jira AC 핵심:
  - `GET /api/v2/payments/status?reservationId={id}`, `GET /api/v2/payments/{paymentId}` 기반 결제 상태 공통 모델 적용
  - Reservations/Home/Action의 결제 상태 표시 타이밍 동기화
  - `401/403` 공통 인증/권한 처리, `404` 결제정보 없음 표시, `5xx/네트워크`는 마지막 정상 상태 + 재시도 UX
  - out-of-order timestamp / 동일 예약 다중 결제 우선순위 / 부분환불(부분상태) 정책 반영
- 범위 제외: 실제 결제 승인/취소 트랜잭션 처리 로직 변경

## Changes Summary
- 공통 결제 상태 동기화 계층 추가:
  - `src/services/payments.ts`에 결제 상태/상세/목록/미납요약 API 클라이언트를 추가했다.
  - `src/app/utils/paymentStatusSync.ts`에 canonical status 매핑(한/영 상태값), 최신 timestamp 우선 + 동률 시 상태 우선순위 규칙, 부분환불/다중결제 처리, last-known cache를 구현했다.
  - `src/app/hooks/usePaymentStatusSync.ts`에 polling(20s), retry, 오류 시 last-known 유지 동작을 공통화했다.
- Reservations 동기화:
  - 목록/상세에 공통 payment sync를 연결해 `paymentStatus`와 `미납/결제 문제` 이슈 라벨을 동기화했다.
  - 결제 탭에 결제 상태 배지와 `결제 정보 없음(404)` 상태 표시를 추가했다.
  - 결제 상태 동기화 실패 시 안내 배너 + 수동 재시도 버튼을 추가했고, last-known 사용 메시지를 노출했다.
- ActionRequired 동기화:
  - 항목 정규화 시 `reservationId/paymentId` 및 payment 메타(status/updatedAt)를 수집하도록 확장했다.
  - 공통 payment sync 결과를 미납 항목에 주입해 목록(미납 필터)과 상세 패널에서 결제 상태 배지를 일관되게 표시했다.
  - 결제 상태 동기화 실패/재시도 배너를 추가했다.
- Home 동기화:
  - `mockPayments/getUnpaidPayments` 의존을 제거하고 공통 payment sync 기반 미납 카운트를 사용하도록 변경했다.
  - 결제 상태 동기화 실패 시 last-known 안내 + 재시도 버튼을 추가했다.

## Diffs & Files
- `src/services/payments.ts`
  - 결제 상태 통합을 위한 v2 payments API 호출 모듈 신규 추가
- `src/app/utils/paymentStatusSync.ts`
  - 결제 상태 canonical enum/라벨/우선순위/timestamp 정렬/cache/fallback 로직 신규 추가
- `src/app/hooks/usePaymentStatusSync.ts`
  - 공통 동기화 훅(폴링/abort-safe/race-safe/retry 에러 상태) 신규 추가
- `src/app/pages/Reservations.tsx`
  - 결제 상태 동기화 적용, 상세 탭 상태 배지/404 표시, 동기화 오류 배너/재시도 추가
- `src/app/pages/ActionRequired.tsx`
  - payment 식별자 정규화 확장, 미납 필터 결제상태 컬럼/상세 결제상태 배지 추가, 동기화 오류 배너/재시도 추가
- `src/app/pages/Home.tsx`
  - mock 결제 집계 제거, 공통 결제 상태 기반 미납 카운트 적용, 동기화 오류 배너/재시도 추가
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.27 메타데이터 및 BK-064 prompt_history 증빙 규칙 추가

## Validation
```bash
npm run build
# 1차 실패: vite not found

npm install --no-audit --no-fund
# 성공 (react-router engine warning: node >=20 권장)

npm run build
# vite build 성공
# output: 2270 modules transformed, dist 생성 완료
```

## Notes
- 현재 Node `v18.19.1` 환경에서는 `react-router@7.13.0` engine warning(`>=20`)이 출력되지만 빌드는 정상 완료된다.
- BK-065에서 mock 제거를 진행할 때, 본 티켓의 공통 payment sync 훅/유틸을 그대로 재사용해 화면 간 상태 일관성을 유지할 수 있다.
