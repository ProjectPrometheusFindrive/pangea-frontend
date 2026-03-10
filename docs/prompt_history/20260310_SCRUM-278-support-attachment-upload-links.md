# SCRUM-278 FE support attachment 링크 업로드 반영

- Date: 2026-03-10
- Author: Codex
- Branch: `fix/SCRUM-278-support-attachment-upload-links`
- Jira: https://pangea-autos.atlassian.net/browse/SCRUM-278
- Jira Status: `In Progress` during documentation, `Resolved` planned after PR creation
- PR URL: Pending at commit time
- Tags: scrum-278,fe,support,attachments

## Start Context
- Worktree scope: FE branch isolated from `dev` for SCRUM-278.
- Objective: support attachment 링크 업로드 반영 and close the documented regression with per-ticket verification, PR creation, Jira sync, and cleanup.

## Changes Summary
- SupportCenter가 업로드 서명 결과의 attachment URL을 ticket payload에 반영하고 렌더링하도록 정리했습니다.
- super_admin company scope와 첨부파일 렌더링 회귀를 함께 고정했습니다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260310_SCRUM-278-support-attachment-upload-links.md`
- `src/app/pages/SupportCenter.tsx`
- `src/services/support.ts`
- `tests/support-attachment-upload-links.test.mjs`

## Validation
```bash
node tests/support-attachment-upload-links.test.mjs
node tests/support-center-company-scope.test.mjs
```

## Notes
- PR URL is left as `Pending at commit time` here and will be reflected in the Jira comment after PR creation.
- Worktree cleanup is performed only after push, PR creation, and Jira status update complete.