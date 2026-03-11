# SCRUM-267 Home Action Items Alignment

- Date: 2026-03-11 11:48
- Author: Codex
- Branch: fix/SCRUM-267-home-action-items-alignment
- Jira Key: SCRUM-267 / SCRUM-288
- Jira Status: In Progress
- PR URL: PENDING
- Tags: home,action-required,figma-parity,prompt-history

## Start Context
- Reopened tickets SCRUM-267 and SCRUM-288 target the same Home `관리해야 할 이슈` panel in the FE repo.
- Home card counts and Action Required detail counts were inconsistent because Home used `/api/v2/home/summary` counters while Action Required used `/api/v2/action-items`.
- The desktop issue grid also regressed to 3 columns instead of the approved 4-column Figma layout.

## Assumptions
- Product direction is to keep the Home card drill-down target on `조치 필요 항목`.
- The fastest FE-safe fix is to align Home counts to the `action-items` basis rather than reworking the detail page away from that contract.

## Plan
- Add regression tests for reopened count-source alignment and desktop 4-column grid parity.
- Introduce a shared `action-items` type-count aggregation path for Home.
- Keep existing premium placeholder behavior while switching reopened card counts to the shared basis.

## Changes Summary
- Added `getActionItemTypeCounts` in the action-required service so Home can aggregate full `action-items` payloads by normalized issue type across pages.
- Switched Home issue-card counts for `반납 지연`, `미납/결제 문제`, `보험 만료 임박`, `정기점검 만료 임박`, `사고 접수`, and `도난 의심` to the shared action-items basis instead of directly binding reopened cards to `home/summary` counters.
- Changed the issue-panel helper copy to describe the cards as current Action Required counts rather than period-scoped summary values.
- Made the action-items count sync non-blocking so a count refresh failure keeps the Home summary visible and falls back to the previous/default issue-card counts.
- Restored the Home issue grid desktop layout to `xl:grid-cols-4` so the eight-card panel matches the approved Figma 4-column parity.
- Added regression coverage proving the reopened Home cards no longer use `alerts.overdue` / `kpis.unpaidContracts` directly and that the desktop issue grid keeps the 4-column layout.
- Updated `prompt_library` to capture this end-prompt evidence pattern for future Home issue/action-items alignment tickets.

## Diffs & Files
- `src/services/actionRequired.ts`: added normalized issue-type aggregation over paginated `action-items` responses.
- `src/app/pages/Home.tsx`: fetches shared action-item counts, stores them in the Home snapshot, uses them for issue-card counts, degrades count-sync failures to a banner instead of a blocking page error, and restores `xl:grid-cols-4`.
- `tests/home-actionrequired-alignment.test.mjs`: asserts reopened Home cards use `actionItemCountsByType` rather than `home/summary` count fields.
- `tests/home-issue-card-figma-parity.test.mjs`: adds a regression for the desktop 4-column issue grid.
- `docs/prompt_library/prompt_library_v1.md`: bumped to `v1.2.61` and added evidence guidance for this Home alignment pattern.

## Commands Used
```bash
node --test tests/home-actionrequired-alignment.test.mjs tests/home-issue-card-figma-parity.test.mjs
node --test tests/home-actionrequired-alignment.test.mjs tests/home-issue-card-figma-parity.test.mjs tests/home-priority-panel.test.mjs
cmd /c "set PATH=C:\Users\juhyu\Documents\pangea-FE-BE\pangea-frontend\node_modules\.bin;%PATH% && vite build"
```

## Validation
```bash
node --test tests/home-actionrequired-alignment.test.mjs tests/home-issue-card-figma-parity.test.mjs tests/home-priority-panel.test.mjs
cmd /c "set PATH=C:\Users\juhyu\Documents\pangea-FE-BE\pangea-frontend\node_modules\.bin;%PATH% && vite build"
```

## Notes
- `vite build` succeeded but emitted pre-existing duplicate-key warnings in `src/app/pages/Reservations.tsx`; they were not introduced by this change.
- Super-admin company-specific action-item scoping is still constrained by the current backend `action-items` contract and was not changed in this FE ticket.
