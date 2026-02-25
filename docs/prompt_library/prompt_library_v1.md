# Prompt Library v1

- Version: v1.2.3
- Date: 2026-02-25
- Owner: Pangea Frontend Team
- Tags: prompt-library,workflow,branch-policy,history-policy,commit-policy,pr-automation,jira-traceability,end-prompt-protocol

## Context
- 초기 세팅 작업에서 프롬프트 템플릿, 브랜치 정책, 문서화 절차를 반복 가능하게 표준화할 필요가 있음.

## Goal
- Start/End Prompt를 기준으로 작업 재현성 확보.
- `dev -> production` 브랜치 운영 정책과 문서화 규칙을 일관되게 적용.
- 작업 기록(`prompt_history`)과 재사용 템플릿(`prompt_library`)의 연결 고정.
- 세션 시작 시점의 `Start Prompt` 작업분을 라이브러리와 분리해 히스토리에 보존.
- 문서 작업 종료 후 `Push` 및 한글 `PR` 생성까지 자동화.

## Documentation Scope
- 대상 문서: `docs/prompt_library/prompt_library_v1.md` (누적 관리, 신규 v2/v3 파일 생성 금지)
- 이력 문서: `docs/prompt_history/{YYYYMMDD}_{TICKET-ID}-{slug}.md` (작업 1건당 1파일)
- 본 워크플로우 수행 시 코드 변경 없이 문서 범위로 한정 가능해야 함.

## Version Policy

| 변경 범위 | 예시 | 버전 변화 |
|---|---|---|
| 구조적 섹션 추가 | 새로운 API Design Spec 추가 | +0.1 (minor) |
| 세부 내용 수정 | Blueprint Helper 문장 수정 | +0.0.1 (patch) |
| 전체 리팩터링 | 구조 재편, TOC 변경 | +1.0 (major) |

## System Prompt
```text
Follow repository AGENTS.md and keep changes minimal and precise.
Do not run destructive git commands. Respect branch policy: dev for integration, production for release.
```

## Developer Prompt (optional)
```text
Use rg for impact search.
Create a short execution plan before substantial edits.
For API changes, update docs/ together with code.
```

## User Prompt (canonical)
```text
Purpose: prompt_library and prompt_history documentation + automation (Push & PR)
Start Prompt work items must be recorded in prompt_history separately from prompt_library.

Start Prompt:
- Base branch: dev
- Work only through PR into dev
- Do not use main branch

End Prompt:
- Update docs/prompt_library/prompt_library_v1.md version metadata
- Add docs/prompt_history/{YYYYMMDD}_{task-summary}.md from template
- Commit step: do not run push/tag/rebase/reset
- Then run git push and create PR to dev in Korean (UTF-8)
```

## Prompt History Naming Rules
- 형식: `{YYYYMMDD}_{TICKET-ID}-{slug}.md`
- slug 규칙: lower-kebab-case, ASCII `[a-z0-9-]`, 3~8 단어
- 예시: `20260225_BK-003-bootstrap-branch-policy.md`
- Jira 티켓이 없는 작업은 `{TICKET-ID}`를 `NO-JIRA`로 표기
  - 예시: `20260225_NO-JIRA-planning-backlog-mcp-registration.md`

## Prompt History Capture Rules
- `prompt_history`는 최소 섹션 `## Start Context`, `## Changes Summary`, `## Diffs & Files`, `## Notes`를 포함한다.
- `Start Context`에는 Start Prompt 핵심 조건과 Jira 주요 요구사항(AC/제약)을 함께 요약한다.
- `Changes Summary`에는 실제 반영 결과를 범위별로 기술하고, `Diffs & Files`에는 주요 수정 파일을 명시한다.
- `Notes`에는 차기 권장 태스크만 기록하며 즉시 반영은 금지한다.
- `prompt_library`는 공용 규칙/템플릿만 관리하고, 세션 특이사항은 `prompt_history`에 기록.

## Inputs
- 작업 목표 한 줄
- 브랜치 네이밍 slug
- 변경 파일 목록
- 검증 명령 결과

## Outputs
- 업데이트된 `prompt_library_v1.md`
- 신규 `prompt_history` 기록 파일 1개
- 변경 요약(섹션 영향, 의도, 기대 효과)

## Usage
```bash
cp docs/prompt_history/_TEMPLATE.md docs/prompt_history/$(date +%Y%m%d)_your-task.md
# 작업 종료 시 prompt_library_v1.md Version/Date/Version History 갱신
```

## End-of-Task Checklist
- `prompt_library_v1.md` 상단 `Version`/`Date`/`Version History` 갱신
- `docs/prompt_history/_TEMPLATE.md` 기반 이력 파일 추가
- `prompt_history`에 `Start Prompt` 핵심 내용 및 반영 결과 포함
- 현재 작업 브랜치 `git push` 수행
- `dev` 대상 한글 PR 생성(UTF-8)
- 결과 출력에 아래 항목 포함:
  - 변경/추가된 파일
  - 주요 변경 요약
  - 다음 반영 대상 브랜치 (`dev`, PR 대상)
  - 배포 필요 시 (`dev -> production` PR)

## Commit Message Convention
- Subject: `Docs: update prompt_library to vX.Y.Z; add {YYYYMMDD}_{summary}.md`
- Body: `prompt_history`의 `Changes Summary` 상위 3~5개 bullet 요약
- 커밋 단계 금지: push / tag / rebase / reset

## Push & PR Convention
- Push: 현재 작업 브랜치를 원격에 반영 (`git push -u origin <branch>`)
- PR: `base=dev`로 생성, 제목/본문은 한글 작성, UTF-8 인코딩 준수
- Jira 티켓이 없는 경우 PR 본문의 `관련 티켓`에는 `Jira: 없음 (NO-JIRA)`로 명시
- PR 본문 기본 포함 항목:
  - 작업 요약
  - 상세 변경 내용 (Start Prompt 반영분 포함)
  - 비고 (Notes/Follow-ups 참조)

## Dependencies & Assumptions
- Default branch: `dev`
- Release branch: `production`
- `main` branch is not used
- `dev`/`production` protected (PR + review required)
- Production push triggers auto tag (`vX.Y.Z`)

## Version History
- v1.2.3 (2026-02-25, SCRUM-22): Clarify End Prompt documentation protocol with required prompt_history sections and ticket-linked capture rules.
- v1.2.2 (2026-02-25, NO-JIRA): Add NO-JIRA naming/PR fallback rules for non-ticket documentation runs.
- v1.2.1 (2026-02-25, BK-003): Update prompt_history naming convention to include Jira ticket ID for traceability.
- v1.2.0 (2026-02-25): Add Start Prompt capture rules and Push/PR automation convention (Korean PR to dev).
- v1.1.0 (2026-02-25): Add version policy table, prompt_history naming rules, end-of-task checklist, and commit message convention.
- v1.0.0 (2026-02-25): Initial baseline for prompt library + history workflow and branch policy alignment.
