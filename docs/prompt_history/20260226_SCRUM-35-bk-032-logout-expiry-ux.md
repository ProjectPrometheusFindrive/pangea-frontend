# SCRUM-35 BK-032 Logout Session Expiry UX

- Date: 2026-02-26 20:20
- Author: Codex (GPT-5)
- Branch: fix/SCRUM-35-bk-032-logout-expiry-ux
- Tags: scrum-35,bk-032,frontend,auth,logout,session-expiry,ux

## Start Context
- Start Prompt 기준: `dev` 기반 격리 worktree에서 작업하고, 구현 완료 후 PR(`base=dev`) 및 Jira 상태/코멘트 동기화를 수행.
- Jira `SCRUM-35` AC 핵심: `/api/v2/auth/logout`, `/api/v2/auth/refresh`, `/api/v2/auth/me` 결과를 단일 세션 상태로 정리하고 수동 로그아웃/자동 만료 UX를 구분.
- 예외 요구: logout API 실패 시 로컬 세션 강제 정리, refresh 반복 실패 시 무한 루프 없이 1회 종료, 동시 401/백그라운드 복귀/오프라인 상황 방어, returnUrl 저장/복구.

## Changes Summary
- `AuthContext`에 세션 만료 단일 종료 플로우를 추가해 `401` 연쇄에서도 세션 정리를 1회만 수행하도록 ref 락(`sessionExpiredHandledRef`)을 적용했다.
- API response interceptor에서 `401` 발생 시 `/api/v2/auth/refresh`를 단일 in-flight promise로 수행하고, 성공 시 원요청 1회 재시도, 실패 시 만료 모달 노출 후 로그인 이동으로 통합했다.
- 수동 로그아웃은 `/api/v2/auth/logout` 실패 여부와 무관하게 로컬 세션/토큰 저장소를 강제 정리하고 로그인 페이지로 즉시 이동하도록 변경했다.
- 로그인 라우팅에 보호 라우트를 도입해 비인증 접근 시 `returnUrl`을 저장하고 `/login`으로 이동하도록 정리했다.
- 로그인 페이지에 `reason` 파라미터 기반 토스트(`manual`: 로그아웃 성공, `expired`: 세션 만료 안내)와 `returnUrl` 복구 이동을 추가했다.

## Diffs & Files
- `src/app/context/AuthContext.tsx`: logout/expiry 분기, refresh 재시도, 401 단일 종료, 만료 모달, returnUrl 저장/소비 헬퍼 추가.
- `src/services/auth.ts`: `postRefresh()` 및 `AuthRefreshData` 추가.
- `src/services/api/types.ts`: auth 재시도 루프 방지용 `internal.hasRetriedAuth` 필드 추가.
- `src/app/components/AuthRequiredRoute.tsx`: 비인증 보호 라우트 + returnUrl 저장.
- `src/app/routes.ts`: 로그인 제외 라우트를 보호 라우트 하위로 재구성.
- `src/app/components/Layout.tsx`: 수동 로그아웃 UX를 `logout({ silent: true, redirectToLogin: true })` 기반으로 통일.
- `src/app/pages/Login.tsx`: reason 토스트 및 returnUrl 복구 이동 추가.
- `src/app/hooks/usePageEndpointState.ts`: unauthorized/forbidden 액션의 alert 제거, 라우팅 액션으로 단순화.
- `src/app/App.tsx`: 전역 `sonner` Toaster 추가.
- `docs/prompt_library/prompt_library_v1.md`: v1.2.17 및 인증 UX 티켓 증빙 규칙 추가.

## Validation
```bash
npm run build
# vite build 성공
# output: build success, chunk size warning only
```

## Notes
- 로컬 환경 Node 버전이 `react-router@7.13.0` 권장(`>=20`)보다 낮아 install 시 engine warning이 발생했지만 빌드는 성공했다.
- 자동화 테스트 스크립트가 정의되지 않아 이번 티켓은 빌드 검증 중심으로 확인했다.
