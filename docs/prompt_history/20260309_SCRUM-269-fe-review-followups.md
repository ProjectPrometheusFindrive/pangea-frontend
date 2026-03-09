# SCRUM-267/269 FE review follow-ups

- Date: 2026-03-09 16:25
- Author: Codex
- Branch: `fix/SCRUM-269-review-followups`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-269
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-267,scrum-269,fe,follow-up,review

## Start Context
- Worktree scope: FE follow-up fixes stacked on `fix/SCRUM-244-batch-fe` because the parent batch PR has not merged into `dev` yet.
- Related Jira tickets covered in this branch: SCRUM-267, SCRUM-269
- Objective: close the late review items for Home placeholder behavior and loan-schedule upload UX, then document/commit/push/PR/Jira in sequence.

## Changes Summary
- Assets: kept loan schedule as a multi-file collection, added explicit append-vs-replace handling, and exposed per-file delete plus whole-list replace affordances in the create modal.
- Home: kept the `단말 OFF` card as placeholder copy and routed its CTA to the premium modal instead of `ActionRequired`.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`: bumped prompt library version to `v1.2.50` and recorded this review-follow-up batch in Version History.
- `src/app/pages/Assets.tsx`: loan-schedule append/replace/remove flow and replace-input ref wiring.
- `src/app/pages/Home.tsx`: `단말 OFF` card CTA aligned to the premium modal placeholder.
- `tests/assets-loan-schedule-multi-upload.test.mjs`: source regression for append/replace/remove UX.
- `tests/home-priority-panel.test.mjs`: source regression for the premium-placeholder card behavior.

## Validation
```bash
node --test tests/assets-loan-schedule-multi-upload.test.mjs tests/home-priority-panel.test.mjs tests/home-actionrequired-alignment.test.mjs tests/asset-create-mode.test.mjs
npm.cmd run build
```

## Notes
- The FE follow-up branch intentionally stacks on `fix/SCRUM-244-batch-fe`; rebasing to `dev` would drop the parent batch changes that these follow-ups depend on.
- `npm.cmd run build` still reports pre-existing duplicate-key warnings in `src/app/pages/Reservations.tsx`, but the production build succeeds and this follow-up did not touch that file.
- PR URL is left as `Pending at commit time` here and will be added to Jira comments after PR creation.
