# SCRUM-193 Revenue Trend Fallback

- Date: 2026-03-08 09:15
- Author: Codex
- Branch: `fix/SCRUM-193-revenue-trend-fallback`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-193
- Jira Status: `진행 중` during implementation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: `revenue`, `bugfix`, `partial-success`, `error-handling`, `regression`

## Start Context
- Jira `SCRUM-193` reported that the Revenue page treated trend API failure as a page-level failure even when summary data existed.
- Work started from latest `dev` in an isolated worktree, with Jira kickoff comment already posted and guarded branch/worktree checks enforced before each git step.
- Acceptance focus was to keep summary-driven revenue content visible, separate trend failure from page empty-state, and degrade the trend card to an inline retry state.

## Changes Summary
- Reworked the Revenue hydrate path to use summary-first partial success: `summary` and `trend` are awaited independently, summary failure still drives blocking/refresh error handling, and trend failure now falls back to a trend-card-only error state.
- Split Revenue view-model logic into a pure helper module so summary-only empty detection, empty trend fallback creation, and partial-success resolution are testable outside the component callback.
- Added regression coverage for summary-success/trend-failure and summary-failure branches, then added a source-level copy regression test so mojibake placeholders in `Revenue.tsx` and `prompt_library` are caught before merge.
- Restored the Revenue page and `prompt_library` Korean copy on top of the latest `dev` baseline while preserving the SCRUM-193 fallback logic and documentation rule.

## Diffs & Files
- `src/app/pages/Revenue.tsx`
  - Replaced all-or-nothing revenue hydration with `Promise.allSettled` handling.
  - Preserved page-level errors for summary failure only.
  - Rendered trend failure as an inline retry state inside the trend card.
- `src/app/pages/revenueViewModel.ts`
  - Added summary-only empty detection.
  - Added empty trend fallback generation.
  - Added a pure hydration-result resolver for success/partial/summary-error branches.
- `tests/revenue-view-model.test.mjs`
  - Added SSR regression coverage for summary-only empty-state logic, empty trend fallback payloads, partial success, and summary failure.
- `tests/revenue-copy-regression.test.mjs`
  - Added UTF-8 copy regression coverage for Revenue labels/messages and the restored prompt-library Korean guidance.
- `docs/plans/2026-03-08-scrum-193-revenue-trend-fallback-design.md`
- `docs/plans/2026-03-08-scrum-193-revenue-trend-fallback-implementation.md`
- `docs/prompt_library/prompt_library_v1.md`
  - Preserved the restored Korean baseline from latest `dev`.
  - Added prompt-history evidence guidance for Revenue trend fallback fixes.

## Notes
- Validation:
  - `node --test tests/revenue-view-model.test.mjs`
  - `node --test tests/revenue-copy-regression.test.mjs`
  - `npm.cmd run build` (current workspace cannot execute because local `vite` binary is missing from `node_modules/.bin`)
- Fresh verification exposed pre-existing malformed mojibake string literals in the touched `Revenue.tsx` file and stale corrupted prompt-library content from the branch baseline. These were corrected while preserving the intended fallback behavior.
- Regression coverage now includes a source-level UTF-8 guard, but there is still no full DOM-level Revenue page test in this repo.
