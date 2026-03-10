# SCRUM-281 FE notifications 이력 페이지와 bulk-read 정렬

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-281-notifications-pagesize-bulk-read`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-281
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-281,fe,notifications,pagination

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-281.
- Objective: notifications 이력 페이지와 bulk-read 정렬 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- 알림 드롭다운의 전체보기 진입점을 전용 notifications 이력 페이지로 연결하고 페이지네이션을 추가했습니다.
- notifications service와 layout bootstrap이 pageSize/read-all 계약을 따르도록 정리했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-281-notifications-pagesize-bulk-read.md`
- `src/app/components/Layout.tsx`
- `src/app/pages/Notifications.tsx`
- `src/services/notifications.ts`
- `tests/notifications-page-history.test.mjs`

## Validation
```bash
node tests/notifications-view-all.test.mjs
node tests/notifications-routing.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.