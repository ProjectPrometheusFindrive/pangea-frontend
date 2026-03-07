# SCRUM-184 Premium CTA Support Routing

- Date: 2026-03-08
- Author: Codex
- Branch: `fix/SCRUM-184-premium-cta-routing`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-184
- Jira Status: `In Progress` during implementation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: `home`, `support-center`, `premium`, `routing`, `playwright`

## Start Context
- Jira `SCRUM-184` reported that Premium CTA entry points still showed a placeholder phone-number alert instead of leading users into a real inquiry flow.
- The same ticket also called out the Home `단말 OFF` KPI as a hard-coded `0`, which misleadingly implied live data instead of an unavailable metric.
- Work started from the latest GitHub `dev` branch in an isolated worktree with Jira already moved to `In Progress` and a plan comment recorded before impact analysis.

## Changes Summary
- Added a shared premium inquiry navigation helper so Premium CTA entry points in Home, Layout, and Vehicle Detail now route users to `SupportCenter` with source-specific prefilled title/content/category instead of opening an alert.
- Updated `SupportCenter` to consume the routed prefill safely, preserving manual-category fallback when the prefilled category is not present in the fetched category list and separating the submit flow from the admin management view to avoid conditional-hook instability.
- Replaced the Home `단말 OFF` hard-coded count with an explicit `데이터 없음` fallback and added CTA-driven Playwright coverage that verifies the real `/support-center` handoff and prefilled form state.

## Diffs & Files
- `src/app/utils/premiumInquiry.ts`
  - Added the shared SupportCenter prefill state builder and navigator used by all Premium CTA entry points.
- `src/app/pages/Home.tsx`
  - Routed the home premium modal CTA through the shared helper.
  - Changed the `단말 OFF` card to show `데이터 없음` instead of a hard-coded `0`.
- `src/app/components/Layout.tsx`
  - Routed the global premium banner CTA through the shared helper.
- `src/app/components/VehicleDetailModal.tsx`
  - Routed the vehicle-level premium upgrade CTA through the shared helper.
- `src/app/pages/SupportCenter.tsx`
  - Read navigation-state prefills, preserved manual-category handling, and split submit/admin views to keep hooks stable.
- `e2e/home.spec.ts`
  - Added a real home-to-support-center Premium CTA regression and a `단말 OFF` no-data assertion.
- `e2e/support-center.spec.ts`
  - Seeded authorization state so the existing admin/support-center regressions remain stable in Playwright.
- `docs/plans/2026-03-07-scrum-184-premium-cta-routing-design.md`
- `docs/plans/2026-03-07-scrum-184-premium-cta-routing-implementation.md`

## Validation
```bash
npm.cmd run test:e2e -- e2e/home.spec.ts
npm.cmd run test:e2e -- e2e/support-center.spec.ts
npm.cmd run build
```

## Notes
- Playwright verification was run against a fresh dev server from the isolated worktree after stopping a stale Vite process that had been serving code from the base repository on port `4173`.
- The build still emits the existing Vite chunk-size warning, but the production build completes successfully.
