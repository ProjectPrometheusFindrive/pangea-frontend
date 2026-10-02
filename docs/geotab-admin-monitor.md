# Geotab Super admin monitor — 2026-10-02

Route `/admin/geotab`; sidebar label **Geotab 수집 모니터**.
Only the raw `super_admin` role mounts the page and requests platform data.
Tenant admin/member accounts cannot enable it using route grants or companyId.
The backend independently enforces the role and authentication.

Shows unregistered devices by serial/provider ID, mapped vehicle plate/model,
and informational exact-VIN registration candidates without automatically
creating or linking a vehicle. Provider connection, driving state and data /
poll timestamps are separate. Latest-position and recent/Trip-route maps reuse
the existing OSM renderer with attribution and explicit no-GPS states.

Tenant assignment uses existing companies, explicit confirmation and optimistic
revision checks. Mapped devices must be unbound first. New assignments apply
only to subsequent data; no historical location ownership is rewritten.
Collector managed mode is required for ongoing delivery; the server, not the
browser or collector environment, resolves tenant ownership.

Default route/Trip window: seven days. API limits, sampling and missing GPS
are surfaced. Refresh is manual. Date labels are KST. No precise production
coordinates or credentials are stored in test fixtures/screenshots.

Validation: seven Geotab E2E scenarios pass, including 390px mobile layout,
unregistered and registered devices, confirmation, assignment conflict, direct
route denial and existing incident/map flows. Production build passes.
Actual local provider/browser validation found 22 recent Trip summaries and
624 GPS points in one selected Trip. Backend contract and decisions:
`Project_Prometheus_BE/docs/geotab_admin.md`.
