# SCRUM-183 Home Overdue vs Unpaid Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate late-return and unpaid-contract counts in the home summary so the dashboard no longer shows duplicate values for distinct concepts.

**Architecture:** Add a new additive backend KPI field, `unpaidContracts`, while keeping `alerts.overdue` unchanged. Update the frontend home summary contract and bindings to consume the new field without broad refactors.

**Tech Stack:** Flask, pytest, OpenAPI draft YAML, React, TypeScript, Playwright, Vite

---

### Task 1: Add a failing backend regression test

**Files:**
- Modify: `tests/api/test_v2_home_summary.py`
- Modify later: `server/api/v2/home.py`

**Step 1: Write the failing test**

- Extend or add a home summary test that seeds:
  - one overdue late-return rental
  - one unpaid rental with `paymentStatus="미납"`
  - one paid rental with `paymentStatus="완료"`
- Assert:
  - `payload["data"]["statusCounts"]["alerts"]["overdue"] == 1`
  - `payload["data"]["kpis"]["overdueContracts"] == 1`
  - `payload["data"]["kpis"]["unpaidContracts"] == 1`

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/api/test_v2_home_summary.py -v`

Expected: fail because `unpaidContracts` is missing or still equals the overdue count.

**Step 3: Write minimal backend implementation**

- Add a local payment-status normalizer in `server/api/v2/home.py`
- Count `unpaidContracts` only for `미납|연체|unpaid|overdue`
- Keep `alerts.overdue` and `kpis.overdueContracts` bound to late-return logic

**Step 4: Run backend test to verify it passes**

Run: `python -m pytest tests/api/test_v2_home_summary.py -v`

Expected: PASS

**Step 5: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 2: Update backend contract docs

**Files:**
- Modify: `docs/openapi/openapi_v2_draft.yaml`

**Step 1: Update schema**

- Add `unpaidContracts` to the home summary KPI schema
- Keep the field additive and optional-safe for older clients, but document it in the draft contract

**Step 2: Re-run relevant backend verification**

Run: `python -m pytest tests/api/test_v2_home_summary.py -v`

Expected: PASS

**Step 3: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 3: Add a failing frontend regression test

**Files:**
- Create: `e2e/home.spec.ts`
- Modify later: `src/services/home.ts`
- Modify later: `src/app/pages/Home.tsx`

**Step 1: Write the failing test**

- Add a Playwright test that:
  - seeds auth session
  - mocks `GET /api/v2/home/summary`
  - returns `alerts.overdue = 3`, `kpis.overdueContracts = 3`, `kpis.unpaidContracts = 1`
- Assert the home dashboard renders:
  - `반납 지연` card with `3`
  - `미납/연체 계약` card with `1`

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: FAIL because the UI still reads `kpis.overdueContracts`.

**Step 3: Write minimal frontend implementation**

- Add `unpaidContracts` to `HomeSummaryKpis` and normalization defaults in `src/services/home.ts`
- Update `src/app/pages/Home.tsx`:
  - empty-state KPI detection
  - `미납/연체 계약` action card binding
  - contract distribution fallback label/value
- Leave overdue-specific score logic unchanged

**Step 4: Run frontend test to verify it passes**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: PASS

**Step 5: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 4: Final verification

**Files:**
- Verify modified files only

**Step 1: Run backend regression**

Run: `python -m pytest tests/api/test_v2_home_summary.py -v`

Expected: PASS

**Step 2: Run frontend regression**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: PASS

**Step 3: Run frontend build**

Run: `npm.cmd run build`

Expected: PASS

**Step 4: Commit**

- Skipped per user instruction: `git commit` forbidden
