# NO-JIRA Repo Path Normalization

- Date: 2026-02-26 08:03 +0900
- Author: Codex
- Branch: chore/NO-TICKET-repo-path-replacement
- Tags: no-jira, docs, path-normalization, repo-metadata

## Start Context
- 목표: 문서/백로그에서 BE 저장소 표기를 canonical 값으로 통일.
- 치환 규칙:
  - legacy-prefixed BE repo path -> `Project_Prometheus_BE`
  - `pangea-front+{legacy-prefixed BE repo path}` -> `pangea-front+Project_Prometheus_BE`
- 제약: 최소/정밀 변경, 워크트리 격리, 불필요한 구조 변경 금지.
- Jira: 티켓 없음(`NO-JIRA`)으로 상태 전환/코멘트 단계는 생략.

## Changes Summary
- planning/docs 문서의 BE 저장소 표기를 canonical 값으로 통일했다.
- backlog seed CSV의 `Repo` 컬럼에서 `_legacy` 접두사를 전부 제거했다.
- `prompt_library_v1.md`에 canonical BE repo 표기 규칙을 추가하고 버전을 `v1.2.13`으로 갱신했다.

## Diffs & Files
- `planning/07_jira_backlog_seed.csv`: `Repo` 컬럼 문자열 전역 치환.
- `planning/01_current_repo_analysis.md`: 루트 구조 설명의 BE 경로 표기 정정.
- `planning/03_be_development_plan.md`: 목표 섹션 BE 레포 표기 정정.
- `planning/05_action_planning_cross_repo.md`: FE/BE 분리 설명 및 섹션 타이틀 표기 정정.
- `planning/06_jira_backlog_breakdown.md`: 사용 목적의 BE 레포 표기 정정.
- `docs/common_glossary.md`: Scope의 BE 레포 표기 정정.
- `docs/prompt_history/20260225_SCRUM-23-openapi-v2-draft.md`: Notes의 canonical source 설명 표기 정정.
- `docs/prompt_library/prompt_library_v1.md`: 버전/히스토리 갱신 및 canonical BE repo naming rule 추가.

## Validation
```bash
rg -n "_legacy/" -S .
# 결과: 매치 없음

git status --short
# 결과: 의도한 문서 파일만 변경됨
```

## Notes
- 티켓이 없는 작업이라 Jira `Resolved` 전환 및 Jira 코멘트 기록은 수행하지 않았다.
- 후속 Jira 연계가 필요하면 `NO-JIRA` 대신 실제 이슈 키로 동일 포맷 문서를 재작성하면 된다.
