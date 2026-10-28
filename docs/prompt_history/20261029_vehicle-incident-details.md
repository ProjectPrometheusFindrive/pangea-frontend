# WI-20261029-003 Vehicle fault details and incident history

## Prompt
Show Geotab diagnostic information and recommendations in fault issue cards; show newest-first incident cards in vehicle details linking to their issue cards; hide the premium upgrade prompt for installed vehicles.

## Assumptions
- FE/BE change using existing saved incidents; retain completed history.
- Origin/main includes the deployed telemetry implementation, which is absent in default origin/dev. Work isolated from the dirty primary checkout; User approved main as the PR target on 2026-10-29.

## Changes Summary
- Show diagnostic code/type, occurrence time, state at occurrence, provider inspection level, effect and recommended checks. Code 290 GoFault has a Korean summary plus preserved provider original text. Unknown codes keep original text; missing fields are explicitly unavailable. Device faults are distinguished from confirmed engine/battery faults.
- Vehicle detail sensor tab loads persisted fault/theft/accident/OFF incident cards, including completed cards, in API occurrence order; supports older-page loading, exact issue navigation, loading, retry and empty states.
- Vehicle links from issue table/detail open asset details directly on the incident-history tab. The related vehicle drawer also uses the same history component.
- Installed-device state from the API suppresses the upgrade prompt. Uninstalled vehicles retain it. Installed status does not claim the device is currently communicating.

## Affected Files
src/app/components/VehicleFaultEvidence.tsx, src/app/components/VehicleIncidentHistory.tsx, src/app/components/VehicleDetailModal.tsx, src/app/pages/ActionRequired.tsx, src/app/pages/Assets.tsx, src/services/assets.ts, e2e/vehicle-incidents.spec.ts.

## Validation
- Production Vite build passed (existing large-bundle warning).
- 8 Chromium E2E passed: existing Geotab flows and new evidence/history/device-state flows. Mobile-width fault content checked for horizontal overflow.
- Checked screenshots: docs/screenshots/vehicle-fault-evidence.png and docs/screenshots/vehicle-incident-history.png.
- Chrome DevTools could not attach because its shared browser profile was already in use; no existing user browser was stopped. Verification used Playwright and local screenshot inspection.
- Companion backend: 131 tests passed with isolated Mongo and loopback HTTP verification. No production writes or deployment performed.
