# SCRUM-185 Home Summary Korean Translation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the home dashboard summary heading in Korean as `홈 요약`.

**Architecture:** Keep the fix local to the home page view and lock the behavior with a Playwright assertion that checks the visible heading text.

**Tech Stack:** React, TypeScript, Playwright, Vite

---

### Task 1: Add a failing UI regression assertion

**Files:**
- Modify: `e2e/home.spec.ts`
- Modify later: `src/app/pages/Home.tsx`

**Step 1: Write the failing test**

- Extend the existing home dashboard E2E test with:
  - `expect(page.getByRole('heading', { name: '홈 요약' })).toBeVisible();`

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: FAIL because the page still renders `Home Summary`.
Precondition: no unrelated Vite dev server should already be serving `127.0.0.1:4173`, or Playwright may reuse the wrong app instance.

**Step 3: Write minimal implementation**

- Change the heading text in `src/app/pages/Home.tsx` from `Home Summary` to `홈 요약`.

**Step 4: Run test to verify it passes**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: PASS
Precondition: verify Playwright is pointed at this worktree's dev server, not a reused server from another repo.

**Step 5: Commit**

- Skipped per user instruction: `git commit` forbidden

### Task 2: Final verification

**Files:**
- Verify modified files only

**Step 1: Run frontend regression**

Run: `npm.cmd run test:e2e -- e2e/home.spec.ts`

Expected: PASS
Precondition: if `127.0.0.1:4173` is already occupied by another local Vite server, use an isolated-port workaround instead of the default reused-server path.

**Step 2: Run frontend build**

Run: `npm.cmd run build`

Expected: PASS

**Step 3: Commit**

- Skipped per user instruction: `git commit` forbidden
