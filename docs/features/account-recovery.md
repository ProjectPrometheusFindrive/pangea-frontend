# Account recovery

Login identifies the username as the signup email and links to `/forgot-password` and `/forgot-id`.

- `/forgot-password`: send a reset email through `/api/v2/auth/forgot-password`, show the generic response, allow resend after a 60-second countdown, and show API failures. Requesting a reset preserves the current password.
- `/reset-password#token=...`: remove the token from the address bar immediately, apply no-referrer policy, confirm the password twice and submit to `/api/v2/auth/reset-password`. Missing, expired or reused links can request a replacement. Success returns the user to ordinary login.
- `/forgot-id`: explain email-based login, search for signup/invitation mail, and contact the company administrator to request identity verification/escalation to Pangea operations. No public employee/account lookup is offered.

Validation on 2026-10-27: production build passed; 4 Playwright Chromium tests passed (navigation, generic success/cooldown, confirmation/expired-link errors, missing link). Configured chrome-devtools could not connect because its browser profile was already in use; Playwright provided browser verification. Backend actual local HTTP validation passed; real email delivery remains blocked by Mailgun 401 Forbidden. No production deployment.
