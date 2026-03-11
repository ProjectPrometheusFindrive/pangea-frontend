# SCRUM-299 Super Admin Forbidden Route Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent `super_admin` from reaching `/forbidden` because of route-level permission denial while preserving existing restrictions for other roles.

**Architecture:** Keep the policy centralized in the auth layer. Add one shared privileged-role helper and apply it in `RequireAuth` so direct navigation and `returnUrl` restores both respect the same rule.

**Tech Stack:** React, TypeScript, React Router, Node built-in test runner

---

### Task 1: Lock the regression in tests

**Files:**
- Create: `tests/super-admin-route-guard.test.mjs`
- Test: `tests/super-admin-route-guard.test.mjs`

**Step 1: Write the failing test**

Add assertions that require:
- `src/services/auth.ts` to expose `isSuperAdminRole`
- `src/app/components/RequireAuth.tsx` to bypass route permission denial when the authenticated user is `super_admin`
- non-super-admin route denial to remain intact

**Step 2: Run test to verify it fails**

Run: `node --test tests/super-admin-route-guard.test.mjs`
Expected: FAIL because the helper and bypass do not exist yet.

### Task 2: Implement the minimal auth guard change

**Files:**
- Modify: `src/services/auth.ts`
- Modify: `src/app/components/RequireAuth.tsx`

**Step 1: Add shared helper**

Expose a small helper that normalizes role strings and returns `true` only for `super_admin`.

**Step 2: Apply central bypass**

Update `RequireAuth` to read the authenticated user role and skip route permission-based `/forbidden` redirects for `super_admin`.

**Step 3: Keep existing role gating**

Do not weaken `allowedRoles` handling for installer-only routes.

### Task 3: Verify

**Files:**
- Test: `tests/super-admin-route-guard.test.mjs`
- Test: `tests/auth-login-navigation.test.mjs`

**Step 1: Run targeted tests**

Run:
- `node --test tests/super-admin-route-guard.test.mjs`
- `node --test tests/auth-login-navigation.test.mjs`

Expected: PASS

**Step 2: Review changed files**

Read the edited sources and confirm the bypass is limited to `super_admin` route permission denial only.
