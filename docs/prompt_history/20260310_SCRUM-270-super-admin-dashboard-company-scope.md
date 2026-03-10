# SCRUM-270 FE super_admin 대시보드 company scope 정렬

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-270-super-admin-dashboard-company-scope`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-270
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-270,fe,dashboard,company-scope

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-270.
- Objective: super_admin 대시보드 company scope 정렬 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- Home와 Revenue가 super_admin의 명시적 회사 선택값을 공통 helper로 해석하고 요청에 반영하도록 정렬했습니다.
- settings 회사 목록 계약을 재사용해 대시보드 필터 옵션과 URL scope 동기화를 맞췄습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-270-super-admin-dashboard-company-scope.md`
- `src/app/pages/Home.tsx`
- `src/app/pages/Revenue.tsx`
- `src/services/home.ts`
- `src/services/revenue.ts`
- `src/services/settings.ts`
- `src/app/pages/dashboardCompanyScope.ts`
- `tests/dashboard-company-scope.test.mjs`

## Validation
```bash
node tests/dashboard-company-scope.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.