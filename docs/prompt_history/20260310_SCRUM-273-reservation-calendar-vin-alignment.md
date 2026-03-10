# SCRUM-273 FE 예약 캘린더 VIN 우선 매칭 정렬

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-273-reservation-calendar-vin-alignment`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-273
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-273,fe,reservations,vin

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-273.
- Objective: 예약 캘린더 VIN 우선 매칭 정렬 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- 예약 캘린더가 차량 행을 찾을 때 vehicleNumber보다 VIN을 먼저 기준으로 매칭하도록 정렬했습니다.
- plate 정보가 비어 있는 예약도 VIN fallback으로 올바른 차량 행에 표시되도록 view model과 타입 계약을 맞췄습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-273-reservation-calendar-vin-alignment.md`
- `src/app/pages/Reservations.tsx`
- `src/app/pages/reservationsViewModel.ts`
- `src/app/types/reservations.ts`
- `tests/reservations-vin-fallback.test.mjs`

## Validation
```bash
node tests/reservations-vin-fallback.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.