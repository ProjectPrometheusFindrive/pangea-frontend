# SCRUM-267 Home Action Items Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 홈 `관리해야 할 이슈` 카드 숫자를 `action-items` 기준으로 통일하고 `조치 필요 항목` 상세 및 4열 레이아웃 parity를 함께 복구한다.

**Architecture:** `action-items` 응답을 Home과 Action Required가 함께 해석할 수 있도록 공통 taxonomy/aggregation 유틸을 추가한다. Home은 이 집계 결과를 카드 count로 사용하고, Action Required는 기존 상세 목록 렌더링을 유지한다. 레이아웃은 Home issue grid class만 최소 수정한다.

**Tech Stack:** React, TypeScript, Vite, Node built-in test runner

---

### Task 1: Reopened Regression Tests

**Files:**
- Modify: `tests/home-actionrequired-alignment.test.mjs`
- Modify: `tests/home-issue-card-figma-parity.test.mjs`

**Step 1: Write the failing test**

- `Home.tsx`가 summary count 직접 참조(`alerts.overdue`, `kpis.unpaidContracts`) 대신 shared action-item count를 사용한다고 검증한다.
- Home issue grid가 `xl:grid-cols-4`를 사용한다고 검증한다.

**Step 2: Run test to verify it fails**

Run: `node --test tests/home-actionrequired-alignment.test.mjs tests/home-issue-card-figma-parity.test.mjs`

Expected: new assertions fail because current Home still uses summary count and 3-column desktop grid.

### Task 2: Shared Action Item Count Source

**Files:**
- Create: `src/app/utils/actionItemMetrics.ts`
- Modify: `src/services/actionRequired.ts`
- Modify: `src/app/pages/ActionRequired.tsx`
- Modify: `src/app/pages/Home.tsx`

**Step 1: Write minimal shared parsing/aggregation helpers**

- `action-items` payload를 공통 taxonomy로 normalize하는 helper를 추가한다.
- payload 전체에서 타입별 카운트를 계산하는 aggregator를 만든다.

**Step 2: Expose count-friendly data fetch**

- Home에서 `action-items` 목록/총계를 읽을 수 있도록 service layer를 확장한다.
- Action Required와 중복되는 normalize 규칙은 가능한 범위에서 shared helper로 이동한다.

**Step 3: Switch Home issue counts**

- Home issue cards가 shared action-item count를 사용하도록 교체한다.
- 클릭 동선, premium modal behavior, existing labels는 유지한다.

### Task 3: Layout Parity

**Files:**
- Modify: `src/app/pages/Home.tsx`

**Step 1: Restore desktop issue grid**

- issue grid wrapper를 desktop 4열 기준으로 조정한다.
- mobile/tablet 배치는 유지한다.

### Task 4: Verify

**Files:**
- Test: `tests/home-actionrequired-alignment.test.mjs`
- Test: `tests/home-issue-card-figma-parity.test.mjs`
- Test: `tests/home-priority-panel.test.mjs`

**Step 1: Run focused regression suite**

Run: `node --test tests/home-actionrequired-alignment.test.mjs tests/home-issue-card-figma-parity.test.mjs tests/home-priority-panel.test.mjs`

Expected: PASS

**Step 2: Sanity-check modified sources**

- Read back the touched files and confirm Home no longer binds reopened counts to `home/summary` fields directly.
- Confirm `xl:grid-cols-4` is present in the issue grid.
