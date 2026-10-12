# Theft card evidence presentation

Approved scope: use 지정 구역 장기 체류 for the Geotab theft subtype, show detection evidence in the existing detail panel, and localize notifications with plates (backend). No pre-card status screen is introduced.

The detail panel shows the snapshot fence name, configured dwell threshold, first in-fence observation, triggering observation (KST), and elapsed time between observations when available. The explanation distinguishes an observed suspicion from confirmed theft and exact entry/continuous presence.

Legacy cards have no stored first-observed time: show 미기록 with an explanation. Never substitute current settings, current dwell state or browser time. The backend supplies an allowlisted evidence summary; no raw provider payload is rendered.

Validation: production build passed; all four `e2e/geotab-telemetry.spec.ts` Chromium tests passed, including complete/legacy evidence and tenant-correct recent-position requests from list/detail. Actual production card and notification verification follows paired deployment.
