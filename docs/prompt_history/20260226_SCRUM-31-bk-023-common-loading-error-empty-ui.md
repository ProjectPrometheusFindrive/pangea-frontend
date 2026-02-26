# SCRUM-31 BK-023 Common Loading Error Empty UI

- Date: 2026-02-26 20:25
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-31-bk-023-common-loading-error-empty-ui
- Tags: scrum-31,bk-023,frontend,state-ui,api,error-handling

## Start Context
- Start Prompt 기준: `dev` 기반 격리 worktree에서 작업, AC 기반 구현 후 PR(`base=dev`) 및 Jira 상태/코멘트 동기화.
- Jira `SCRUM-31` AC 핵심: 6개 endpoint(`/api/v2/assets`, `/api/v2/reservations`, `/api/v2/action-required`, `/api/v2/home/summary`, `/api/v2/revenue/summary`, `/api/v2/settings`)에 공통 loading/error/empty 처리 적용.
- 상태 분기 요구: 요청 시작 시 skeleton, 성공 시 본문, 0건 시 empty + CTA, 실패 시 error + Retry, 401/403/5xx 분기.

## Changes Summary
- 공통 endpoint 요청 유틸(`src/services/dashboard.ts`)을 추가하여 티켓 요구 6개 API 호출을 표준화했다.
- 공통 상태 훅(`usePageEndpointState`)을 추가해 race/unmount 안전성(최신 응답만 반영 + 이전 요청 abort)과 에러 분류(401/403/retryable)를 통합했다.
- `PageStateBoundary`를 확장해 loading skeleton, error 추가 CTA(예: 로그인/홈 이동), empty CTA를 지원하도록 변경했다.
- 대상 6개 화면(`Assets`, `Reservations`, `ActionRequired`, `Home`, `Revenue`, `Settings`)을 endpoint 기반 상태 관리로 전환하고 Retry/empty CTA/401/403 액션을 일관 적용했다.
- 401의 "세션 만료 후 로그인 이동" 동작을 위해 `/login` 라우트와 로그인 페이지를 추가했다.

## Diffs & Files
- `src/services/dashboard.ts`: SCRUM-31 요구 6개 endpoint GET 호출 래퍼 추가.
- `src/app/hooks/usePageEndpointState.ts`: 공통 상태 훅, empty 판별, 401/403/5xx 분류, 에러 액션 헬퍼 추가.
- `src/app/components/PageStateBoundary.tsx`: loading skeleton, error/empty CTA 버튼 props 확장.
- `src/app/pages/Assets.tsx`: `/api/v2/assets` 연동, empty/filter CTA, auth/forbidden 에러 액션 추가.
- `src/app/pages/Reservations.tsx`: `/api/v2/reservations` 연동, race-safe reload, empty/filter CTA, auth/forbidden 에러 액션 추가.
- `src/app/pages/ActionRequired.tsx`: `/api/v2/action-required` 연동, 미납/조치 항목 empty 판별, empty/filter CTA, auth/forbidden 에러 액션 추가.
- `src/app/pages/Home.tsx`: `/api/v2/home/summary` 연동 및 공통 state boundary 적용.
- `src/app/pages/Revenue.tsx`: `/api/v2/revenue/summary` 연동 및 공통 state boundary 적용.
- `src/app/pages/Settings.tsx`: `/api/v2/settings` 연동 및 공통 state boundary 적용.
- `src/app/pages/Login.tsx`: 세션 만료 후 재로그인 진입 화면 추가.
- `src/app/routes.ts`: `/login` 라우트 추가.
- `docs/prompt_library/prompt_library_v1.md`: v1.2.16 업데이트 및 공통 상태 UI 티켓 validation 기록 규칙 추가.

## Validation
```bash
npm run build
# vite build 성공
# output: build success, chunk size warning only
```

## Notes
- API payload shape가 환경별로 다를 수 있어 collection/field 파서는 보수적으로 작성했고, 인식 실패 시 기존 mock 기반 본문 렌더 fallback을 유지했다.
- 테스트 스크립트가 별도로 정의되지 않아 빌드 검증 중심으로 확인했다.
