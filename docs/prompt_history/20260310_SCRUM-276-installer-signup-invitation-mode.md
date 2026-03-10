# SCRUM-276 FE installer 초대 signup 모드 추가

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-276-installer-signup-invitation-mode`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-276
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-276,fe,signup,installer

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-276.
- Objective: installer 초대 signup 모드 추가 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- installer invitation signup 모드에서 회사명과 권한을 읽기 전용으로 노출하고 position을 선택 입력으로 낮췄습니다.
- companyName claim을 유지한 accept payload와 helper validation을 추가해 installer 전용 가입 흐름을 정리했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-276-installer-signup-invitation-mode.md`
- `src/app/pages/SignUp.tsx`
- `src/app/pages/signupInvitationMode.ts`
- `src/services/invitations.ts`
- `tests/signup-installer-invitation-mode.test.mjs`

## Validation
```bash
node tests/signup-installer-invitation-mode.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.