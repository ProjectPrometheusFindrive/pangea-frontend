# Wave 4 Reservation UX and Payment Polling Design

**Date:** 2026-03-07
**Tickets:** `SCRUM-177`, `SCRUM-179`, `SCRUM-180`, `SCRUM-200`, `SCRUM-201`, `SCRUM-202`, `SCRUM-203`
**Repos:** `pangea-frontend`, `Project_Prometheus_BE`

## Goal

Wave 4 closes the remaining reservation-list, calendar vehicle-row, and payment-polling bugs without touching `Project_Prometheus_BE_deploy`.

## Decisions

### 1. Reservation list pagination contract

- FE will stop sending both `size` and `pageSize` to `GET /api/v2/reservations`.
- BE will accept both `size` and `pageSize`, with `pageSize` taking precedence when both are provided, so existing callers do not break during rollout.

### 2. Calendar vehicle rows and model filter

- The reservation page will always fetch asset rows when the user can view assets, regardless of whether reservation rows exist.
- Calendar vehicle rows will be based on the full asset list, then reservation state will be overlaid on top of those rows.
- Reservation-only fallback rows remain only for cases where asset access is unavailable or asset hydration fails.

### 3. Payment polling strategy

- Completed reservations must be excluded from polling targets before the hook runs.
- `GET /api/v2/payments/status?reservationId=...` is the canonical polling source. FE will stop issuing per-payment detail fan-out when the status endpoint already returned items.
- Empty `items` from the status endpoint will be treated as a stable `not-found` result and cached so the same reservation is not polled forever.
- The hook cleanup will unify abort and timer teardown so fast navigation does not leave an interval race behind.

## Scope by Ticket

- `SCRUM-177`: standardize reservation list pagination query usage across FE and BE.
- `SCRUM-179`: make the vehicle model filter show actual asset models when reservations exist.
- `SCRUM-180`: keep non-reserved vehicles visible in the calendar even when some reservations exist.
- `SCRUM-200`: exclude completed reservations from payment polling.
- `SCRUM-201`: remove the status-then-detail N+1 polling behavior.
- `SCRUM-202`: make polling cleanup robust during rerender and unmount.
- `SCRUM-203`: treat empty payment status results as stable not-found and stop repeated polling.

## Testing Strategy

- FE utility test with Node/Vite SSR for `resolvePaymentStatuses`.
- FE E2E coverage for:
  - reservation list query parameters
  - calendar retaining all asset rows and model filter values
  - payment polling skipping completed reservations and not repeating for empty-payment reservations
- BE pytest coverage for reservation pagination alias handling.
- Cross-check with FE `npm run build` and BE targeted pytest before PR creation.
