# SCRUM-55 BK-073 Home API Integration

- Date: 2026-02-27 08:20
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-55-home-api-integration
- Tags: scrum-55,bk-073,frontend,home,api-integration,loading-error-empty,race-handling,mock-removal

## Start Context
- Start Prompt 기준: `dev` 기반 격리 worktree에서 작업하고, Jira 상태/코멘트 동기화 후 `base=dev` PR까지 완료한다.
- Jira `SCRUM-55` AC 핵심: `GET /api/v2/home/summary?from={date}&to={date}&tenantId={id}`로 홈 카드/통계를 렌더하고, 필터 변경 재조회, `loading/success/empty/error` 상태, `401/403/5xx+network` 분기 및 Retry 정책을 제공한다.
- 예외 요구사항: 필터 연속 변경 race 처리, 느린 응답 시 로딩 유지, 일부 null/누락 필드 기본값 안전 렌더, 기존 데이터 유지 정책을 명확히 적용한다.

## Changes Summary
- `src/services/home.ts`를 추가해 Home Summary API 호출을 타입 기반으로 정규화했다.
  - 요청: `from/to/tenantId` 쿼리 동기화.
  - 응답: `kpis/statusCounts/recentChanges`를 null-safe 기본값으로 변환.
- `src/app/pages/Home.tsx`를 API 스냅샷 기반으로 전면 교체했다.
  - 기존 `mockData` 기반 계산(`vehicleAssets/reservations/actionItems/getTodayStats`)을 런타임 경로에서 제거.
  - 기간 필터(`최근 7일/30일/90일`) 추가 및 변경 즉시 재조회.
  - race-safe 요청 처리(AbortController + request sequence) 적용.
  - 초기 로딩/블로킹 오류/empty는 `PageStateBoundary`, 재조회 실패는 기존 스냅샷 유지 + 인라인 경고/Retry로 분리.
  - `401/403`은 공통 액션(`로그인 이동`/`홈 이동`)과 연계.
  - null/누락 필드는 기본값(`0`, `{}`, `[]`)으로 렌더해 UI 붕괴를 방지.

## Diffs & Files
- `src/services/home.ts`: Home summary API client + 정규화 어댑터 추가.
- `src/app/pages/Home.tsx`: Home 전체 데이터 흐름을 mock -> API 스냅샷 구조로 전환, 필터/상태 분기/차트/카드 렌더 로직 재구성.
- `docs/prompt_library/prompt_library_v1.md`: BK-073(SCRUM-55) prompt_history 증빙 규칙 추가 및 버전 메타데이터 갱신.
- `docs/prompt_history/20260227_SCRUM-55-bk-073-home-api-integration.md`: 본 작업 이력 문서 추가.

## Validation
```bash
npm install
# worktree 의존성 설치 (vite binary 누락 해결)
# node>=20 권고(react-router) 엔진 경고만 출력

npm run build
# vite build 성공
# dist 생성 완료 (chunk size warning only)
```

## Notes
- 저장소에 `lint`/`test` 스크립트가 정의되어 있지 않아 본 티켓 검증은 `npm run build` 기준으로 수행했다.
- 로컬 Node 버전은 `v18.19.1`이며 빌드는 성공했지만 엔진 경고가 존재한다.
