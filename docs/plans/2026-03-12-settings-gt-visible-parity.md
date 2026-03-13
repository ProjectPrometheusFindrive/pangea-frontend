# Settings GT Visible Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Settings page match the GT-visible layout by removing the visible company-scope gate and exposing only the GT tab strip.

**Architecture:** Keep the existing settings data layer and save flows. Change only the visible entry flow and tab rendering so `super_admin` users automatically hydrate into a company-scoped settings screen without seeing the company selector.

**Tech Stack:** React, React Router, Vite, local node:test source-contract tests, Chrome DevTools comparison

---

### Task 1: Normalize super-admin entry flow

**Files:**
- Modify: `src/app/pages/Settings.tsx`

**Step 1: Add an effective settings company scope helper**

- Introduce an `effectiveSettingsCompanyId` value that prefers the selected company and otherwise uses the first available company option for `super_admin`.

**Step 2: Remove visible blocking behavior**

- Replace the visible `shouldBlockSettingsSelection` gate with automatic hydration against the effective scope.

**Step 3: Keep failure handling intact**

- Preserve existing list-loading and endpoint error handling when no company option can be resolved.

### Task 2: Match the GT-visible tab strip

**Files:**
- Modify: `src/app/pages/Settings.tsx`

**Step 1: Hide GT-nonexistent controls**

- Remove the rendered `회사 범위` card.
- Remove the rendered `회사 정보` tab button.

**Step 2: Normalize invalid tab state**

- If current tab or URL state points to `company`, redirect or normalize it to `bulk`.

**Step 3: Keep remaining tabs in GT order**

- Ensure visible tab order is `대량 업로드/다운로드`, `지오펜스`, `계정 관리`.

### Task 3: Add parity tests

**Files:**
- Create: `tests/settings-gt-visible-parity.test.mjs`
- Modify: existing Settings-related test files only if needed

**Step 1: Add visible-contract assertions**

- Assert the source keeps the GT three-tab strip.
- Assert the source does not render `회사 범위` and `회사 정보` in the visible tab contract.

**Step 2: Add automatic scope assertions**

- Assert the page derives an effective company scope for `super_admin` from available company options.

### Task 4: Verify in browser and build

**Files:**
- No code changes required

**Step 1: Run focused tests**

- Run: `node --test tests/settings-gt-visible-parity.test.mjs`

**Step 2: Run build**

- Run: `node node_modules\\vite\\bin\\vite.js build`

**Step 3: Browser verification**

- Compare `http://localhost:5173/settings` against `http://127.0.0.1:4173/settings`
- Confirm the visible tab strip and initial content align with GT

### Task 5: Commit and PR

**Files:**
- Stage only Settings parity changes and tests

**Step 1: Commit**

- Commit message: `[fix] align settings page with GT visible layout`

**Step 2: Push and open PR**

- Push branch `codex/settings-gt-align`
- Open PR to `dev` with verification notes
