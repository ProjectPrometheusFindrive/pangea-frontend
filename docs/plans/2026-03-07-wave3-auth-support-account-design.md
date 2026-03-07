# Wave 3 Auth, Permissions, Support, and Account Design

**Date:** 2026-03-07
**Tickets:** `SCRUM-174`, `SCRUM-176`, `SCRUM-204`, `SCRUM-205`, `SCRUM-206`, `SCRUM-207`, `SCRUM-208`, `SCRUM-210`
**Repos:** `pangea-frontend`, `Project_Prometheus_BE`

## Goal

Wave 3 closes the remaining auth/session, permission-contract, support-center, and account-withdraw bugs without touching `Project_Prometheus_BE_deploy`.

## Decisions

### 1. Auth and session handling

- `settings/company` must not be fetched before authentication is established.
- 401 recovery should have a single owner. The FE will keep refresh orchestration in `AuthContext` and remove the extra retry path from the generic API client.
- Session-expired UI must not block `/login`.

### 2. Permission contract

- The permission payload remains role-derived, but the contract expands to include:
  - `action.payments.write`
  - `action.support.manage`
- `member` keeps route access where appropriate, but loses write access that should be limited to `admin` and `super_admin`.
- BE mutation endpoints must enforce the same contract instead of relying on FE-only hiding.

### 3. Support-center behavior

- End users keep the existing inquiry submission flow.
- `admin` and `super_admin` see a management view instead of the submit form.
- The implementation reuses the existing support list/detail/status-change APIs already present on BE rather than introducing a new API family.
- Raw BE validation messages for `super_admin` support flows must be mapped to user-facing messages in FE.

### 4. Account deletion semantics

- “계정 삭제” will use the existing withdrawn-based soft delete flow.
- The FE will call a withdraw endpoint, clear session state, close account-setting UI, and redirect to `/login`.
- No hard delete API will be added in this wave.

## Scope by Ticket

- `SCRUM-176`: stop unauthenticated company fetches on login.
- `SCRUM-204`: remove duplicated 401 refresh/retry path.
- `SCRUM-205`: add and enforce payments write permission.
- `SCRUM-206`: add support management permission and admin/super-admin management view.
- `SCRUM-207`: reduce stale permission behavior by forcing permission refresh on focus/session refresh boundaries.
- `SCRUM-208`: prevent session-expired modal from blocking login.
- `SCRUM-210`: replace account-delete alert stub with real withdrawn flow + logout.
- `SCRUM-174`: replace raw support error exposure with admin-view routing and explicit message mapping.

## Testing Strategy

- BE: permission payload tests, payment status 403 tests, support permission/status tests, withdraw endpoint tests.
- FE: auth/session tests, support page role split tests, account-withdraw flow tests, permission refresh regression coverage.
- Cross-check: FE build and BE target pytest suite must pass before PR creation.
