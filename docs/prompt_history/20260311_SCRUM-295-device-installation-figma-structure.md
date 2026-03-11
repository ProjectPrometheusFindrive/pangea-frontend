# SCRUM-295 Device Installation Figma Structure

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: feat/SCRUM-295-device-installation-figma-structure
- Jira Key: SCRUM-295
- Jira Status: Resolved
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/136
- Tags: device-installation,figma-parity,installer,prompt-history

## Start Context
- Rework the device-installation page so it follows the approved vehicle-first Figma structure.
- Keep the current backend workflow intact while exposing a UI-facing vehicle-first flow with explicit cancelled handling.

## Changes Summary
- Added scheduled-task vehicle selection and asset-backed vehicle metadata to the install workflow.
- Added explicit manual VIN and scheduled-at inputs so manual creation still covers the full payload contract.
- Reworked the table into a vehicle-first list with distinct cancelled status handling and separate installation/serial photo columns.
- Added regression tests for the new structure, scheduled-task selection path, cancelled taxonomy, and photo-column split.

## Diffs & Files
- `src/app/pages/DeviceInstallation.tsx`: reshaped the page around vehicle selection, explicit manual scheduling controls, cancelled display status, and split photo columns.
- `tests/device-installation-figma-structure.test.mjs`: added structural regression coverage for manual entry completeness, cancelled state handling, and photo-column separation.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests for the new structure, manual entry completeness, task selection, and status transitions.
- The display-status mapping stays UI-only and does not change the current backend workflow contract.
