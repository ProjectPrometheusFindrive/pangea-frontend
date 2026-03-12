# Revenue GT Visible Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the visible `Revenue` screen to the `Pangea_v2_v127` GT baseline while keeping the current frontend revenue API and aggregation flow intact.

**Architecture:** Compare the live local `Revenue` page against the GT build in Chrome, identify only user-visible mismatches, then adjust `Revenue.tsx` rendering structure and copy without rewriting summary/trend hydration or backend contracts. Lock the GT-facing visible contract with focused tests and verify with a production build plus browser recheck.

**Tech Stack:** React, Vite, TypeScript, Chrome DevTools MCP, Node test runner

---

### Task 1: Capture the GT mismatch map

**Files:**
- Modify: `src/app/pages/Revenue.tsx`
- Create: `tests/revenue-gt-visible-parity.test.mjs`

**Step 1: Open both revenue screens side by side**

Run Chrome with:
- local app: `http://localhost:5173/revenue`
- GT app: local `Pangea_v2_v127` revenue route

Expected: both pages render and can be compared in the browser.

**Step 2: Record visible differences**

Check:
- KPI card ordering and copy
- filter toolbar ordering and labels
- main chart title, legend, helper copy
- supporting blocks or tables
- empty and error state copy

Expected: a concrete mismatch list grouped by visible section.

**Step 3: Write the failing GT contract test**

Create `tests/revenue-gt-visible-parity.test.mjs` with assertions for the confirmed visible contract.

Expected: the new test fails until the UI is updated.

### Task 2: Implement the visible parity changes

**Files:**
- Modify: `src/app/pages/Revenue.tsx`

**Step 1: Update the top KPI and filter structure**

Adjust the visible KPI card taxonomy, filter ordering, labels, and GT-missing controls so the top section reads like GT.

Expected: the top portion of the page visually matches the GT.

**Step 2: Update the chart and supporting sections**

Align visible chart titles, legends, section headings, helper text, and any summary blocks or tables with GT wording and ordering.

Expected: the main revenue content looks like the GT in Chrome.

**Step 3: Update the empty/error presentation if needed**

Adjust visible empty state and retry/reset copy to the GT-facing contract without rewriting the underlying error handling model.

Expected: non-happy-path views remain visually aligned to GT expectations.

### Task 3: Verify and stabilize

**Files:**
- Modify: `tests/revenue-gt-visible-parity.test.mjs`
- Verify: `src/app/pages/Revenue.tsx`

**Step 1: Run the focused parity test**

Run: `node --test tests/revenue-gt-visible-parity.test.mjs`

Expected: PASS

**Step 2: Re-run the smallest relevant revenue test set**

Run the focused revenue tests affected by the visible parity changes.

Expected: PASS

**Step 3: Run production build**

Run: `.\\node_modules\\.bin\\vite.cmd build`

Expected: build succeeds, with any unrelated pre-existing warnings called out separately.

**Step 4: Recheck in Chrome**

Compare `http://localhost:5173/revenue` against the GT one more time.

Expected: no remaining visible mismatch worth filing as a frontend gap.

**Step 5: Commit**

```bash
git add src/app/pages/Revenue.tsx tests/revenue-gt-visible-parity.test.mjs docs/plans/2026-03-12-revenue-gt-visible-parity-design.md docs/plans/2026-03-12-revenue-gt-visible-parity.md
git commit -m "[fix] revenue GT visible parity align"
```
