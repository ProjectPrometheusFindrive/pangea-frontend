# SCRUM-23 OpenAPI v2 Draft

- Date: 2026-02-25 21:48
- Author: Codex
- Branch: feat/SCRUM-23-openapi-v2-draft
- Tags: scrum-23,bk-002,openapi,api-contract,v2,backend

## Start Context
- Start Prompt 핵심 절차:
  - Jira로 AC 확인 및 상태 전이
  - `dev` 최신화 후 `git worktree` 생성
  - 영향 범위 `rg` 검색
- Jira 요구사항:
  - Ticket: `SCRUM-23` (`[BK-002] OpenAPI v2 초안 작성`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md` BK-002
  - 완료 기준: 인증/자산/예약/조치/결제/매출/설정 최소 스펙 문서화
- 제약:
  - BK-001 용어집(`docs/common_glossary.md`)과 정합성 유지
  - AGENTS.md 준수, 최소/정밀 변경
  - 파괴적 git 명령 및 commit/push 미실행

## Changes Summary
- OpenAPI v2 초안 문서 신규 추가:
  - `docs/api/openapi_v2_draft.yaml` 생성
  - 인증/자산/예약/조치/결제/매출/설정 도메인의 최소 endpoint/요청/응답 스펙 정의
  - 공통 성공/에러 envelope, pagination, JWT security scheme, 도메인 enum 정의
- 프롬프트 라이브러리 규칙 갱신:
  - `docs/prompt_library/prompt_library_v1.md`를 `v1.2.4`로 업데이트
  - API 계약(OpenAPI/YAML) 작업 시 `prompt_history`의 `Validation` 섹션에 스펙 유효성 검증 결과를 명시하도록 규칙 추가
- 문서 탐색성 보강:
  - `README.md`에 BK-002 API 계약 문서 링크 추가
- 계획 체크리스트 반영:
  - `planning/04_legacy_gap_apply_todo.md`의 "API 계약서 초안 작성" 항목 완료 처리 및 산출물 링크 연결

## Diffs & Files
- `docs/api/openapi_v2_draft.yaml` (new)
- `docs/prompt_library/prompt_library_v1.md`
- `README.md`
- `planning/04_legacy_gap_apply_todo.md`
- `docs/prompt_history/20260225_SCRUM-23-openapi-v2-draft.md` (new)

## Validation
```bash
python3 - <<'PY'
import yaml
yaml.safe_load(open('docs/api/openapi_v2_draft.yaml', encoding='utf-8'))
print('YAML_OK')
PY

npx --yes @apidevtools/swagger-cli validate docs/api/openapi_v2_draft.yaml
# docs/api/openapi_v2_draft.yaml is valid
```

## Notes
- 본 문서는 BK-002 "초안" 범위이며, 구현 단계(BK-010/BK-011 이후)에서 실제 응답 포맷/필수 필드가 일부 조정될 수 있다.
- 본 문서는 `pangea-front` 기준 참조용 사본이며, 최신 OpenAPI 계약의 source of truth는 BE 저장소(`_legacy/Project_Prometheus_BE`)에서 관리한다.
- 다음 권장 태스크:
  - BK-010에서 라우팅 스켈레톤과 operationId/경로를 1:1 정렬
  - BK-011에서 공통 응답/에러 형식을 실제 런타임 포맷으로 확정
