# SCRUM-288 Home Issue Cards Figma Parity

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-288-home-issue-cards-figma-parity
- Jira Key: SCRUM-288
- Jira Status: Resolved
- PR URL: PENDING
- Tags: home,figma-parity,issue-cards,prompt-history

## Start Context
- Restore the home issue card grid so the live page matches the approved eight-card Figma taxonomy.
- Preserve premium-card treatment and keep click-through behavior aligned with each issue destination.

## Changes Summary
- Rebuilt the home issue-card definition so the missing insurance, accident, and vehicle-anomaly cards render again.
- Kept the premium-only placeholders explicit instead of leaving unsupported empty gaps.
- Added a focused regression test that locks the expected eight-card taxonomy and premium-card behavior.

## Diffs & Files
- `src/app/pages/Home.tsx`: restored the full Figma-aligned issue-card list and premium-card metadata.
- `tests/home-issue-card-figma-parity.test.mjs`: added regression coverage for the issue-card taxonomy and premium placeholder copy.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests before PR creation.
- The worktree remains isolated until the PR is created and merged.
