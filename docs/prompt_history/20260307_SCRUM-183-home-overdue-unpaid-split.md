# SCRUM-183 Home Overdue Unpaid Split

- Date: 2026-03-07
- Author: Codex
- Branch: `fix/SCRUM-183-home-overdue-unpaid-split`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-183
- Jira Status: `진행 중` during implementation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: `home`, `reservations`, `payment-status`, `e2e`

## Start Context
- Jira `SCRUM-183` reported that Home showed identical values for overdue returns and unpaid contracts even though the concepts differ.
- Work started from latest GitHub `dev` in an isolated worktree with FE/BE split execution, Jira plan comment, and fresh impact analysis.
- Frontend acceptance focus was to display a payment-delinquent metric separately, keep overdue-return behavior intact, and preserve route-permission-safe navigation.

## Changes Summary
- Added `kpis.unpaidContracts` to the FE home summary contract and used that field for the unpaid/overdue card and the fallback contract distribution slice.
- Introduced a Home-only deep-link scope by mapping the unpaid card and fallback legend slice to `paymentScope=delinquent`, so the linked `Reservations` view matches the KPI definition without broadening the existing generic unpaid filter.
- Hardened the Playwright regression by asserting label-specific card values, verifying the fallback legend entry, and checking the navigation query that carries the delinquent scope.
- Seeded authorization cache and explicit auth/permission mocks in the E2E to keep the regression stable on Windows while preserving the app's real route guards.

## Diffs & Files
- `src/services/home.ts`
  - Added `unpaidContracts` to the home KPI type and response normalization.
- `src/app/pages/Home.tsx`
  - Added `buildReservationsFilterPath`.
  - Routed Home unpaid interactions through `home-unpaid` -> `filter=unpaid&paymentScope=delinquent`.
  - Updated fallback contract distribution to use the same scope.
- `src/app/pages/Reservations.tsx`
  - Added `paymentScope` parsing and reset behavior.
  - Applied an exact delinquent-payment filter for Home deep links while leaving the generic unpaid filter semantics unchanged.
- `e2e/home.spec.ts`
  - Replaced number-order scraping with label-based assertions.
  - Added explicit auth/permissions mocks, authorization cache seeding, and deep-link URL verification.
- `docs/plans/2026-03-07-scrum-183-home-overdue-unpaid-split-design.md`
- `docs/plans/2026-03-07-scrum-183-home-overdue-unpaid-split-implementation.md`

## Notes
- Validation:
  - `npm.cmd run build`
  - `npm.cmd run test:e2e -- e2e/home.spec.ts`
- The Playwright config uses POSIX-style inline env syntax in `webServer.command`, so on Windows this regression was verified by starting `vite` manually with `VITE_API_BASE_URL=http://127.0.0.1:4173` in the shell and then running Playwright against the reused server.
- This prompt history records the FE contract as implemented: `alerts.overdue` remains overdue-return logic, while `kpis.unpaidContracts` drives the unpaid/delinquent Home affordances.
