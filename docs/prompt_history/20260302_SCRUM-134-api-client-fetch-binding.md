# SCRUM-134 Api Client Fetch Binding Fix

- Date: 2026-03-02 19:34
- Author: Codex
- Branch: `fix/SCRUM-134-api-client-fetch-binding`
- Jira Key: SCRUM-134
- Jira Status: Resolved
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/51
- Tags: scrum-134,api-client,fetch,binding,login

## Start Context
- Start Prompt 기준으로 `dev`에서 분기한 독립 worktree(`/home/jh/code/SCRUM-134-api-client-fetch-binding`)에서 작업하고, `SCRUM-134`를 기준으로 영향 범위를 최소 변경으로 제한한다.
- Jira 요구사항: `src/services/api/client.ts`의 기본 `fetch` 저장/호출에서 바인딩이 깨져 로그인 클릭 시 요청이 전송되지 않는 문제를 해결해야 한다.
- 제약: `ApiClient` 기본 fetch 초기화만 안전 래퍼로 교체하고, 기존 `options.fetchImpl` 주입 경로와 요청 인터셉터/응답 처리 동작은 유지한다.

## Changes Summary
- `getDefaultFetchImpl()`를 추가해 기본 fetch를 `globalThis.fetch(input, init)` 형태의 래퍼로 호출하도록 변경했다.
- `ApiClient` 생성자에서 기본값 초기화를 `options.fetchImpl ?? fetch`에서 `options.fetchImpl ?? getDefaultFetchImpl()`로 교체해 unbound fetch assignment를 제거했다.
- 변경 범위를 `src/services/api/client.ts` 단일 파일로 제한해 로그인 포함 전체 API 요청 경로의 런타임 `TypeError` 가능성을 낮췄다.
- End Prompt 단계에서 `dev` 대상 PR 생성 후 Jira `Resolved` 전환 및 완료 코멘트 동기화를 수행했다.

## Diffs & Files
- `src/services/api/client.ts`
  - 기본 fetch 구현을 바인딩 안전 래퍼(`getDefaultFetchImpl`)로 분리.
  - 생성자 기본 fetch 초기화를 안전 래퍼 기반으로 변경.
- `docs/prompt_history/20260302_SCRUM-134-api-client-fetch-binding.md`
  - Start/End Prompt 실행 이력 및 검증 결과 기록.

## Commands Used
```bash
git fetch --all --prune
git switch dev && git pull --ff-only
git worktree add -b fix/SCRUM-134-api-client-fetch-binding /home/jh/code/SCRUM-134-api-client-fetch-binding dev
npm ci
npm run build
npx playwright test e2e/login.spec.ts
git push -u origin fix/SCRUM-134-api-client-fetch-binding
gh pr create --base dev --head fix/SCRUM-134-api-client-fetch-binding
```

## Validation
```bash
npm run build
npx playwright test e2e/login.spec.ts
```
- `npm run build`: 성공 (vite production build 완료)
- `npx playwright test e2e/login.spec.ts`: 실패 (host에 Playwright 브라우저 실행 의존성 부재로 `browserType.launch` 단계에서 중단)

## Notes
- CI/로컬 E2E 재검증이 필요하면 Playwright 시스템 의존성 설치 후 `e2e/login.spec.ts`를 재실행한다.
