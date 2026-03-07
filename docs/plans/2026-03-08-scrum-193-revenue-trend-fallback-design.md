# SCRUM-193 Revenue Trend Fallback Design

## Goal

Keep the Revenue page usable when the trend endpoint fails.
If `summary` succeeds, the KPI cards, summary chart, and summary table should still render.
The trend chart should degrade independently with an inline error and retry action.

## Root Cause

- `src/app/pages/Revenue.tsx` currently waits for `getRevenueSummary` and `getRevenueTrend` with `Promise.all`.
- A single trend failure throws the entire hydrate path into the shared `catch` branch.
- On initial load, that becomes a blocking page error even when summary data is available.
- The page-level empty state also depends on trend items, so chart availability can influence whether the whole page is treated as empty.

## Chosen Approach

### Data loading

- Replace the all-or-nothing hydrate with partial-success handling based on separate summary and trend results.
- Treat `summary` as the required dataset for the page shell.
- Treat `trend` as an optional dataset for the chart card.

### State model

- Add a small revenue-specific view-model helper module for pure state decisions:
  - whether summary data should count as empty
  - how to build an empty trend fallback for the active period
- Keep the component responsible for request orchestration and UI state wiring.
- Add a dedicated `trendError` state so the chart can show an inline error without promoting the whole page into a blocking error.

### Error handling

- If `summary` fails and there is no previous snapshot, keep the existing blocking error behavior.
- If `summary` fails and there is a previous snapshot, keep the existing refresh-warning fallback behavior.
- If `summary` succeeds and `trend` fails:
  - update the snapshot with the new summary data
  - replace trend data with an empty fallback for the active date range
  - keep the selected filters
  - show an inline trend error with a retry button

## Scope

- `src/app/pages/Revenue.tsx`
- `src/app/pages/revenueViewModel.ts`
- `tests/revenue-view-model.test.mjs`

## Testing Strategy

- Add a regression test for summary-present emptiness logic so trend no longer controls the page empty state.
- Add a regression test for empty trend fallback generation so the component can swap in a safe chart payload for failed trend requests.
- Run the targeted node test file and the frontend build after the change.
