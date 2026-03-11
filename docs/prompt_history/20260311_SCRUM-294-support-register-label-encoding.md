# SCRUM-294 Support Register Label Encoding

- Date: 2026-03-11 08:45
- Author: Codex
- Branch: fix/SCRUM-294-support-register-label-encoding
- Jira Key: SCRUM-294
- Jira Status: Resolved
- PR URL: PENDING
- Tags: support-center,i18n,encoding,prompt-history

## Start Context
- Fix the broken Korean copy on the support-center submit button so the label renders as the intended `문의 등록`.
- Keep the E2E assertions aligned with the restored copy.

## Changes Summary
- Replaced the mojibake submit-button label with the intended Korean copy.
- Updated the support-center E2E assertion to lock the readable label in place.
- Added a focused regression test to catch future encoding regressions around nearby support-center copy.

## Diffs & Files
- `src/app/pages/SupportCenter.tsx`: restored the readable Korean submit label.
- `e2e/support-center.spec.ts`: aligned the E2E assertion with the intended label.
- `tests/support-center-encoding.test.mjs`: added regression coverage for encoding-sensitive support-center copy.
- `docs/prompt_library/prompt_library_v1.md`: bumped the prompt library version for this ticket.

## Notes
- Validation was run with targeted Node tests for encoding and company-scope regressions.
- The change is FE-only and does not alter the support API contract.
