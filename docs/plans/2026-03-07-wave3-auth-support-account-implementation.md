# Wave 3 Auth, Permissions, Support, and Account Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close Wave 3 auth/session, permission, support-center, and account-withdraw bugs across `pangea-frontend` and `Project_Prometheus_BE`.

**Architecture:** Keep auth refresh ownership in FE `AuthContext`, expand the FE/BE permission contract just enough for payments/support, reuse the existing BE support APIs for admin management, and connect the existing withdrawn flow to the FE account-delete action. Avoid any deploy-repo or hard-delete work.

**Tech Stack:** React, TypeScript, Vite, Flask, pytest, GitHub PR workflow, Jira MCP

---

### Task 1: FE auth/session and company bootstrapping

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/context/AuthContext.tsx`
- Modify: `src/app/context/CompanyContext.tsx`
- Modify: `src/services/api/client.ts`
- Test: `e2e` auth/session regression spec or the closest existing FE auth coverage

**Step 1: Write the failing tests**

- Add FE coverage for:
  - login route does not trigger `GET /api/v2/settings/company` before authentication
  - session-expired modal does not block login interactions
  - only one refresh path is used when a protected request returns 401

**Step 2: Run the tests to verify they fail**

Run the smallest relevant FE test command available for the added coverage. If browser dependencies block local execution, at minimum list the target Playwright tests and verify the failure mode is the missing behavior, not a harness issue.

**Step 3: Write minimal implementation**

- Gate `CompanyProvider` refresh work on authenticated state.
- Keep refresh orchestration in `AuthContext`.
- Remove or disable the duplicate refresh retry path in `src/services/api/client.ts`.
- Suppress the session-expired modal when the current route is `/login`.

**Step 4: Run FE verification**

Run:
- `npm run build`
- the targeted FE test command for the new auth/session coverage

### Task 2: BE permission contract and withdraw surface

**Files:**
- Modify: `server/api/v2/permissions.py`
- Modify: `server/api/v2/payments.py`
- Modify: `server/api/v2/auth.py`
- Test: `tests/api/test_v2_permissions.py`
- Test: `tests/api/test_v2_payments.py`
- Test: `tests/api/test_v2_auth_endpoints.py`

**Step 1: Write the failing tests**

- Member permission payload no longer includes unsupported write grants.
- Admin/super_admin permission payload includes `action.payments.write` and `action.support.manage`.
- Member payment status patch gets 403.
- v2 auth exposes withdrawn flow for the FE account-delete action.

**Step 2: Run BE tests to verify they fail**

Run the new/targeted pytest cases directly.

**Step 3: Write minimal implementation**

- Expand `_permissions_for_role()` contract.
- Enforce payment status mutation role checks in `payments.py`.
- Add a v2 withdraw endpoint or a v2 wrapper over the existing withdrawn behavior so FE can stay on the v2 auth surface.

**Step 4: Run BE verification**

Run the targeted pytest files again and keep them green before moving on.

### Task 3: BE support management enforcement

**Files:**
- Modify: `server/api/v2/support.py`
- Test: `tests/api/test_support_tickets.py`

**Step 1: Write the failing tests**

- Support list/status flows behave correctly for `member`, `admin`, and `super_admin`.
- Unauthorized roles get friendly 403 behavior.
- Raw `companyId is required for super_admin` leakage is no longer the effective FE-facing behavior path for admin management usage.

**Step 2: Run the tests to verify they fail**

Run the targeted support pytest cases.

**Step 3: Write minimal implementation**

- Align role checks and error messages with the new `action.support.manage` meaning.
- Preserve current tenant scope behavior while making admin-management flows explicit and predictable for FE consumption.

**Step 4: Run BE verification**

Run support pytest again and keep the file green.

### Task 4: FE permissions, support-center management view, and account withdraw

**Files:**
- Modify: `src/app/authorization.ts`
- Modify: `src/app/context/AuthorizationContext.tsx`
- Modify: `src/app/pages/SupportCenter.tsx`
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/services/auth.ts`
- Modify: `src/services/support.ts`
- Test: `e2e/support-center.spec.ts`
- Test: account/auth flow coverage close to `Layout` and support interactions

**Step 1: Write the failing tests**

- Admin/super_admin support page renders management UI instead of submit form.
- Member still sees submit form only.
- Permission refresh happens after focus/session refresh boundaries.
- Account delete calls the withdraw API, logs out, and lands on `/login`.

**Step 2: Run the tests to verify they fail**

Run the smallest FE test command that exercises the new support/account coverage.

**Step 3: Write minimal implementation**

- Add `action.payments.write` and `action.support.manage` to FE permission constants.
- Force permission refresh where the stale-cache bug currently survives.
- Reuse the existing support service helpers for management list/detail/status update UI.
- Replace the account delete alert stub with the real withdraw request, logout, and redirect flow.
- Map support errors to user-facing messages instead of exposing raw backend text.

**Step 4: Run FE verification**

Run:
- `npm run build`
- targeted FE test command for support/account coverage

### Task 5: Cross-repo verification and handoff

**Files:**
- Modify if needed: `docs/prompt_history/...` entries required by the repo workflow

**Step 1: Run final verification**

Run:
- FE: `npm run build`
- BE: `/home/jh/code/Project_Prometheus_BE/.venv/bin/pytest -q tests/api/test_v2_auth_endpoints.py tests/api/test_v2_permissions.py tests/api/test_v2_payments.py tests/api/test_support_tickets.py`

**Step 2: Prepare PR handoff**

- Summarize ticket coverage by file and behavior.
- Create FE and BE PRs with Jira links for all Wave 3 tickets.
- Keep Jira in `진행 중` until PRs exist, then move to `Resolved`.
