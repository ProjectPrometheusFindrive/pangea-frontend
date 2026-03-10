# SCRUM-277 FE installer pending approval UI 추가

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-277-installer-pending-approval-flow`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-277
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-277,fe,settings,installer,approval

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-277.
- Objective: installer pending approval UI 추가 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- Settings 계정 관리에서 installer role을 표시하고 pending installer를 목록에 유지하도록 정리했습니다.
- installer 승인·거절 액션은 super_admin에게만 노출되도록 기존 멤버 상태 변경 UI를 확장했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-277-installer-pending-approval-flow.md`
- `src/app/pages/Settings.tsx`
- `src/services/settings.ts`
- `tests/settings-installer-pending-approval.test.mjs`

## Validation
```bash
node tests/settings-installer-pending-approval.test.mjs
node tests/settings-member-status-actions.test.mjs
node tests/settings-company-scope.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.