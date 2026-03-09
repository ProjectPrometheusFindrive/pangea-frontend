# SCRUM-244 FE batch regressions and follow-ups

- Date: 2026-03-09 15:25
- Author: Codex
- Branch: `fix/SCRUM-244-batch-fe`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-244
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-244,scrum-249,scrum-253,scrum-254,scrum-255,scrum-256,scrum-258,scrum-259,scrum-260,scrum-265,scrum-266,scrum-267,scrum-268,scrum-269,fe,end-prompt,finalization,batch

## Start Context
- Worktree scope: FE follow-up batch on `fix/SCRUM-244-batch-fe`
- Related Jira tickets covered in this branch: SCRUM-244, SCRUM-249, SCRUM-253, SCRUM-254, SCRUM-255, SCRUM-256, SCRUM-258, SCRUM-259, SCRUM-260, SCRUM-265, SCRUM-266, SCRUM-267, SCRUM-268, SCRUM-269
- End-prompt objective: capture prompt history, update prompt library metadata, preserve verification evidence, then commit/push/PR/Jira/cleanup in sequence

## Changes Summary
- Support Center: allowed admins to enter submit mode explicitly, added super-admin `companyId` scoping for create/read flows, rendered persisted attachment metadata, and blocked tenant admins from status mutation paths.
- Settings and invitation flows: hid CSV validation controls for read-only users, added approve/reject actions for pending members, preserved invitation-token terms entry, and aligned invitation company/link content with the new acceptance route.
- UI follow-ups: replaced the login screen with the new split layout, merged Home and Action Required issue language into a single priority panel, enabled multi-upload for loan schedule files in asset creation, and added SPA rewrite coverage for direct-route deploys.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`: bumped prompt library version to `v1.2.49` and recorded this batch in Version History.
- `src/app/pages/SupportCenter.tsx`: submit-mode routing, company scoping inputs, attachment rendering, and admin status-update guard.
- `src/services/support.ts`: include optional `companyId` in support-ticket create payloads.
- `src/app/pages/Settings.tsx`: CSV validation gating plus pending-member approve/reject actions.
- `src/services/settings.ts`: member-status PATCH client helper for approval workflow.
- `src/app/pages/TermsAgreement.tsx`: invitation-token-aware agreement flow updates.
- `src/app/pages/Login.tsx`: new split-shell login presentation.
- `src/app/pages/Home.tsx`: priority panel composition and removal of redundant summary card chrome.
- `src/app/pages/ActionRequired.tsx`: issue label alignment with Home priority cards.
- `src/app/pages/Assets.tsx`: loan schedule multi-file upload UI and payload handling.
- `src/app/pages/assetCreateMode.ts`: supporting asset-create upload mode updates.
- `vercel.json`: SPA rewrite to `index.html` for direct-route hosting.
- `tests/settings-csv-validation-mode.test.mjs`: permission gating coverage for CSV validation.
- `tests/settings-member-status-actions.test.mjs`: pending-member approve/reject workflow coverage.
- `tests/support-center-company-scope.test.mjs`: admin/super-admin company scoping coverage.
- `tests/terms-agreement-flow.test.mjs`: invitation-token terms flow coverage.
- `tests/login-layout-source.test.mjs`: login layout regression coverage.
- `tests/home-actionrequired-alignment.test.mjs`: Home and Action Required issue-label alignment coverage.
- `tests/home-priority-panel.test.mjs`: priority panel presence/structure coverage.
- `tests/assets-loan-schedule-multi-upload.test.mjs`: multi-upload loan schedule coverage.
- `tests/vercel-spa-rewrites.test.mjs`: SPA rewrite configuration coverage.
- `e2e/home.spec.ts`: Home page e2e expectations aligned to the merged priority panel.
- `e2e/login.spec.ts`: login e2e expectations aligned to the new shell layout.

## Validation
```bash
node --test tests/settings-csv-validation-mode.test.mjs tests/settings-member-status-actions.test.mjs tests/support-center-company-scope.test.mjs tests/vercel-spa-rewrites.test.mjs tests/terms-agreement-flow.test.mjs tests/assets-loan-schedule-multi-upload.test.mjs tests/asset-create-mode.test.mjs tests/auth-login-navigation.test.mjs tests/login-layout-source.test.mjs tests/home-actionrequired-alignment.test.mjs tests/home-priority-panel.test.mjs
npm.cmd run build
```

## Notes
- `SCRUM-244` and `SCRUM-249` were already reflected in the branch before finalization; this end-prompt batch preserved them and documented the final FE state alongside the newly added follow-up fixes.
- The build still reports a pre-existing duplicate key warning in `src/app/pages/Reservations.tsx`, but the production build succeeds and this batch did not change that file.
- PR URL was intentionally left as `Pending at commit time` here and will be added to Jira comments after PR creation.
