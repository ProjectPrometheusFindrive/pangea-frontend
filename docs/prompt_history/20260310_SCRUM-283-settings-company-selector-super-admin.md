# SCRUM-283 FE super_admin settings company selector 정리

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-283-settings-company-selector-super-admin`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-283
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-283,fe,settings,company-scope

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-283.
- Objective: super_admin settings company selector 정리 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- super_admin settings company selector가 searchParams와 일관되게 동작하도록 functional update로 정리했습니다.
- selector value와 guard 상태가 명시적 settingsCompanyId에 맞춰 유지되도록 맞췄습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-283-settings-company-selector-super-admin.md`
- `src/app/pages/Settings.tsx`
- `src/services/settings.ts`
- `tests/settings-company-selector-super-admin.test.mjs`
- `tests/settings-company-selector.test.mjs`

## Validation
```bash
node tests/settings-company-selector-super-admin.test.mjs
node tests/settings-company-selector.test.mjs
node tests/settings-company-scope.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.