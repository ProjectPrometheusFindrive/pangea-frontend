# Password reset success guidance

## Prompt
After a successful password reset, the setup instructions still ask the user to choose an 8–128 character password, making it unclear whether the reset has completed.

## Changes Summary
When reset completes, show the title "비밀번호 변경 완료" and hide the setup instructions. Retain the server success message and link to login. Pre-submit guidance and failed-reset behavior are unchanged.

## Affected Files
src/app/pages/AccountRecovery.tsx; e2e/account-recovery.spec.ts; docs/screenshots/account-recovery/reset-success.png.

## Validation
Production build passed using Node 22.23.4. Account recovery Chromium suite: 5 passed, including setup-to-success transition, hidden instructions/form/new-link action, and return to login. Responses are mocked; no real account password changed.
