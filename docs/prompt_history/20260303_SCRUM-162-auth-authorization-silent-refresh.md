# SCRUM-162 Auth/Authorization Silent Refresh UX Hardening

- Date: 2026-03-03 14:39
- Author: Codex (GPT-5)
- Branch: fix/SCRUM-162-auth-authorization-silent-refresh
- Jira Key: SCRUM-162
- Jira Status: Resolved
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/68
- Tags: scrum-162,auth,authorization,silent-refresh,ux,requireauth,e2e

## Start Context
- Jira `SCRUM-162` 목표: 인증/권한 재검증을 백그라운드(silent)로 전환하여 전체 화면 차단 로딩(`인증 상태/권한 상태 확인중`) 노출을 줄이고, 초기 진입에서만 blocking 로딩을 허용.
- AC 요약:
  - 탭 복귀/포커스 시 화면 차단 로딩 미노출
  - 권한 재조회 시 기존 페이지 렌더 유지
  - 초기 진입에서만 필요한 로딩 유지
  - 401/세션 만료 시 재인증 플로우 정상 유지
  - 회귀 테스트 보강

## Changes Summary
- `AuthContext`에 `isBootstrapping` 상태를 추가하고, `refreshSession({ silent })` 옵션을 도입해 초기 세션 확정 전/후 동작을 분리했다.
- `AuthorizationContext`에 `isBootstrapping` 상태를 추가하고, 포커스/가시성 복귀 갱신을 `refreshSession({ silent: true })`로 호출해 백그라운드 갱신으로 전환했다.
- `RequireAuth` 차단 조건을 기존 `status === 'checking'`에서 `isBootstrapping` 기반으로 변경해 초기 부트스트랩에서만 blocking fallback이 렌더되게 조정했다.
- `e2e/login.spec.ts`에 포커스 복귀 시 auth 재검증이 발생해도 assets 화면이 유지되는 회귀 케이스를 추가했다.
- `prompt_library_v1.md`를 `v1.2.44`로 업데이트하고 SCRUM-162 항목을 Version History에 추가했다.

## Diffs & Files
- `src/app/context/AuthContext.tsx`: `isBootstrapping` 상태 추가, `refreshSession(options?: { silent?: boolean })` 도입, background refresh 시 `status=checking` 미전환.
- `src/app/context/AuthorizationContext.tsx`: `isBootstrapping` 상태 추가, 초기 부트스트랩 외 `setStatus('checking')` 억제, 포커스 갱신 시 `refreshSession({ silent: true })` 사용.
- `src/app/components/RequireAuth.tsx`: 보호 라우트 fallback 렌더 조건을 auth/authorization 부트스트랩 여부로 변경.
- `e2e/login.spec.ts`: `keeps assets view visible during background auth refresh on focus` 테스트 추가.
- `docs/prompt_library/prompt_library_v1.md`: Version `v1.2.44`, tags 갱신, SCRUM-162 Version History 추가.

## Commands Used
```bash
git fetch --all --prune
git switch dev
git pull --ff-only
git worktree add -b fix/SCRUM-162-auth-authorization-silent-refresh ../SCRUM-162-auth-authorization-silent-refresh dev
npm.cmd install
npm.cmd run build
npm.cmd run test:e2e -- e2e/login.spec.ts -g "keeps assets view visible during background auth refresh on focus"
```

## Validation
```bash
npm.cmd run build
# Result: success

npm.cmd run test:e2e -- e2e/login.spec.ts -g "keeps assets view visible during background auth refresh on focus"
# Result: failed in Windows shell due playwright webServer command env-inline syntax
# ('VITE_API_BASE_URL=...' not recognized)
```

## Notes
- 로컬 브라우저(Chrome DevTools MCP)에서 실제 로그인 후 `/assets` 화면 기준 포커스 이벤트 재검증을 수행했고, 가시 텍스트 기준으로 전체 화면 fallback 문구(`인증 상태...`, `권한 상태...`)가 노출되지 않음을 확인했다.
- 네트워크 로그에서 포커스 이후 `/api/v2/auth/me` 재호출이 발생하면서도 화면 경로(`/assets`) 및 자산 테이블 렌더가 유지됨을 확인했다.
- PR 생성 후 Jira 상태를 `Resolved`로 전환하고, PR 링크/핵심 변경 요약을 코멘트로 남긴다.
