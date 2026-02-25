# SCRUM-80 FE OpenAPI Canonical Link Migration

- Date: 2026-02-26
- Branch: `docs/SCRUM-80-openapi-canonical-link`
- Ticket: `SCRUM-80`
- Tags: scrum-80,docs,openapi,canonical,reference-only

## Start Context
- Start Prompt 핵심 조건:
  - base `dev`, worktree 기반 분리 작업
  - 브랜치 정책 준수(`dev` 대상 PR)
  - Jira 티켓 상태 `In Progress` 전환 및 작업 계획 코멘트 작성
- Jira 요구사항(AC):
  - FE repo OpenAPI 사본 파일 제거
  - FE 문서에 BE canonical 링크와 운영 규칙 명시
  - 문서 내 깨진 참조 링크 없음
- Canonical 기준 URL:
  - `https://github.com/ProjectPrometheusFindrive/Project_Prometheus_BE/blob/dev/docs/openapi/openapi_v2_draft.yaml`

## Changes Summary
- Jira `SCRUM-80`를 `진행 중`으로 전환하고 작업 계획(핵심 변경/검증 방향)을 코멘트로 등록했다.
- FE OpenAPI 사본 파일 `docs/api/openapi_v2_draft.yaml`를 제거했다.
- FE 참조 문서 `docs/api/README.md`를 신설해 canonical 링크 및 운영 규칙(사본 비유지, 링크 동기화 원칙)을 문서화했다.
- `README.md`의 BK-002 링크를 사본 파일에서 참조 문서로 교체했다.
- `planning/04_legacy_gap_apply_todo.md`의 BK-002 참조 경로를 canonical 참조 구조로 교체했다.
- `docs/prompt_library/prompt_library_v1.md`를 `v1.2.12`로 갱신하고, FE API 계약 문서의 canonical 참조-only 운영 규칙을 추가했다.

## Diffs & Files
- Updated: `README.md`
- Added: `docs/api/README.md`
- Deleted: `docs/api/openapi_v2_draft.yaml`
- Updated: `planning/04_legacy_gap_apply_todo.md`
- Updated: `docs/prompt_library/prompt_library_v1.md`
- Added: `docs/prompt_history/20260226_SCRUM-80-openapi-canonical-link.md`

## Validation
```bash
test -f docs/api/openapi_v2_draft.yaml
# exit code 1 (file removed)

rg -n -S '\(docs/api/openapi_v2_draft.yaml\)' README.md docs planning --glob '!docs/prompt_history/**'
# no matches

rg -n -S 'docs/api/README.md|ProjectPrometheusFindrive/Project_Prometheus_BE/blob/dev/docs/openapi/openapi_v2_draft.yaml' README.md docs planning --glob '!docs/prompt_history/**'
# README.md, planning/04_legacy_gap_apply_todo.md, docs/api/README.md matches confirmed
```

## Notes
- `docs/prompt_history`는 이력 보존 목적상 기존 파일을 수정하지 않았다.
- BE canonical 경로/브랜치가 변경되면 `docs/api/README.md`와 FE 참조 문서 링크를 같은 변경에서 동기화해야 한다.
