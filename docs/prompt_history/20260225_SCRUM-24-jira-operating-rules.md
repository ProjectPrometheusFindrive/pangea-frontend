# SCRUM-24 Jira Operating Rules

- Date: 2026-02-25 22:37 KST
- Author: Codex
- Branch: docs/SCRUM-24-jira-ops-rules
- Tags: scrum-24,bk-003,jira,labels,components,dor,dod,dependency

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 및 상태 점검
  - `dev` 최신화 후 `git worktree` 기반 분리 작업
  - `rg` 기반 영향 범위 분석 후 `update_plan` 등록
- Jira 요구사항:
  - Ticket: `SCRUM-24` (`[BK-003] Jira 운영 규칙 확정`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md` BK-003
  - 완료 기준: 라벨, 컴포넌트, DoR/DoD, 의존성 표기 규칙 확정
- 제약:
  - AGENTS.md 준수, 최소/정밀 변경
  - 파괴적 git 명령 및 commit/push 미실행

## Changes Summary
- Jira 운영 규칙 문서를 신규 작성해 라벨/컴포넌트/DoR/DoD/Depends On 매핑 규칙을 한 곳에 고정했다.
- `planning/06_jira_backlog_breakdown.md`의 Jira 섹션을 BK-003 확정 규칙 기준으로 갱신했다.
- `README.md`에 BK-003 운영 규칙 문서 링크를 추가해 접근성을 높였다.
- `docs/prompt_library/prompt_library_v1.md`를 `v1.2.5`로 업데이트하고, Jira 운영 규칙 문서 동기화 규칙을 추가했다.

## Diffs & Files
- `docs/jira_operating_rules.md` (new)
- `planning/06_jira_backlog_breakdown.md`
- `README.md`
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260225_SCRUM-24-jira-operating-rules.md` (new)

## Validation
```bash
rg -n "Jira 운영 규칙|DoR|DoD|Depends On|blocks A|v1.2.5|SCRUM-24" docs/jira_operating_rules.md planning/06_jira_backlog_breakdown.md README.md docs/prompt_library/prompt_library_v1.md
git status --short
git diff -- planning/06_jira_backlog_breakdown.md docs/jira_operating_rules.md README.md docs/prompt_library/prompt_library_v1.md docs/prompt_history/20260225_SCRUM-24-jira-operating-rules.md
```

## Notes
- 2026-02-25 조회 기준 Jira `SCRUM` 프로젝트 컴포넌트가 비어 있어, 컴포넌트 필드 적용 전까지 라벨 기반 운영을 병행하도록 규칙에 명시했다.
