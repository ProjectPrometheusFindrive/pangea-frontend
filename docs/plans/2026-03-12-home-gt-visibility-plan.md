# Home GT Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the visible home screen match the GT baseline while retaining the current home data APIs.

**Architecture:** Keep the current `Home.tsx` data-fetching and navigation behavior, but replace the rendered home composition with the GT section structure and titles. Remove home-specific super-admin selector UI while preserving aggregate querying behavior.

**Tech Stack:** React, Vite, Node test source assertions, Playwright E2E, existing home summary and action-item services

---

### Task 1: Lock GT-visible expectations with tests

**Files:**
- Modify: `tests/dashboard-company-scope.test.mjs`
- Modify: `tests/home-score-layout-parity.test.mjs`
- Create or modify: `tests/home-gt-visible-parity.test.mjs`

**Step 1: Write the failing test**

Add assertions that:
- `Home.tsx` does not render company selector copy on home
- `Home.tsx` does not depend on `listSettingsCompanies`
- home uses `오늘 할 일`, `자산 현황`, `계약 현황`, `운영 점수`
- home does not render `관리해야 할 이슈`, `자산 운영 분포`, `계약 상태 분포`, `최근 변경`

**Step 2: Run test to verify it fails**

Run: `node --test tests/dashboard-company-scope.test.mjs tests/home-score-layout-parity.test.mjs tests/home-gt-visible-parity.test.mjs`

Expected: FAIL because current source still contains home company-scope wiring and non-GT labels/cards.

### Task 2: Align home rendering to GT

**Files:**
- Modify: `src/app/pages/Home.tsx`

**Step 1: Remove visible home-only company selection UI**

Keep aggregate behavior for `super_admin`, but do not render selector controls or selector loading/error states on home.

**Step 2: Restore GT-visible top section composition**

Render:
- one `오늘 할 일` section
- left task column with GT copy
- right issue grid without separate `관리해야 할 이슈` heading/subcopy

**Step 3: Restore GT dashboard titles and visible blocks**

Use GT-visible labels:
- `자산 현황`
- `계약 현황`
- `운영 점수`

Remove the visible `최근 변경` card and the score placeholder helper copy.

**Step 4: Keep premium section aligned**

Preserve the existing CTA behavior, but keep the visible premium section aligned to GT copy and structure.

### Task 3: Verify red-green cycle

**Files:**
- Re-run tests from Task 1

**Step 1: Run targeted tests**

Run: `node --test tests/dashboard-company-scope.test.mjs tests/home-score-layout-parity.test.mjs tests/home-gt-visible-parity.test.mjs`

Expected: PASS

**Step 2: Run build**

Run: `cmd /c npm run build`

Expected: build succeeds

### Task 4: Visual verification

**Files:**
- None required

**Step 1: Start local dev server**

Run the worktree locally and open `/`.

**Step 2: Compare against GT in Chrome**

Check visible parity for:
- section order
- titles
- card grouping
- button copy
- premium section

**Step 3: Note any remaining drift before moving to the next screen**

Capture any residual mismatch for the next pass.
