# Account recovery

## Prompt
Implement the proposed email reset and signup-email guidance, using the connected Gmail account for verification as needed.

## Assumptions
Local implementation and validation; preserve unrelated rental map work.

## Plan
Add public recovery routes, service calls, login links and browser regression coverage.

## Changes Summary
Login email label, request/reset/help pages, URL-fragment token removal, confirmation validation, cooldown, API error display and login navigation.

## Affected Files
src/app/pages/AccountRecovery.tsx; src/app/pages/Login.tsx; src/app/routes.ts (recovery routes only); src/services/auth.ts; e2e/account-recovery.spec.ts; docs/features/account-recovery.md.

## Validation
Build and 4 Playwright Chromium tests passed. Actual backend local reset/login/session checks passed. Real email receipt blocked by Mailgun 401. User authorized main release on 2026-10-27. Recovery-only changes isolated onto latest origin/main; upstream mobile login changes retained. Main-based build and 4 Chromium tests passed.
