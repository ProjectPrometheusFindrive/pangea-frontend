# SCRUM-284 FE installer default landing follow-up

- Date: 2026-03-11
- Author: Codex
- Branch: `fix/SCRUM-284-installer-default-landing-followup`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-284
- Jira Status: `Resolved`
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/137
- Tags: scrum-284,fe,auth,installer,routing,follow-up

## Start Context
- `SCRUM-284` was reported as completed earlier, but Jira comment `2026-03-11` documented a live regression: installer login without a specific `returnUrl` still landed on `/forbidden`.
- The target behavior remained unchanged: installer should default to `/device-installation`, and `/forbidden` CTA should stay role-aware without sending installer back to a dead-end.

## Changes Summary
- Traced the regression to `Login.tsx` computing the post-login default landing path from the pre-login `viewRole` snapshot, which can still be `null` immediately after installer authentication.
- Updated `AuthContext.login()` to return the authenticated user used for the successful session bootstrap, preferring `/api/v2/auth/me` and falling back to the login response user payload.
- Updated `Login.tsx` to resolve the post-login landing path from that authenticated user role first, then fall back to the current context `viewRole` only when needed.
- Added a regression assertion that the post-login route resolution is based on authenticated user role rather than stale pre-login auth state.

## Diffs & Files
- `src/app/context/AuthContext.tsx`: changed `login()` to return the authenticated user and preserved the same session bootstrap sequence.
- `src/app/pages/Login.tsx`: resolved the post-login landing path from the authenticated user role returned by `login()`.
- `tests/auth-login-navigation.test.mjs`: added follow-up regression coverage for installer post-login routing.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library patch version for this follow-up.

## Notes
- Validation was run with `node tests/auth-login-navigation.test.mjs` after the follow-up patch.
- `git diff --check` reported only LF-to-CRLF warnings in the working copy and no whitespace errors.
- Playwright live verification was not rerun locally in this worktree because the environment has not been set up to execute the browser test suite directly; CI should cover that on PR.
