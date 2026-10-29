# Accident confirmation filter — 2026-10-29

## Prompt
Add the customer accident-confirmation subtype to the Action Required filters and release through main.

## Changes
- Add `고객 사고 여부 확인` as the first detailed filter under `대여 중 사고`, before accident intake, evidence preparation and insurance-result follow-up.
- Use the existing subtype equality filter and the existing API value. No data migration or backend behavior change is required.
- Base the change on the latest `origin/main`; keep the user's existing checkouts and unrelated changes intact.

## Validation and release
- `npm run build` passed using the pinned Node.js 22.23.4 runtime; the existing bundle-size warning remains.
- Existing Chromium `e2e/geotab-telemetry.spec.ts`: 6 passed.
- Browser smoke against the built preview passed with synthetic API fixtures: the new subtype shows only pending accident-confirmation cards, the existing intake subtype still works, and `전체` restores both accident items. The theft fixture stays outside the accident category.
- Chrome DevTools could not attach because its existing browser profile was locked; used a separate Playwright browser for the smoke verification.
- [Screenshot with synthetic fixtures](../screenshots/accident-confirmation-filter.png).
- Release target: main, followed by Vercel production status and the same filter smoke against the public deployment. This is a frontend-only release.
