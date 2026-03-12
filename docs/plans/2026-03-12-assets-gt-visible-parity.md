# Assets GT Visible Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the visible `Assets` screen to the `Pangea_v2_v127` GT baseline while keeping the current frontend data and API flow intact.

**Architecture:** Compare the live local `Assets` page against the GT build in Chrome, identify only user-visible mismatches, then adjust `Assets.tsx` rendering structure and copy without rewriting the underlying API model. Lock the GT-facing contract with focused source tests and verify with a production build.

**Tech Stack:** React, Vite, TypeScript, Chrome DevTools MCP, Node test runner

---

### Task 1: Capture the current GT mismatch map

**Files:**
- Modify: `src/app/pages/Assets.tsx`
- Create: `tests/assets-gt-visible-parity.test.mjs`

**Step 1: Open both screens side by side**

Run Chrome with:
- local app: `http://localhost:5173/assets`
- GT app: local `Pangea_v2_v127` assets route

Expected: both pages render and can be compared in the browser.

**Step 2: Record visible differences**

Check:
- top summary area
- search and filter controls
- list or table header structure
- row/card information hierarchy
- detail panel/modal structure
- button and helper copy

Expected: a concrete mismatch list grouped by visible section.

**Step 3: Write the failing GT contract test**

Create `tests/assets-gt-visible-parity.test.mjs` with assertions for the confirmed visible contract.

Expected: the new test fails until the UI is updated.

### Task 2: Implement the visible parity changes

**Files:**
- Modify: `src/app/pages/Assets.tsx`

**Step 1: Update the top-level screen structure**

Adjust the page header, summary cards, search area, filters, and action buttons to match GT-visible ordering and copy.

Expected: top portion of the page visually matches the GT.

**Step 2: Update the asset list/table presentation**

Adjust visible headers, labels, row content grouping, and any GT-missing visible controls.

Expected: the main list or table reads like the GT in Chrome.

**Step 3: Update the detail panel or modal**

Align visible section titles, field order, CTA placement, and helper text with the GT.

Expected: selected asset detail view looks like the GT.

### Task 3: Verify and stabilize

**Files:**
- Modify: `tests/assets-gt-visible-parity.test.mjs`
- Verify: `src/app/pages/Assets.tsx`

**Step 1: Run the focused parity test**

Run: `node --test tests/assets-gt-visible-parity.test.mjs`

Expected: PASS

**Step 2: Re-run related targeted tests if the page shares contracts with existing tests**

Run only the smallest relevant test set if additional assets-page tests exist.

Expected: PASS

**Step 3: Run production build**

Run: `.\\node_modules\\.bin\\vite.cmd build`

Expected: build succeeds, with any unrelated pre-existing warnings called out separately.

**Step 4: Recheck in Chrome**

Compare `http://localhost:5173/assets` against the GT one more time.

Expected: no remaining visible mismatch worth filing as a frontend gap.

**Step 5: Commit**

```bash
git add src/app/pages/Assets.tsx tests/assets-gt-visible-parity.test.mjs docs/plans/2026-03-12-assets-gt-visible-parity-design.md docs/plans/2026-03-12-assets-gt-visible-parity.md
git commit -m "[fix] assets GT visible parity align"
```
