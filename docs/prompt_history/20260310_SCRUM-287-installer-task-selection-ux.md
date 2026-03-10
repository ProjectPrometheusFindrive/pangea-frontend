# SCRUM-287 FE installer 작업 선택 기반 시작 UX

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-287-installer-task-selection-ux`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-287
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-287,fe,device-installation,installer

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-287.
- Objective: installer 작업 선택 기반 시작 UX and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- device installation 화면에 scheduled 작업 선택 패널을 추가해 installer가 기존 작업을 바로 시작할 수 있게 했습니다.
- 선택된 작업은 create 대신 status patch로 in_progress 전환하고 폼 값과 목록 refresh가 같이 동작하도록 정리했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-287-installer-task-selection-ux.md`
- `src/app/pages/DeviceInstallation.tsx`
- `src/services/deviceInstallations.ts`
- `tests/device-installation-task-selection-ux.test.mjs`
- `tests/device-installation-task-selection.test.mjs`

## Validation
```bash
node tests/device-installation-task-selection-ux.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.