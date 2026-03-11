# SCRUM-299 Super Admin Forbidden Route Guard

- Date: 2026-03-12 08:05
- Author: Codex
- Branch: fix/SCRUM-299-super-admin-forbidden-route-guard
- Jira Key: SCRUM-299
- Jira Status: In Progress
- PR URL: PENDING
- Tags: auth,authorization,route-guard,super-admin,forbidden,prompt-history

## Start Context
- `super_admin` account was reported to reach `/forbidden` after login or route re-entry even though the role must not be blocked by app-shell permission guards.
- Jira AC required a regression test for the forbidden-route case, preservation of existing restrictions for `admin/member/installer`, and explicit review of `returnUrl`, `RequireAuth`, and `permissions/me` interactions.
- The relevant repository was identified as `pangea-frontend`, and the fix was developed in an isolated git worktree from `dev`.

## Changes Summary
- Centralized the route-level forbidden redirect policy so `super_admin` bypasses permission-denial redirects while non-privileged roles still follow the existing `canAccessRoute` decision.
- Added a shared `isSuperAdminRole` helper in auth role mapping so privileged-role detection is normalized in one place.
- Added an executable regression test around the guard-policy helper to verify `super_admin` stays out of `/forbidden` and regular roles still redirect when route permission is missing.
- Added task design and implementation-plan documents for SCRUM-299 and updated `prompt_library_v1.md` to capture the new documentation rule.

## Diffs & Files
- `src/app/components/RequireAuth.tsx`: route permission denial now delegates to a centralized guard-policy helper and reads the authenticated user role.
- `src/app/components/requireAuthPolicy.js`: pure guard-policy helper for deciding whether route denial should redirect to `/forbidden`.
- `src/services/auth.ts`: added `isSuperAdminRole()` and reused it in role-to-view-role mapping.
- `tests/super-admin-route-guard.test.mjs`: executable regression coverage for privileged and non-privileged route-guard outcomes.
- `docs/plans/2026-03-12-super-admin-forbidden-route-guard-design.md`: design note for the centralized guard exception.
- `docs/plans/2026-03-12-super-admin-forbidden-route-guard.md`: implementation plan captured before code changes.
- `docs/prompt_library/prompt_library_v1.md`: version/date/history updated with SCRUM-299 documentation guidance.

## Notes
- Validation run in the worktree:
  - `node --test tests/super-admin-route-guard.test.mjs`
  - `node --test tests/auth-login-navigation.test.mjs`
- `npm install` could not be used in PowerShell because the machine blocks `npm.ps1` by execution policy, so the verification stayed on the existing Node test runner path.
- The worktree should remain until PR creation and Jira status sync are fully complete.
