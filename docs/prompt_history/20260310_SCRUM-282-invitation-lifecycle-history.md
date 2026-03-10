# SCRUM-282 FE invitation lifecycle filter/history 추가

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-282-invitation-lifecycle-history`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-282
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-282,fe,settings,invitations

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-282.
- Objective: invitation lifecycle filter/history 추가 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- Settings 초대 이력에 status filter와 lifecycle 정렬 로직을 추가했습니다.
- acceptedAt, acceptedUserId, pending-only resend 액션을 노출해 초대 상태 이력을 추적할 수 있게 했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-282-invitation-lifecycle-history.md`
- `src/app/pages/Settings.tsx`
- `tests/settings-invitation-lifecycle.test.mjs`

## Validation
```bash
node tests/settings-invitation-lifecycle.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.