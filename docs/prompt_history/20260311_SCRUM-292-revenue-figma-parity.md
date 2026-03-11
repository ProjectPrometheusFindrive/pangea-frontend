# SCRUM-292 Revenue Figma Parity

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-292-revenue-figma-parity
- Jira Key: SCRUM-292
- Jira Status: Resolved
- PR URL: PENDING
- Tags: revenue,figma-parity,kpi,prompt-history

## Start Context
- Bring the Revenue summary section closer to the approved Figma information architecture.
- Make unsupported sections explicit instead of silently omitting them when the current FE contract cannot supply the data.

## Changes Summary
- Rebuilt the top KPI cards with the approved taxonomy for gross revenue, rentals, average ticket, net revenue, and refunds.
- Added an explicit contract-gap note for unsupported Figma sections rather than rendering misleading placeholders.
- Added regression coverage for the new KPI taxonomy and preserved existing Korean-copy and empty-state controls.

## Diffs & Files
- `src/app/pages/Revenue.tsx`: added the Figma-aligned KPI builder and explicit contract-gap rendering.
- `tests/revenue-figma-parity.test.mjs`: added regression coverage for the KPI taxonomy and contract-gap note.
- `tests/revenue-copy-regression.test.mjs`: updated copy expectations that are sensitive to the new Revenue structure.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests for Revenue parity, copy, and empty-state toolbar regressions.
- This ticket intentionally documents a current FE contract gap instead of inventing backend data.
