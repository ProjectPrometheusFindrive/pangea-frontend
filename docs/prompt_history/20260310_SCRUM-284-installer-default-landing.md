# SCRUM-284 FE installer 기본 landing path 정렬

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-284-installer-default-landing`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-284
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-284,fe,auth,installer

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-284.
- Objective: installer 기본 landing path 정렬 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- auth service에 role-aware default landing path helper를 추가해 device-installer의 기본 진입점을 /device-installation으로 정리했습니다.
- Login과 Forbidden 페이지가 같은 helper를 재사용해 루트 리다이렉트와 CTA 경로를 일관되게 맞추도록 변경했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-284-installer-default-landing.md`
- `src/app/pages/Forbidden.tsx`
- `src/app/pages/Login.tsx`
- `src/services/auth.ts`
- `tests/auth-login-navigation.test.mjs`

## Validation
```bash
node tests/auth-login-navigation.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.