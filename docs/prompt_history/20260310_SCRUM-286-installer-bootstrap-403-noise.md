# SCRUM-286 FE installer bootstrap 403 noise 제거

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-286-installer-bootstrap-403-noise`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-286
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-286,fe,installer,bootstrap

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-286.
- Objective: installer bootstrap 403 noise 제거 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- installer view role에서는 settings/company bootstrap fetch를 생략해 불필요한 403 noise를 제거했습니다.
- layout가 notifications bootstrap과 알림 진입점을 installer에게 숨기도록 정리했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-286-installer-bootstrap-403-noise.md`
- `src/app/components/Layout.tsx`
- `src/app/context/CompanyContext.tsx`
- `tests/installer-bootstrap-403-noise.test.mjs`

## Validation
```bash
node tests/installer-bootstrap-403-noise.test.mjs
node tests/notifications-view-all.test.mjs
node tests/notifications-routing.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.