# SCRUM-290 Home Score Layout Figma Parity

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-290-home-score-layout-figma-parity
- Jira Key: SCRUM-290
- Jira Status: Resolved
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/131
- Tags: home,figma-parity,score-layout,prompt-history

## Start Context
- Reorder the home operation-score area so its labels and layout follow the approved Figma structure.
- Split recent changes out of the score card instead of nesting it into the score metrics.

## Changes Summary
- Replaced the operation-score labels with the approved taxonomy while leaving unsupported sub-scores as an explicit contract-gap placeholder.
- Moved recent changes into its own card and preserved stable test IDs for both sections.
- Added regression coverage so the score card cannot silently reintroduce fabricated KPI semantics.

## Diffs & Files
- `src/app/pages/Home.tsx`: updated the score-card taxonomy, added an explicit contract-gap note, and kept recent changes in a dedicated card.
- `tests/home-score-layout-parity.test.mjs`: added regression coverage for the approved labels, contract-gap notice, and separate recent-changes card.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests covering the contract-gap placeholder, the new card structure, and existing home regressions.
- The change is FE-only and kept the current backend summary contract intact.
