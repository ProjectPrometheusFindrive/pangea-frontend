# SCRUM-56 BK-074 Revenue API Integration

- Date: 2026-02-27 07:40
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-56-bk-074-revenue-api
- Tags: scrum-56,bk-074,frontend,revenue,api-integration,loading-error-empty,mock-removal

## Start Context
- Start Prompt 기준: `dev` 기반 격리 worktree에서 작업하고, Jira 상태/코멘트 동기화 후 `base=dev` PR까지 완료한다.
- Jira `SCRUM-56` AC 핵심: `GET /api/v2/revenue/summary?from&to&granularity`, `GET /api/v2/revenue/trend?from&to` 연동 및 기간/단위 변경 시 loading 갱신, empty-state, 오류 패널 + Retry 제공.
- 오류 분기 요구: `400` 파라미터 오류 안내, `401/403` 인증/권한 처리, `5xx/네트워크` 재시도와 이전 상태 복원 정책 적용.

## Changes Summary
- Revenue 전용 서비스(`src/services/revenue.ts`)를 추가해 summary/trend endpoint를 타입 기반으로 호출하고, BE 응답(`period/totals/buckets/items`)을 차트 렌더용 모델로 정규화했다.
- `src/app/pages/Revenue.tsx`의 하드코딩 주/월/연 차트/테이블 데이터를 제거하고 API 데이터 기반으로 전면 전환했다.
- 기간(`최근 7일/30일/1년`) + 단위(`일/주/월`) 필터를 추가해 변경 즉시 재조회되도록 연결했다.
- 초기 로딩/블로킹 에러/empty는 `PageStateBoundary`로 처리하고, 기존 데이터가 있는 상태에서 재조회 실패 시에는 인라인 경고 + Retry를 노출하면서 직전 성공 스냅샷을 유지하도록 구현했다.
- `400`은 조건 오류 안내 문구를 우선 노출하고, `401/403`은 기존 공통 액션(`로그인 이동`/`홈 이동`)과 연계했다.

## Diffs & Files
- `src/services/revenue.ts`: Revenue summary/trend API 호출 및 응답 정규화 어댑터 추가.
- `src/app/pages/Revenue.tsx`: mock 기반 매출 차트/집계 제거, 실 API 연동 + 상태 분기(loading/error/empty/refresh-error) 적용.
- `docs/prompt_library/prompt_library_v1.md`: BK-074(SCRUM-56) prompt_history 증빙 규칙 추가 및 버전 메타데이터 갱신.
- `docs/prompt_history/20260227_SCRUM-56-bk-074-revenue-api-integration.md`: 본 작업 이력 기록 추가.

## Validation
```bash
npm ci
# node>=20 권고(react-router) 경고만 출력, 설치 성공

npm run build
# vite build 성공
# dist 생성 완료 (chunk size warning only)
```

## Notes
- 이 저장소는 `lint`/`test` 스크립트가 정의되어 있지 않아, 본 티켓 검증은 `npm run build` 중심으로 수행했다.
- 로컬 Node 버전은 `v18.19.0`이지만 현재 빌드는 성공했다(엔진 경고 존재).
