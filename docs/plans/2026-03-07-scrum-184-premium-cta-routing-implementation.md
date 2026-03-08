# SCRUM-184 Premium CTA Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace placeholder premium CTA alerts with a real support-center inquiry flow and remove the hardcoded `단말 OFF` count from the home dashboard.

**Architecture:** Introduce one shared premium-inquiry navigation helper, then teach `SupportCenter` to consume prefill state from navigation. Keep the UI changes additive and localized so the three CTA entry points share one behavior while the home premium card clearly communicates missing device-off telemetry.

**Tech Stack:** React, TypeScript, React Router, Playwright, Vite

---

### Task 1: Add failing support-center prefill regression coverage

**Files:**
- Modify: `e2e/support-center.spec.ts`
- Modify later: `src/app/pages/SupportCenter.tsx`

**Step 1: Write the failing test**

- Add a rental-business support-center test that lands on `/support-center` with premium inquiry prefill state.
- Assert the submit form is shown.
- Assert category, title, and content fields are pre-populated with the premium inquiry defaults.

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- e2e/support-center.spec.ts`

Expected: FAIL because `SupportCenter` currently ignores navigation state.

**Step 3: Write minimal implementation**

- Parse prefill state in `SupportCenter`.
- Apply it once on first load.
- Switch to manual category mode when the prefill category is not part of the fetched category list.

**Step 4: Run test to verify it passes**

Run: `npm.cmd run test:e2e -- e2e/support-center.spec.ts`

Expected: PASS

**Step 5: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 2: Add failing home premium regression coverage

**Files:**
- Modify: `e2e/home.spec.ts`
- Modify later: `src/app/pages/Home.tsx`
- Modify later: `src/app/components/Layout.tsx`
- Modify later: `src/app/components/VehicleDetailModal.tsx`
- Modify later: `src/app/...` premium inquiry helper

**Step 1: Write the failing tests**

- Add a home test that opens the premium modal, clicks `지금 시작하기`, and asserts navigation to `/support-center`.
- Assert the home premium action area no longer displays a hardcoded `0` for `단말 OFF`.

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: FAIL because the CTA still uses `alert(...)` and the card still renders `0`.

**Step 3: Write minimal implementation**

- Add a shared premium inquiry navigation helper for the three entry points.
- Replace the `alert` handlers in `Home`, `Layout`, and `VehicleDetailModal`.
- Update the `단말 OFF` card to render an explicit no-data state instead of a numeric zero.

**Step 4: Run test to verify it passes**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: PASS

**Step 5: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 3: Final verification

**Files:**
- Verify modified files only

**Step 1: Run support-center regression**

Run: `npm.cmd run test:e2e -- e2e/support-center.spec.ts`

Expected: PASS

**Step 2: Run home regression**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: PASS

**Step 3: Run frontend build**

Run: `npm.cmd run build`

Expected: PASS

**Step 4: Commit**

- Skipped per user instruction: `git commit` forbidden
