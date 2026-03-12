# Settings GT Visible Parity Design

## Goal

Align the Settings page with the GT screen at `Pangea_v2_v127` by matching the visible structure only. Keep the current settings APIs, save flows, and permission logic unless they directly block GT-visible parity.

## Findings

- GT opens the Settings page directly into a three-tab view:
  - `대량 업로드/다운로드`
  - `지오펜스`
  - `계정 관리`
- The current frontend shows a `회사 범위` selector and blocks the page for `super_admin` until a company is chosen.
- The current frontend also exposes a `회사 정보` tab that does not exist in GT.
- Because the page blocks before hydration, the GT-visible bulk upload content never renders for `super_admin`.

## Approaches

### 1. Visible parity only with automatic scope resolution

- Hide the `회사 범위` selector from the rendered screen.
- Automatically resolve a company scope for `super_admin` using the first available settings company when no company is selected.
- Remove the visible `회사 정보` tab from the tab strip and keep the GT tab order only.
- Preserve all existing settings fetch/save logic and only adjust the visible entry flow.

Recommendation: use this approach.

Why:
- It fixes the main GT mismatch without rewriting settings data flows.
- It keeps the backend/API contract untouched.
- It limits risk to the settings landing experience and tab rendering.

### 2. Full GT simplification of the settings page

- Remove the company scope flow entirely from the page state.
- Collapse company settings behavior into background logic or separate routes.

Why not:
- Much higher risk because the current settings implementation depends on company-scoped APIs.
- Unnecessary for the user requirement, which is visible parity only.

## Design

### Entry flow

- If the user is `super_admin` and `companyId` is missing, fetch the settings company list.
- Once the list is available, automatically set the first valid company as the effective scope.
- Do not render the scope selector card or the blocking empty panel.

### Tab contract

- Render only the GT tab strip:
  - `대량 업로드/다운로드`
  - `지오펜스`
  - `계정 관리`
- If the URL or internal state points to `company`, normalize it back to `bulk`.

### Bulk upload content

- Preserve the existing bulk upload UI and logic because it is already close to the GT structure.
- Re-check headings, CTA copy, and card order after the blocking selector is removed.

### Data and risk handling

- Continue loading company/geofence/member/invitation data with the resolved effective company scope.
- Keep save and mutation behavior unchanged.
- If company list loading fails for `super_admin`, fall back to the existing error handling path instead of inventing a new UI.

## Verification target

- `super_admin` opens `/settings` and sees the GT tab strip immediately.
- No visible `회사 범위` selector.
- No visible `회사 정보` tab.
- Bulk upload section headings and cards remain visible and ordered like GT.
