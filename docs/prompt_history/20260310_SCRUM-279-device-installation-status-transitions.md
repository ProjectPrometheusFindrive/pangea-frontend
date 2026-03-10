# SCRUM-279 FE installer 상태 전이 버튼 정리

- Date: 2026-03-10
- Author: Codex
- Branch: `feat/SCRUM-279-device-installation-status-transitions`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-279
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-279,fe,device-installation,status

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-279.
- Objective: installer 상태 전이 버튼 정리 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- device installation 화면의 scheduled -> in_progress -> completed 전이 버튼 경로를 정리했습니다.
- 완료 버튼의 잘못된 인자 전달, 액션별 오류 메시지, 행 단위 disable 조건을 회귀 테스트와 함께 고쳤습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-279-device-installation-status-transitions.md`
- `src/app/pages/DeviceInstallation.tsx`
- `src/services/deviceInstallations.ts`
- `tests/device-installation-status-transitions.test.mjs`

## Validation
```bash
node tests/device-installation-status-transitions.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.