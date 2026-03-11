# SCRUM-295 Device Installation Figma Structure

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-295-device-installation-figma-structure
- Jira Key: SCRUM-295
- Jira Status: Resolved
- PR URL: PENDING
- Tags: device-installation,figma-parity,installer,prompt-history

## Start Context
- Rework the device-installation page so it follows the approved vehicle-first Figma structure.
- Keep the current backend workflow intact while exposing a UI-facing pending/completed/failed taxonomy.

## Changes Summary
- Added scheduled-task vehicle selection and asset-backed vehicle metadata to the install workflow.
- Reworked the table into a vehicle-first list with the expected columns for model year, health check, and photo slots.
- Added regression tests for the new structure, scheduled-task selection path, and status taxonomy.

## Diffs & Files
- `src/app/pages/DeviceInstallation.tsx`: reshaped the page around vehicle selection, display-status mapping, and the vehicle-first table.
- `tests/device-installation-figma-structure.test.mjs`: added structural regression coverage for the new page layout.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests for the new structure, task selection, and status transitions.
- The status mapping stays UI-only and does not change the current backend workflow contract.
