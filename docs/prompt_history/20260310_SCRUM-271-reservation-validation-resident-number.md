# SCRUM-271 FE 예약 생성 전화번호 검증과 SSN 입력 정리

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-271-reservation-validation-resident-number`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-271
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-271,fe,reservations,validation

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-271.
- Objective: 예약 생성 전화번호 검증과 SSN 입력 정리 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- 계약 생성 모달에서 지원되지 않는 customerSSN 입력과 폼 계약을 제거했습니다.
- 고객 전화번호를 010-0000-0000 형식으로 검증해 잘못된 입력은 다음 단계로 진행되지 않도록 막았습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-271-reservation-validation-resident-number.md`
- `src/app/components/NewContractModal.tsx`
- `tests/new-contract-validation.test.mjs`

## Validation
```bash
node tests/new-contract-validation.test.mjs
node tests/reservation-create-payment-payload.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.