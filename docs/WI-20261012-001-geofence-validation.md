# Geofence live validation UI support

The circle editor previously required clicks on a nationwide map and offered no coordinate or exact radius entry. Add labelled latitude, longitude and radius inputs connected to the existing map form and backend validation so an observed vehicle position can be entered accurately. Polygon behavior is unchanged.

Explain observation-based dwell, reset after excessive observation gaps, and that active fences are risk zones (normal parking can intentionally trigger a test).

Manual production acceptance: test-company scope, a 100 m circle around the current sample position, five-minute dwell and forty-five-minute observation gap, then wait for real collector observations and inspect the resulting theft action card. No simulated production location records are used.

## Live acceptance follow-up (2026-10-12, KST)

- The fence was registered through production settings at 10:44:33. Eligible real observations at 11:10:49 and 11:40:49 produced one open, medium-severity theft card at 11:45:04 (`TEL-2bcdd437f42d`, action `GEOTAB-ACTION:TEL-2bcdd437f42d`). Two tenant-recipient notification records were created. Continued parked observations did not create duplicate cards.
- The production list and detail panel displayed the mapped plate and theft alert. Direct browser verification then exposed `companyId is required for this request` in the recent-position modal for super admin.
- Root cause: action-item normalization discarded the API's `companyId`; the shared position modal already supported tenant scope, but this caller did not pass it. Preserve each item's company and pass it to the modal. This keeps cross-company super-admin lists correct without changing backend authorization or tenant-user defaults.
- Regression: a super admin with no home company opens maps for two different companies, then opens the second card's detail map. Each request must carry that card's company; mocks reject missing/wrong scope. Existing tenant-admin accident/map/mapping tests remain covered.
- Validation: production build passed; `e2e/geotab-telemetry.spec.ts` passed all four Chromium tests. Post-release browser verification is recorded in the backend acceptance document.

## Remaining UI improvements (not implemented in this change)

- Add a one-click vehicle-current-location center picker to avoid copying coordinates.
- Show entry time, last observation and observation-waiting status; a five-minute dwell threshold does not promise a notification five minutes after saving when parked reports arrive thirty minutes apart.
- Display the fence name, configured threshold and actual evidence timestamps in the card. Current detail copy is generic and `Vehicle theft suspected` remains English.
- Distinguish test/risk fences from safe parking areas clearly; the current rule intentionally treats any active fence as a suspicious-dwell zone.
