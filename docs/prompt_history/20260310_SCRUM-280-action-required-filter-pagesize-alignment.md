# SCRUM-280 FE action required filter/pageSize 정렬

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-280-action-required-filter-pagesize-alignment`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-280
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-280,fe,action-required,filters

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-280.
- Objective: action required filter/pageSize 정렬 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- ActionRequired 페이지와 service가 size 대신 pageSize를 사용하고 status/priority/assignee 필터를 그대로 전달하도록 정리했습니다.
- 필터 a11y와 한국어 copy 회귀 테스트를 함께 고정했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-280-action-required-filter-pagesize-alignment.md`
- `src/app/pages/ActionRequired.tsx`
- `src/services/actionRequired.ts`
- `tests/action-required-filter-pagesize-alignment.test.mjs`

## Validation
```bash
node tests/action-required-filter-pagesize-alignment.test.mjs
node tests/admin-filter-form-a11y.test.mjs
node tests/korean-admin-copy.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.