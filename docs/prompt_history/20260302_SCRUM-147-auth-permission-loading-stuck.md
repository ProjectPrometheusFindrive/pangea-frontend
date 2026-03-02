# SCRUM-147 Authorization Loading Stuck Fix

- Date: 2026-03-02 22:47
- Author: Codex (GPT-5)
- Branch: fix/SCRUM-147-auth-permission-loading-stuck
- Jira Key: SCRUM-147
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-147,authorization,loading,companyid,regression-test,e2e

## Start Context
- 대상 이슈: 로그인 이후 `권한 상태를 확인하는 중입니다` 화면에서 진행되지 않는 현상.
- 재현 근거: `AuthorizationContext.tsx`에서 `user.companyId.trim()` 호출 시 `companyId` 누락/비문자열 응답에서 런타임 예외 발생, Promise reject로 `checking` 상태 고정.
- AC 요약:
  - 권한 로딩 무한 대기 제거
  - `companyId` 누락/비정상 응답에서도 정상 상태 전이
  - 기존 권한 로딩 동작 회귀 없음

## Changes Summary
- `AuthorizationContext`에 사용자 메타데이터 정규화 가드(`toNormalizedNonEmptyString`)를 도입해 `trim()` 직접 호출을 제거했다.
- `companyId`가 없을 때 권한 캐시 read/write를 건너뛰도록 분기해 캐시 키 의존 예외를 방지했다.
- `ABORTED` 및 `401 + refreshSession 실패` 경로에서 `deny-by-default + ready`로 정리되도록 보강해 `checking` 고정을 차단했다.
- `/auth/me` 응답에 `companyId`가 없는 케이스를 `login.spec.ts`에 회귀 테스트로 추가했다.
- 신규 회귀 테스트는 locale 문자열 의존을 피하기 위해 table DOM 기반 assertion으로 안정화했다.
- prompt_library를 `v1.2.41`로 업데이트하고 SCRUM-147 관련 문서화 이력을 추가했다.

## Diffs & Files
- `src/app/context/AuthorizationContext.tsx`: 사용자 메타데이터 정규화 가드 추가, companyId-null 캐시 분기, abort/401 예외 상태 전이 보강.
- `e2e/login.spec.ts`: `/auth/me` companyId 누락 회귀 테스트 추가 및 assertion 안정화.
- `docs/prompt_library/prompt_library_v1.md`: 버전/태그/버전 히스토리 갱신 (`v1.2.41`, SCRUM-147).
- `docs/prompt_history/20260302_SCRUM-147-auth-permission-loading-stuck.md`: 본 작업 이력 기록.

## Commands Used
```bash
git fetch --all --prune
git switch dev
git pull --ff-only
git worktree add -b fix/SCRUM-147-auth-permission-loading-stuck ../SCRUM-147-auth-permission-loading-stuck dev
npm ci
npx playwright install chromium
npx playwright test e2e/login.spec.ts
```

## Validation
```bash
npx playwright test e2e/login.spec.ts
# Result: 4 passed, 0 failed
```

## Notes
- 테스트 실행 중 `permissions/me` 요청의 `ERR_ABORTED` 경고 로그가 2회 관찰되었으나 non-failing이며 결과에는 영향이 없었다.
- PR 생성 후 Jira 상태를 `Resolved`로 전환하고 PR 링크 포함 코멘트를 남긴다.
