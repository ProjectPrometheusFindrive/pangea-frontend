# SCRUM-289 Home Bucket Normalization

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-289-home-bucket-normalization
- Jira Key: SCRUM-289
- Jira Status: Resolved
- PR URL: PENDING
- Tags: home,figma-parity,buckets,prompt-history

## Start Context
- Normalize the home asset and contract distribution labels so they match the approved dashboard bucket definitions from Figma.
- Keep fallback labeling deterministic when backend payloads are incomplete.

## Changes Summary
- Introduced canonical bucket normalization before the home dashboard renders asset counts.
- Aligned the maintenance bucket and fallback bucket labels with the same canonical taxonomy.
- Added regression coverage for the normalized labels and fallback mapping.

## Diffs & Files
- `src/app/pages/Home.tsx`: normalized dashboard bucket labels before rendering summary cards.
- `tests/home-bucket-normalization.test.mjs`: added coverage for canonical bucket and fallback label mapping.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests plus existing dashboard company-scope coverage.
- The change is FE-only and does not require backend contract updates.
