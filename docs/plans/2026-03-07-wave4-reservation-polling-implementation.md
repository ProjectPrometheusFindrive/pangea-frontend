# Wave 4 Reservation UX and Payment Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close Wave 4 reservation query, calendar row/model, and payment polling bugs across `pangea-frontend` and `Project_Prometheus_BE`.

**Architecture:** Make FE `Reservations.tsx` own the canonical reservation query and always merge assets into the calendar row model, keep FE payment polling on the status endpoint only with stable not-found caching and stronger cleanup, and add a small BE compatibility change so `/api/v2/reservations` accepts both `size` and `pageSize` during rollout.

**Tech Stack:** React, TypeScript, Vite SSR tests, Playwright, Flask, pytest, GitHub PR workflow, Jira MCP

---

### Task 1: FE payment polling utility and hook

**Files:**
- Modify: `src/app/utils/paymentStatusSync.ts`
- Modify: `src/app/hooks/usePaymentStatusSync.ts`
- Create: `tests/payment-status-sync.test.mjs`

**Step 1: Write the failing test**

- Add Node/Vite SSR coverage for:
  - status endpoint results are used without per-payment detail fetch fan-out
  - empty `items` becomes `not-found`
  - cached `not-found` continues to resolve without inventing a retryable failure

**Step 2: Run test to verify it fails**

Run:
- `node --test tests/payment-status-sync.test.mjs`

Expected:
- FAIL because current polling still calls payment detail and does not treat empty status items as `not-found`

**Step 3: Write minimal implementation**

- Remove the per-payment detail loop that runs after `/payments/status`.
- Interpret an empty status-endpoint item list as `not-found` for reservation-based polling.
- Add a small exported reset helper if the new test needs deterministic cache reset.
- Refactor `usePaymentStatusSync` so interval cleanup and abort cleanup are managed together and stale interval callbacks cannot outlive the current run.

**Step 4: Run test to verify it passes**

Run:
- `node --test tests/payment-status-sync.test.mjs`

Expected:
- PASS

### Task 2: FE reservation query and calendar asset merge

**Files:**
- Modify: `src/app/pages/Reservations.tsx`
- Modify: `src/services/reservations.ts`
- Test: `e2e/reservations.spec.ts`

**Step 1: Write the failing test**

- Add FE coverage for:
  - reservation list request sends a single canonical page-size parameter
  - calendar still renders asset rows for vehicles without reservations when reservations exist
  - model filter includes real asset model names when reservations exist
  - completed reservations are excluded from payment polling targets

**Step 2: Run test to verify it fails**

Run the smallest targetable FE command available for the new reservation coverage. If local Playwright execution is blocked by host dependencies, document the exact blocked command and proceed only after the failure mode of the assertions is clear from the spec and mocks.

**Step 3: Write minimal implementation**

- Make `getReservationsList()` send only the canonical page-size query parameter.
- Always fetch assets in parallel with reservations when asset access exists, then merge reservation fallback rows over the asset-backed vehicle rows.
- Limit `paymentSyncTargets` to reservations whose contract status is still active.

**Step 4: Run FE verification**

Run:
- `npm run build`
- targeted FE reservation test command if runnable locally

### Task 3: BE reservation pagination compatibility

**Files:**
- Modify: `server/api/v2/reservations.py`
- Test: `tests/api/test_v2_reservations.py`

**Step 1: Write the failing test**

- Add pytest coverage showing:
  - `size` is accepted as an alias for `pageSize`
  - `pageSize` still wins when both are present

**Step 2: Run test to verify it fails**

Run:
- `/home/jh/code/Project_Prometheus_BE/.venv/bin/pytest -q tests/api/test_v2_reservations.py -k page`

Expected:
- FAIL because the API currently reads `pageSize` only

**Step 3: Write minimal implementation**

- Read `pageSize` first, then fall back to `size` in `list_reservations()`.
- Keep response payload shape unchanged.

**Step 4: Run test to verify it passes**

Run:
- `/home/jh/code/Project_Prometheus_BE/.venv/bin/pytest -q tests/api/test_v2_reservations.py -k page`

Expected:
- PASS

### Task 4: Cross-repo verification and handoff

**Files:**
- Modify if needed: `docs/prompt_history/...` entries required by repo workflow

**Step 1: Run final verification**

Run:
- FE: `node --test tests/payment-status-sync.test.mjs`
- FE: `npm run build`
- FE: targeted Playwright reservation spec if host dependencies allow it
- BE: `/home/jh/code/Project_Prometheus_BE/.venv/bin/pytest -q tests/api/test_v2_reservations.py tests/api/test_v2_payments.py`

**Step 2: Prepare PR handoff**

- Summarize ticket coverage by file and behavior.
- Create FE and BE PRs with Jira links for all Wave 4 tickets.
- Keep Jira in `진행 중` until PRs exist, then move to `Resolved`.
