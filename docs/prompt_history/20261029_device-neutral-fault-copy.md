# WI-20261029-005 Device-neutral fault card copy

## Prompt
Replace Geotab/MyGeotab references in vehicle-fault issue cards with generic terminology. Use 단말기 원문 rather than 제공사 원문. Support the presentation of other device brands without emphasizing an integration vendor.

## Changes Summary
- Show 단말기 진단 without the provider-specific GoFault token.
- Use 단말기 관리 시스템 for the known code 290 voltage-check instruction.
- Label diagnostic descriptions, effects and guidance with 단말기 원문.
- Generalize MyGeotab/Geotab mentions within displayed provider text to device management system/device, case-insensitively. Preserve other English wording and newlines. Apply the same formatting to shared history summaries.
- Keep raw provider data and diagnostic classification unchanged; FE presentation only.

## Affected Files
src/app/components/VehicleFaultEvidence.tsx, e2e/vehicle-incidents.spec.ts, docs/screenshots/vehicle-fault-evidence.png.

## Validation
Production build and 3 targeted Chromium E2E tests passed. Existing assertions verify English text/newlines remain unchanged for unfamiliar codes; updated assertions check generic labels and absence of vendor names in the rendered code 290 card. Main remains the user-authorized release target for this workstream.
