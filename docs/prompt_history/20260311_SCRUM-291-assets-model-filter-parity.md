# SCRUM-291 Assets Model Filter Parity

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-291-assets-model-filter-parity
- Jira Key: SCRUM-291
- Jira Status: Resolved
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/132
- Tags: assets,filters,figma-parity,prompt-history

## Start Context
- Restore the missing vehicle-model filter on the Assets page so the live filter form matches the approved Figma flow.
- Keep filter accessibility and the existing keyword-filter behavior intact.

## Changes Summary
- Reintroduced model-based filtering with a catalog-backed hydration path so options, counts, and pagination come from the full matching asset set.
- Preserved the existing filter form semantics and accessibility attributes.
- Added a dedicated regression test and refreshed the filter-form accessibility coverage.

## Diffs & Files
- `src/app/pages/Assets.tsx`: restored model filter state, catalog-backed options, and client-side pagination for filtered results.
- `src/services/assets.ts`: opened the assets list query shape for the `model` parameter.
- `tests/assets-model-filter-parity.test.mjs`: added regression coverage for catalog-backed model filtering.
- `tests/admin-filter-form-a11y.test.mjs`: updated accessibility expectations around filter labels.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests for catalog-backed filter behavior and filter-form accessibility.
- The change is FE-only and reuses the existing asset payload shape without requiring a backend contract change.
