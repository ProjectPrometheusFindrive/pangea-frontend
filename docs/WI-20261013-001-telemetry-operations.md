# Telemetry address and action navigation

- Last location uses existing Kakao Maps JS `services.Geocoder.coord2Address(longitude, latitude)`. Prefer road address, then parcel address. Send only the selected latest coordinate, no plate/VIN/customer. Keep observation time and coordinates visible and distinguish failed/empty lookup from a valid address.
- Address callbacks are cancelled logically when vehicle/tenant changes. SDK/geocoder waiting is bounded; maps fall back to the existing OSM renderer if the Kakao SDK is unavailable. Modal contents scroll on small screens.
- Telemetry notifications route to `/action-required?actionItemId=...`, overriding legacy reservation fallbacks. The action page fetches that authorized detail, even if absent from the current list page. Missing/forbidden cards show an error; no unrelated card is selected.
- Company settings expose `terminalOffMinutes` (60 by default, 5–1440). Explain explicit Geotab communication status, 15-minute poll gap reset, and manual completion after recovery. Do not infer OFF from parked GPS age.
- Validation: build passed; six Geotab Chromium E2E tests and nine targeted address/navigation unit tests passed. Production positive address and actual notification click verification follow paired deployment. Offline/fault scenarios are tested in isolated backend fixtures, not injected into production.

Reference: [Kakao coordinate-to-address documentation](https://apis.map.kakao.com/web/documentation/#services_Geocoder_coord2Address). Backend decisions and live verification: `docs/prompt_history/20261013_telemetry-operations.md` in Project_Prometheus_BE.
