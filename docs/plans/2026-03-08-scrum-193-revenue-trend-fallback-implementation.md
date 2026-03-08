# SCRUM-193 Revenue Trend Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the Revenue page summary content visible when the trend request fails, while showing the trend card in an inline error state.

**Architecture:** Add a small pure helper module for revenue page state and fallback data, then update `Revenue.tsx` to hydrate summary and trend independently. Summary remains the required dataset for the page, while trend becomes an optional chart payload with its own error state.

**Tech Stack:** React, TypeScript, Vite SSR tests, node:test

---

### Task 1: Add failing revenue view-model regressions

**Files:**
- Create: `tests/revenue-view-model.test.mjs`
- Create later: `src/app/pages/revenueViewModel.ts`

**Step 1: Write the failing test**

- Add a Vite SSR test file that imports `/src/app/pages/revenueViewModel.ts`.
- Assert `isRevenueSummaryEmpty(summary)` returns `false` when summary buckets contain non-zero revenue, even if trend data is absent elsewhere.
- Assert `createEmptyRevenueTrend({ from, to })` returns a safe empty trend payload for the active date range.

**Step 2: Run test to verify it fails**

Run: `node --test tests/revenue-view-model.test.mjs`

Expected: FAIL because `src/app/pages/revenueViewModel.ts` does not exist yet.

**Step 3: Write minimal implementation**

- Create `src/app/pages/revenueViewModel.ts`.
- Add a summary-only empty-state predicate.
- Add an empty trend fallback factory that returns the active period, zero totals, and empty items.

**Step 4: Run test to verify it passes**

Run: `node --test tests/revenue-view-model.test.mjs`

Expected: PASS

**Step 5: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 2: Update Revenue page hydrate behavior

**Files:**
- Modify: `src/app/pages/Revenue.tsx`
- Reuse: `src/app/pages/revenueViewModel.ts`

**Step 1: Write the failing test expectation down in code comments or notes**

- Preserve the existing regression target:
  - summary success + trend failure must still render summary-driven page content
  - page empty state must be summary-driven
  - trend card must show an inline error with retry

**Step 2: Write minimal implementation**

- Replace `Promise.all` with separate result handling.
- Keep blocking and refresh errors tied to summary failures.
- When summary succeeds and trend fails:
  - create a snapshot with the fresh summary and an empty trend fallback
  - clear page-level blocking/refresh errors
  - set inline `trendError`
- When both succeed:
  - clear `trendError`
  - render the chart normally
- Use the summary-only empty-state helper for `isEmpty`.

**Step 3: Run targeted regression verification**

Run: `node --test tests/revenue-view-model.test.mjs`

Expected: PASS

**Step 4: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 3: Final verification

**Files:**
- Verify modified files only

**Step 1: Run targeted revenue regression**

Run: `node --test tests/revenue-view-model.test.mjs`

Expected: PASS

**Step 2: Run frontend build**

Run: `npm.cmd run build`

Expected: PASS

**Step 3: Commit**

- Skipped per user instruction: `git commit` forbidden
