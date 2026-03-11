# SCRUM-290 Home Score Layout Figma Parity

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-290-home-score-layout-figma-parity
- Jira Key: SCRUM-290
- Jira Status: Resolved
- PR URL: PENDING
- Tags: home,figma-parity,score-layout,prompt-history

## Start Context
- Reorder the home operation-score area so its labels and layout follow the approved Figma structure.
- Split recent changes out of the score card instead of nesting it into the score metrics.

## Changes Summary
- Replaced the operation-score labels with the approved taxonomy: safety driving, vehicle management, and business operations.
- Moved recent changes into its own card and preserved stable test IDs for both sections.
- Added regression coverage for the Figma-aligned layout and dashboard company-scope behavior.

## Diffs & Files
- `src/app/pages/Home.tsx`: updated the score-card taxonomy and separated recent changes into a dedicated card.
- `tests/home-score-layout-parity.test.mjs`: added layout-specific regression coverage.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests covering both the new card structure and existing home regressions.
- The change is FE-only and kept the current backend summary contract intact.
