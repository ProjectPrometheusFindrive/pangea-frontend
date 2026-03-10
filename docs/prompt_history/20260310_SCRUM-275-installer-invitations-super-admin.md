# SCRUM-275 FE super_admin installer 초대 UI 추가

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-275-installer-invitations-super-admin`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-275
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-275,fe,settings,invitations,installer

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-275.
- Objective: super_admin installer 초대 UI 추가 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- Settings 초대 UI에 installer role을 추가하고 super_admin만 해당 옵션을 사용할 수 있게 했습니다.
- installer 초대는 명시적 company scope가 없으면 생성되지 않도록 validation과 목록 라벨을 정리했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-275-installer-invitations-super-admin.md`
- `src/app/pages/Settings.tsx`
- `src/app/pages/settingsInvitations.ts`
- `src/services/invitations.ts`
- `tests/settings-installer-invitations.test.mjs`

## Validation
```bash
node tests/settings-installer-invitations.test.mjs
node tests/settings-company-scope.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.