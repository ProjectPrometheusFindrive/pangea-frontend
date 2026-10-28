# WI-20261029-004 Fault card diagnostic visibility

## Prompt
The live vehicle fault issue card still omits fault code, description and inspection guidance. Display those details, put the plate below its label, retain Korean guidance for known GoFault 290, and show original English provider descriptions/recommendations for unfamiliar codes.

## Findings
- Read-only authenticated production API returns faultDetails for the existing vehicle fault (290), reasonType=vehicle_fault, issueCode=vehicle.malfunction, and no notificationType.
- FE only recognized malfunction/anomaly names, ignoring vehicle_fault. More importantly, the diagnostic section was nested inside the notification-type condition, so the entire section disappeared.
- Previous E2E fixture supplied notificationType, which the actual v2 response does not include. Removing it reproduced the user's missing section before the fix.

## Changes Summary
- Render saved faultDetails independently of alert-type recognition. Recognize vehicle_fault for the alert banner as well.
- Explicit labels for 고장 코드, 고장 내용 and 점검 안내. Known GoFault 290 keeps its Korean summary with provider original text; unknown codes preserve exact name/recommendation strings, including newlines.
- Use block layout for the vehicle-number button so it appears below its label.
- FE-only change; no backend, collector, threshold or production-data edits. Continue main release target authorized for this workstream.

## Affected Files
src/app/pages/ActionRequired.tsx, src/app/components/VehicleFaultEvidence.tsx, e2e/vehicle-incidents.spec.ts, docs/screenshots/vehicle-fault-evidence.png.

## Validation
- Production build passed (existing bundle-size warning).
- Chromium regression suite: 9 tests, covering API-shaped responses without notificationType, unknown unclassified codes without any recognized alert type, exact original text/newlines, plate/label bounding boxes, mobile overflow, existing history and Geotab flows.
- Browser attachment through configured Chrome DevTools remains unavailable because its shared profile is already in use. Use isolated Playwright for verification; do not stop the user's browser.
