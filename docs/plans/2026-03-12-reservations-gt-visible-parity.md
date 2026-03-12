# Reservations GT Visible Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the visible `Reservations` screen to the `Pangea_v2_v127` GT baseline while keeping the current frontend data and API flow intact.

**Architecture:** Compare the live local `Reservations` page against the GT build in Chrome, identify only user-visible mismatches, then adjust `Reservations.tsx` rendering structure and copy without rewriting reservation lifecycle, payment sync, or backend API integration. Lock the GT-facing visible contract with focused tests and verify with a production build plus browser recheck.

**Tech Stack:** React, Vite, TypeScript, Chrome DevTools MCP, Node test runner

---

### Task 1: Capture the current GT mismatch map

**Files:**
- Modify: `src/app/pages/Reservations.tsx`
- Create: `tests/reservations-gt-visible-parity.test.mjs`

**Step 1: Open both reservations screens side by side**

Run Chrome with:
- local app: `http://localhost:5173/reservations`
- GT app: local `Pangea_v2_v127` reservations route

Expected: both pages render and can be compared in the browser.

**Step 2: Record visible differences**

Check:
- top search, filter, and action controls
- calendar header and grid or list header structure
- visible status badges and helper copy
- selection detail panel or modal section order
- button labels and CTA grouping

Expected: a concrete mismatch list grouped by visible section.

**Step 3: Write the failing GT contract test**

Create `tests/reservations-gt-visible-parity.test.mjs` with assertions for the confirmed visible contract.

Expected: the new test fails until the UI is updated.

### Task 2: Implement the visible parity changes

**Files:**
- Modify: `src/app/pages/Reservations.tsx`

**Step 1: Update the top control area**

Adjust the visible search, filter, button labels, and any GT-missing controls so the top section reads like GT.

Expected: the top control area visually matches the GT.

**Step 2: Update the reservation calendar or list presentation**

Adjust visible headers, cell labels, card content grouping, and badge copy to match GT without replacing the current API model.

Expected: the main reservations body looks like the GT in Chrome.

**Step 3: Update the reservation detail presentation**

Align visible section titles, field order, CTA placement, and helper text in the selected reservation detail view or modal.

Expected: the reservation detail surface looks like the GT.

### Task 3: Verify and stabilize

**Files:**
- Modify: `tests/reservations-gt-visible-parity.test.mjs`
- Verify: `src/app/pages/Reservations.tsx`

**Step 1: Run the focused parity test**

Run: `node --test tests/reservations-gt-visible-parity.test.mjs`

Expected: PASS

**Step 2: Re-run the smallest relevant reservations test set**

Run the focused reservations tests affected by the visible parity changes.

Expected: PASS

**Step 3: Run production build**

Run: `.\\node_modules\\.bin\\vite.cmd build`

Expected: build succeeds, with any unrelated pre-existing warnings called out separately.

**Step 4: Recheck in Chrome**

Compare `http://localhost:5173/reservations` against the GT one more time.

Expected: no remaining visible mismatch worth filing as a frontend gap.

**Step 5: Commit**

```bash
git add src/app/pages/Reservations.tsx tests/reservations-gt-visible-parity.test.mjs docs/plans/2026-03-12-reservations-gt-visible-parity-design.md docs/plans/2026-03-12-reservations-gt-visible-parity.md
git commit -m "[fix] reservations GT visible parity align"
```
