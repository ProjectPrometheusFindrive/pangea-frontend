# Prompt Library v1

- Version: v1.2.21
- Date: 2026-02-26
- Owner: Pangea Frontend Team
- Tags: prompt-library,workflow,branch-policy,history-policy,commit-policy,pr-automation,jira-traceability,end-prompt-protocol,worktree-cleanup,jira-status-sync,jira-comment-sync,ac-evidence,mock-removal

## Context
- 초기 세팅 작업에서 프롬프트 템플릿, 브랜치 정책, 문서화 절차를 반복 가능하게 표준화할 필요가 있음.

## Goal
- Start/End Prompt를 기준으로 작업 재현성 확보.
- `dev -> production` 브랜치 운영 정책과 문서화 규칙을 일관되게 적용.
- 작업 기록(`prompt_history`)과 재사용 템플릿(`prompt_library`)의 연결 고정.
- 세션 시작 시점의 `Start Prompt` 작업분을 라이브러리와 분리해 히스토리에 보존.
- 문서 작업 종료 후 `Push` 및 한글 `PR` 생성까지 자동화.
- PR 생성 직후 워크트리 정리와 Jira 상태(`Resolved`) 전환까지 종료 절차를 명시.
- Jira 티켓 작업 종료 시 핵심 변경/특이사항을 Jira 코멘트로 남겨 PR-이슈 추적성을 보강.

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
- 코드 변경이 포함된 Jira 티켓은 AC 항목별 구현 근거(파일/함수 기준)를 `Changes Summary` 또는 `Diffs & Files`에 반드시 남긴다.
- Assets 조회 연동 티켓(BK-042 계열)은 `prompt_history`에 `page/size/status/q` 쿼리스트링-API 파라미터 동기화와 `400/401/403/404/5xx` 분기 근거를 함께 기록한다.
- Assets 쓰기 연동 티켓(BK-043/SCRUM-39 계열)은 `prompt_history`에 create/patch/history 연동, dirty/saving/중복 제출 방지, `400 필드 오류/403 권한/409 충돌(입력 보존)/5xx 재시도 토스트` 분기 근거를 함께 기록한다.
- Assets mock 제거 티켓(BK-044/SCRUM-40 계열)은 `prompt_history`에 Assets 프로덕션 경로의 mock import/flag 제거 근거, v2 assets endpoint 단일 호출 경로, 오류 시 mock fallback 미사용 근거를 함께 기록한다.
- 공통 상태 UI 티켓(loading/error/empty)은 `Validation`에 `Retry 재호출`, `401/403/5xx 분기`, `skeleton/empty CTA` 확인 근거를 함께 기록한다.
- 인증 컨텍스트 교체 티켓(BK-021/BK-031 계열)은 `prompt_history`에 세션 저장 키, API 토큰 provider 연동 방식, role 매핑 규칙을 반드시 기록한다.
- 로그인/보호 라우트 티켓(BK-031 계열)은 `prompt_history`에 `returnUrl` 복귀 흐름, 로그인 `401/429/NETWORK_ERROR` 분기, `401 -> /auth/refresh 1회 -> 원요청 재시도` 순서를 반드시 기록한다.
- 인증 UX 정리 티켓(BK-032/SCRUM-35 계열)은 수동 로그아웃 토스트, 만료 모달+`returnUrl` 복구, `401` 연쇄 1회 종료, storage 토큰 정리 근거를 반드시 기록한다.
- ActionRequired 조회 연동 티켓(BK-062/SCRUM-48 계열)은 목록 쿼리(page/size/status/priority/assignee), 상세 조회(404 fallback), 필터 변경 race 방지 근거를 반드시 기록한다.
- 코드 변경이 포함된 Jira 티켓은 `Validation` 섹션에 최소 1개의 실행 명령 결과(`build` 또는 `test`)를 기록한다.
- 저장/수정 흐름 버그 티켓은 `Changes Summary` 또는 `Diffs & Files`에 성공/실패 분기 처리 근거(성공 시 동작, 실패 시 동작)를 모두 기록한다.
- `Notes`에는 차기 권장 태스크만 기록하며 즉시 반영은 금지한다.
- `prompt_library`는 공용 규칙/템플릿만 관리하고, 세션 특이사항은 `prompt_history`에 기록.
- API 계약 문서(OpenAPI/YAML) 변경 시 `Validation` 섹션에 스펙 유효성 검증 결과를 포함한다.
- FE에서 API 계약 문서가 외부 canonical(BE)로 관리될 경우, FE는 사본을 유지하지 않고 참조 문서(예: `docs/api/README.md`)와 canonical 링크만 유지한다.
- Jira 운영 규칙(BK-003 계열) 변경 시 `docs/jira_operating_rules.md`와 `planning/06_jira_backlog_breakdown.md`를 함께 동기화한다.
- `planning/local/06_jira_worktree_parallel_groups.md`를 갱신할 때는 Jira 스냅샷 기준일과 신규 티켓 범위를 문서 `기준` 섹션에 명시한다.
- `planning/local/06_jira_worktree_parallel_groups.md`를 갱신할 때는 BK 항목에 대응 `SCRUM` 번호를 병기하고 각 항목에 Jira browse 링크를 포함한다.
- 문서/백로그 메타데이터의 BE 저장소 표기는 `Project_Prometheus_BE`를 canonical로 사용하고 legacy 접두 경로 표기는 사용하지 않는다.

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
- PR 생성 완료 후 베이스 저장소에서 `git worktree remove <worktree-path>` 수행
- Jira 티켓 작업이면 PR 생성 직후 Jira 상태를 `Resolved`로 변경 (`NO-JIRA` 작업은 생략 사유 기록)
- Jira 티켓 작업이면 상태 전환 직후 핵심 변경 사항/특이사항/PR 링크를 Jira 코멘트로 기록
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
- Cleanup: PR 생성 후 베이스 저장소로 이동해 작업 워크트리를 제거 (`git worktree remove`)
- Jira 상태: 티켓이 있는 작업은 PR 생성 후 `In Progress -> Resolved` 전환, 티켓이 없는 작업은 `NO-JIRA`로 명시
- Jira 코멘트: 티켓 작업은 `Resolved` 전환 직후 핵심 변경 사항, 특이사항(리스크/검증), PR 링크를 코멘트로 남긴다.
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
- v1.2.21 (2026-02-26, SCRUM-40): Add prompt_history evidence rule for BK-044 assets mock removal (mock import/flag removal + API single-source + no fallback evidence).
- v1.2.20 (2026-02-26, SCRUM-39): Add prompt_history evidence rule for BK-043 assets write integration (create/patch/history + dirty/saving + 400/403/409(form preservation)/5xx branches).
- v1.2.19 (2026-02-26, SCRUM-48): Add prompt_history evidence rule for ActionRequired query integration tickets (list query params/detail 404 fallback/filter race handling).
- v1.2.18 (2026-02-26, SCRUM-34): Add prompt_history evidence rule for login/protected-route tickets (returnUrl restore, login 401/429/network branches, single refresh-retry order).
- v1.2.17 (2026-02-26, SCRUM-38): Add prompt_history capture rule for BK-042 assets read integration evidence (`page/size/status/q` sync + 400/401/403/404/5xx handling).
- v1.2.17 (2026-02-26, SCRUM-35): Add prompt_history evidence rule for logout/session-expiry UX tickets (toast/modal/returnUrl/single-run 401 cleanup/storage cleanup).
- v1.2.16 (2026-02-26, SCRUM-31): Add prompt_history evidence rule for common loading/error/empty UI tickets (Retry + 401/403/5xx + skeleton/empty CTA checks).
- v1.2.15 (2026-02-26, NO-JIRA): Add rule to annotate BK items with mapped SCRUM IDs and Jira browse links when updating local parallel-group planning docs.
- v1.2.14 (2026-02-26, SCRUM-30): Add prompt_history capture rule for auth-context migration tickets (session key, token provider wiring, role mapping evidence).
- v1.2.13 (2026-02-26, NO-JIRA): Add canonical BE repo naming rule (`Project_Prometheus_BE`) and disallow legacy-prefixed BE repo path in docs metadata.
- v1.2.12 (2026-02-26, SCRUM-80): Add rule to keep FE API-contract docs as canonical references only when BE owns the OpenAPI source.
- v1.2.11 (2026-02-26, SCRUM-78): Add prompt_history capture rule to document success/failure branch evidence for save-flow bug fixes.
- v1.2.10 (2026-02-26, NO-JIRA): Add rule to record Jira snapshot date and new-ticket scope when updating local parallel-group planning docs.
- v1.2.9 (2026-02-26, SCRUM-31): Require Jira completion comments (key changes, notable points, PR link) immediately after `Resolved` transition.
- v1.2.8 (2026-02-25, SCRUM-32): Add Jira comment update requirement to End-of-Task checklist after PR creation.
- v1.2.7 (2026-02-25, SCRUM-29): Require AC-to-code evidence and build/test validation records in prompt_history for code-delivery tickets.
- v1.2.6 (2026-02-25, NO-JIRA): Add End Prompt finalization rules for post-PR worktree cleanup and Jira status transition to `Resolved`.
- v1.2.5 (2026-02-25, SCRUM-24): Add synchronization rule for Jira operating rules docs (`docs/jira_operating_rules.md` and `planning/06_jira_backlog_breakdown.md`).
- v1.2.4 (2026-02-25, SCRUM-23): Add rule to record OpenAPI/YAML validation results in prompt_history `Validation` for API contract tasks.
- v1.2.3 (2026-02-25, SCRUM-22): Clarify End Prompt documentation protocol with required prompt_history sections and ticket-linked capture rules.
- v1.2.2 (2026-02-25, NO-JIRA): Add NO-JIRA naming/PR fallback rules for non-ticket documentation runs.
- v1.2.1 (2026-02-25, BK-003): Update prompt_history naming convention to include Jira ticket ID for traceability.
- v1.2.0 (2026-02-25): Add Start Prompt capture rules and Push/PR automation convention (Korean PR to dev).
- v1.1.0 (2026-02-25): Add version policy table, prompt_history naming rules, end-of-task checklist, and commit message convention.
- v1.0.0 (2026-02-25): Initial baseline for prompt library + history workflow and branch policy alignment.
