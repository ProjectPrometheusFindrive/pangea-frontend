# SCRUM-293 Settings Viewer Role Taxonomy

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-293-settings-viewer-role-taxonomy
- Jira Key: SCRUM-293
- Jira Status: Resolved
- PR URL: PENDING
- Tags: settings,rbac,viewer-role,prompt-history

## Start Context
- Extend the settings account-management flow so it supports the approved three-role taxonomy: admin, member, and viewer.
- Keep invitation, signup, and permission display flows aligned with the new viewer role.

## Changes Summary
- Added viewer-role support to FE settings service types, invitation helpers, settings page labels, and signup flows.
- Preserved the installer invitation behavior while making viewer a first-class role option.
- Added targeted regression tests that lock the new viewer role through settings, invitation, and pending-approval paths.

## Diffs & Files
- `src/app/pages/Settings.tsx`: exposed viewer labels and actions in settings member and invitation flows.
- `src/app/pages/SignUp.tsx`: allowed signup rendering for viewer-role invitations.
- `src/app/pages/settingsInvitations.ts`: extended invitation helpers for the viewer role.
- `src/services/auth.ts`: aligned FE role typing with the new viewer role.
- `src/services/invitations.ts`: extended invitation payload typing for the viewer role.
- `src/services/settings.ts`: aligned settings member typing with the new viewer role.
- `tests/settings-viewer-role-taxonomy.test.mjs`: added FE regression coverage for the viewer role.
- `tests/settings-installer-invitations.test.mjs`: kept installer invitation behavior covered alongside the new role.
- `tests/settings-installer-pending-approval.test.mjs`: kept pending approval behavior aligned.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests on settings viewer-role coverage and nearby invitation flows.
- A paired backend worktree for the same Jira key carries the server-side contract update.
