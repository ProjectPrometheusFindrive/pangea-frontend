# Prompt Library v1

- Version: v1.2.48
- Date: 2026-03-09
- Owner: Pangea Frontend Team
- Tags: prompt-library,workflow,branch-policy,history-policy,commit-policy,pr-automation,jira-traceability,end-prompt-protocol,worktree-cleanup,jira-status-sync,jira-comment-sync,ac-evidence,mock-removal,reservations-write,reservations-mock-removal,ocr-flow,revenue-api,revenue-trend-fallback,settings-api,payment-status-sync,home-api,home-summary,home-copy,i18n-regression,action-payment-mock-removal,support-center,rbac-permission-hardening,e2e-test-hardening,playwright-artifact-policy,device-installation-tenant-scope,authorization-loading-guard,auth-silent-refresh

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
- Add docs/prompt_history/{YYYYMMDD}_{TICKET-ID}-{task-summary}.md from template
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
- Reservations 조회 연동 티켓(BK-052/SCRUM-43 계열)은 `prompt_history`에 `page/size/status/from/to` URL-API 파라미터 동기화, 목록/상세 race-safe 조회, `from>to` 검증, `400/401/403/404/5xx` 분기 근거를 함께 기록한다.
- Reservations 쓰기 연동 티켓(BK-053/SCRUM-44 계열)은 `prompt_history`에 create/return/accident API 연동, 제출 중/중복 제출 방지, 생성 성공 시 상세 ID 동기화, `400 필드/폼 오류·403 권한·409 상태충돌·5xx 재시도 토스트` 분기 근거를 함께 기록한다.
- OCR 연동 티켓(BK-085/SCRUM-64 계열)은 `prompt_history`에 `assets/upload -> ocr/extract -> ocr/jobs/{jobId}` 흐름, polling 상태 전환(처리중/복귀), partial prefill 처리, re-upload 시 이전 OCR 제안 폐기, `400/413 파일 오류·5xx/timeout 재시도·수동 입력 fallback` 분기 근거를 함께 기록한다.
- Revenue API 연동 티켓(BK-074/SCRUM-56 계열)은 `prompt_history`에 `/api/v2/revenue/summary(from,to,granularity)` 및 `/api/v2/revenue/trend(from,to)` 파라미터 동기화, 기간/단위 변경 시 loading 갱신, empty-state, `400/401/403/5xx+network` 분기와 Retry/이전 스냅샷 복원 근거를 함께 기록한다.
- Revenue trend fallback bugfix tickets (SCRUM-193 series) must record evidence that summary success still renders page content when trend fails, page empty-state remains summary-driven, and the trend panel degrades to an inline retry state instead of a blocking page error.
- Home API 연동 티켓(BK-073/SCRUM-55 계열)은 `prompt_history`에 `/api/v2/home/summary(from,to,tenantId)` 파라미터 동기화, 기간 필터 변경 재조회, `loading/empty/401/403/5xx+network` 분기, race-safe 요청 처리와 재조회 실패 시 이전 스냅샷 유지 근거, null-safe 기본값 렌더 및 Home 런타임 mock 경로 제거 근거를 함께 기록한다.
- Home KPI 후속 티켓(SCRUM-183 계열)은 `prompt_history`에 `alerts.overdue`(반납 지연)와 `kpis.unpaidContracts`(미납/연체 계약) 분리 근거, Home -> Reservations 이동 시 `paymentScope=delinquent` 범위 동기화 근거, 라벨 기반 Playwright 회귀 검증 근거를 함께 기록한다.
- Home copy/i18n regression tickets (SCRUM-185 series) must record the exact localized string replacement, the rendered surface where the copy changed, and regression evidence that the Korean label is shown instead of the legacy English text. If Playwright reuses a running dev server, record whether `127.0.0.1:4173` was free or an isolated-port workaround was required.
- Settings API 연동 티켓(BK-075/SCRUM-57 계열)은 `prompt_history`에 company/geofences/members API 연결 근거, 회사 정보 dirty-check/부분 업데이트(schemaVersion 포함)/저장 상태 분기, 권한 기반 읽기전용 처리, `400 필드 오류·403 권한·409 충돌 재로딩·5xx+network 재시도`, 저장/미저장 상태 이탈 경고(beforeunload) 근거를 함께 기록한다.
- 고객센터 UI/연동 티켓(BK-087/SCRUM-66 계열)은 `prompt_history`에 `/api/v2/support/categories`, `/api/v2/support/tickets`, `/api/v2/support/tickets/{ticketId}` 연동 근거, 카테고리 loading/empty/직접입력 분기, 문의 submitting/중복 제출 방지/성공 ticketId 복구, `400/401/403/5xx+network` 분기와 Retry/권한 액션, 첨부파일 용량 제한 정책 반영 근거를 함께 기록한다.
- 역할 기반 메뉴/권한 하드닝 티켓(BK-076/SCRUM-58 계열)은 `prompt_history`에 `/api/v2/auth/me` + `/api/v2/permissions/me` 권한 소스 통합 근거, 메뉴/라우트/액션 권한 키 일관성, `401/403/5xx` 분기 시 deny-by-default 정책, role 변경/권한 캐시 TTL/테넌트 전환 시 재평가 근거를 함께 기록한다.
- FE E2E 보강 티켓(BK-091/SCRUM-69 계열)은 `prompt_history`에 login/assets/reservations/device-installation 핵심 플로우 테스트 근거, `loading->success` assertion, `401/403/5xx` 분기 assertion, flaky 제어값(retries/timeouts), 실패 산출물(trace/screenshot/video/report) 수집 정책 및 CI 워크플로우 연계 근거를 함께 기록한다.
- Premium CTA support follow-up tickets (SCRUM-184 series) must record prompt_history evidence for shared SupportCenter prefill routing across Home/Layout/VehicleDetailModal, preserved manual-category fallback when the prefetched category is not in the fetched list, and explicit no-data fallback for the `단말 OFF` card with a real CTA-based Playwright regression.
- FE 권한 계약 정렬 후속 티켓(SCRUM-101~114 후속 계열)은 `prompt_history`에 `/api/v2/permissions/me` 기본 계약(404 미사용, role별 permission payload 제공)과 `deny-by-default` 정책 공존 근거를 함께 기록한다.
- 권한 캐시 하드닝 후속 티켓(SCRUM-105 후속 계열)은 `prompt_history`에 `Authorization cache` source를 `api`로 제한하고 캐시 키/버전 롤오버로 legacy `role-fallback` 캐시를 무효화한 근거를 함께 기록한다.
- Device Installation 계약 정렬 후속 티켓(SCRUM-101~114 후속 계열)은 `prompt_history`에 목록 조회 mock 경로가 `/api/v2/device-installations/tasks` canonical 경로와 일치하는지 근거를 함께 기록한다.
- Device Installation 사전조회 tenant-scope 회귀 티켓(SCRUM-131 계열)은 `prompt_history`에 pre-check list 조회 호출의 `companyId` 전달 근거(super_admin cross-tenant 혼합 방지)와 non-super_admin 동작 유지 근거를 함께 기록한다.
- 회원가입 연동 티켓(SCRUM-145 계열)은 `prompt_history`에 약관 동의 단계(필수/선택), 중복확인(`/api/v2/auth/check-userid`), 가입 제출(`/api/v2/auth/register` 우선 + fallback 정책) 근거를 함께 기록한다.
- Reservations mock 제거 티켓(BK-054/SCRUM-45 계열)은 `prompt_history`에 Reservations 프로덕션 경로의 mock import/fixture 제거 근거, v2 reservations endpoint 단일 호출 경로, API 실패 시 mock fallback 미사용 근거를 함께 기록한다.
- Assets mock 제거 티켓(BK-044/SCRUM-40 계열)은 `prompt_history`에 Assets 프로덕션 경로의 mock import/flag 제거 근거, v2 assets endpoint 단일 호출 경로, 오류 시 mock fallback 미사용 근거를 함께 기록한다.
- 공통 상태 UI 티켓(loading/error/empty)은 `Validation`에 `Retry 재호출`, `401/403/5xx 분기`, `skeleton/empty CTA` 확인 근거를 함께 기록한다.
- 인증 컨텍스트 교체 티켓(BK-021/BK-031 계열)은 `prompt_history`에 세션 저장 키, API 토큰 provider 연동 방식, role 매핑 규칙을 반드시 기록한다.
- 로그인/보호 라우트 티켓(BK-031 계열)은 `prompt_history`에 `returnUrl` 복귀 흐름, 로그인 `401/429/NETWORK_ERROR` 분기, `401 -> /auth/refresh 1회 -> 원요청 재시도` 순서를 반드시 기록한다.
- 인증 UX 정리 티켓(BK-032/SCRUM-35 계열)은 수동 로그아웃 토스트, 만료 모달+`returnUrl` 복구, `401` 연쇄 1회 종료, storage 토큰 정리 근거를 반드시 기록한다.
- ActionRequired 조회 연동 티켓(BK-062/SCRUM-48 계열)은 목록 쿼리(page/size/status/priority/assignee), 상세 조회(404 fallback), 필터 변경 race 방지 근거를 반드시 기록한다.
- ActionRequired 쓰기 연동 티켓(BK-063/SCRUM-49 계열)은 상태 변경/해결 완료/메모 저장 API 연동 근거, saving 중복 제출 방지, 실패 시 낙관적 업데이트 롤백, `400/403/409/5xx+network` 분기와 Retry 제공 근거, 상태 변경 후 필터 이탈 처리 근거를 반드시 기록한다.
- 결제 상태 연동 통합 티켓(BK-064/SCRUM-50 계열)은 결제 상태 canonical 매핑/우선순위(다중 결제/부분환불/out-of-order timestamp) 근거, Reservations/Home/Action 화면 동기화 지점, `401/403/404/5xx+network` 분기와 last-known fallback + 재시도 UX 근거를 반드시 기록한다.
- Action/Payment mock 제거 티켓(BK-065/SCRUM-52 계열)은 Action/Payment 경로의 `mockData`/`mockPayments` 의존 제거 근거, 결제 상태 동기화가 `/api/v2/payments/status`와 `/api/v2/payments/{paymentId}`만 사용하도록 정리된 근거(`/api/v2/payments` list fallback 제거 포함), `401/403/404/5xx` 분기와 Retry, stale 응답 최신값 반영 근거를 반드시 기록한다.
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
cp docs/prompt_history/_TEMPLATE.md docs/prompt_history/$(date +%Y%m%d)_SCRUM-123-your-task.md
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
- Subject: `Docs({TICKET-ID}): update prompt_library to vX.Y.Z; add {YYYYMMDD}_{TICKET-ID}-{summary}.md`
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
- v1.2.48 (2026-03-09, Jira SCRUM-242): Record end_prompt evidence for 예약 생성 결제 필드 보존.
- v1.2.48 (2026-03-09, Jira SCRUM-241): Record end_prompt evidence for 알림 전체보기 페이지 연결.
- v1.2.48 (2026-03-09, Jira SCRUM-240): Record end_prompt evidence for 알림 딥링크 fallback 정리.
- v1.2.48 (2026-03-09, Jira SCRUM-239): Record end_prompt evidence for favicon 404 방지.
- v1.2.48 (2026-03-09, Jira SCRUM-238): Record end_prompt evidence for 멤버 예약 취소 버튼 숨김.
- v1.2.48 (2026-03-09, Jira SCRUM-237): Record end_prompt evidence for 알림 딥링크 fallback 정리.
- v1.2.48 (2026-03-09, Jira SCRUM-236): Record end_prompt evidence for favicon 404 방지.
- v1.2.48 (2026-03-09, Jira SCRUM-235): Record end_prompt evidence for 멤버 예약 취소 버튼 숨김.
- v1.2.48 (2026-03-09, Jira SCRUM-234): Record end_prompt evidence for 로그아웃 후 로그인 경로 404 방지.
- v1.2.48 (2026-03-09, Jira SCRUM-233): Record end_prompt evidence for 관리자 화면 한국어 카피 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-231): Record end_prompt evidence for 로그아웃 후 로그인 경로 404 방지.
- v1.2.48 (2026-03-09, Jira SCRUM-230): Record end_prompt evidence for 관리자 화면 한국어 카피 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-228): Record end_prompt evidence for super_admin 지오펜스 company scope 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-227): Record end_prompt evidence for 설정 CSV 저장 동작 정리.
- v1.2.48 (2026-03-09, Jira SCRUM-226): Record end_prompt evidence for 벌크 OCR 자산 쓰기 권한 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-225): Record end_prompt evidence for 완료 상태 사고접수 UI 가드.
- v1.2.48 (2026-03-09, Jira SCRUM-224): Record end_prompt evidence for 회사 정보 readiness 안내 정리.
- v1.2.48 (2026-03-09, Jira SCRUM-223): Record end_prompt evidence for 예약 조기 시작 차단 UI 가드.
- v1.2.48 (2026-03-09, Jira SCRUM-222): Record end_prompt evidence for 설정 페이지 tenant scope 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-220): Record end_prompt evidence for 예약 목록 VIN fallback 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-219): Record end_prompt evidence for 관리자 필터 폼 접근성 정렬.
- v1.2.48 (2026-03-09, Jira SCRUM-218): Record end_prompt evidence for 지오펜스 폴리곤 에디터 연동.
- v1.2.46 (2026-03-08, SCRUM-193): Add prompt_history evidence rule for Revenue trend fallback fixes (summary-first partial success, summary-driven empty-state, and trend-panel inline retry degradation).
- v1.2.46 (2026-03-07, SCRUM-185): Add prompt_history evidence rule for Home heading localization regressions, including exact copy replacement and the Playwright reused-server caveat/workaround.
- v1.2.46 (2026-03-08, SCRUM-184): Add prompt_history evidence rule for premium CTA support-center routing follow-up (shared SupportCenter prefill helper, manual-category preservation, `단말 OFF` no-data fallback, and real CTA-based Playwright coverage).
- v1.2.44 (2026-03-03, SCRUM-162): Add prompt_history evidence rule for auth/authorization silent-refresh UX hardening (initial bootstrap-only blocking, focus/visibility background refresh, and no full-screen auth fallback regression checks).
- v1.2.43 (2026-03-03, SCRUM-73): Add prompt_history evidence rule for BK-095 observability baseline (FE `X-Request-Id` propagation via API client interceptor, request/response trace context capture, and Chrome DevTools MCP-based header verification evidence).
- v1.2.45 (2026-03-07, SCRUM-183): Add prompt_history evidence rule for overdue/unpaid split on Home (`kpis.unpaidContracts`, Home->Reservations delinquent scope sync, and label-based Playwright regression coverage).
- v1.2.42 (2026-03-02, SCRUM-132): Add prompt_history evidence rule for Premium installation tenant consistency hardening (single request companyId across pre-check/create/409-recover/refresh, receipt session companyId persistence, and super_admin cross-tenant regression coverage).
- v1.2.41 (2026-03-02, SCRUM-147): Add prompt_history evidence guidance for authorization-loading stuck fixes (user metadata normalization guard, checking-to-ready transition safety, and /auth/me companyId-missing regression coverage).
- v1.2.40 (2026-03-02, SCRUM-145): Add prompt_history evidence rule for legacy-style FE signup flow alignment (약관 동의 단계, userId 중복확인, `/api/v2/auth/register` 우선/fallback 제출 경로 근거).
- v1.2.39 (2026-02-28, SCRUM-131): Add prompt_history evidence rule for Device Installation pre-check tenant scope regression (`companyId` 전달로 super_admin cross-tenant 혼합 방지 + non-super_admin 동작 유지 근거).
- v1.2.38 (2026-02-28, SCRUM-115): Add prompt_history evidence rule for authorization cache source hardening (`role-fallback` source 제거, cache key/version 롤오버로 stale 권한 캐시 무효화).
- v1.2.37 (2026-02-27, SCRUM-101~SCRUM-114): Add prompt_history evidence rule for Device Installation E2E contract alignment (list mock path `/api/v2/device-installations/tasks` canonical 유지 근거).
- v1.2.36 (2026-02-27, SCRUM-101~SCRUM-114): Add prompt_history evidence rule for FE E2E permission-contract alignment (`/api/v2/permissions/me` default mock 404 제거, role별 권한 payload 반환으로 deny-by-default 정책과 테스트 계약 정렬).
- v1.2.35 (2026-02-27, SCRUM-101~SCRUM-109/SCRUM-113): Add prompt_history evidence rule for FE follow-up batch fixes (canonical endpoint 정렬: settings/company + action-items + device-installations, permissions 파서 메타데이터 문자열 차단 + `*` 와일드카드 보존, Authorization refresh race-safe, ActionRequired 실패 rollback 재동기화 근거).
- v1.2.34 (2026-02-27, SCRUM-69): Add prompt_history evidence rule for BK-091 FE E2E hardening (login/assets/reservations/device-installation flows, loading-success + 401/403/5xx branches, retries/timeouts, and failure artifact policy with CI linkage).
- v1.2.33 (2026-02-27, SCRUM-58): Add prompt_history evidence rule for BK-076 role-based menu/route/action hardening (`/api/v2/auth/me` + `/api/v2/permissions/me` source integration, deny-by-default on 401/403/5xx, role/cache/tenant re-evaluation evidence).
- v1.2.32 (2026-02-27, SCRUM-66): Add prompt_history evidence rule for BK-087 support-center integration (categories/create/detail endpoints, loading-empty-manual-category flow, submit dedupe/receipt restore, 400/401/403/5xx+retry, attachment size policy evidence).
- v1.2.31 (2026-02-27, SCRUM-55): Add prompt_history evidence rule for BK-073 home API integration (`/api/v2/home/summary` param sync, filter requery, loading/error/empty + 401/403/5xx branches, race-safe + snapshot retention, mock path removal evidence).
- v1.2.30 (2026-02-27, SCRUM-52): Add prompt_history evidence rule for BK-065 Action/Payment mock removal (mock dependency removal + payments status/detail endpoints-only + retry/error/stale-response evidence).
- v1.2.29 (2026-02-27, SCRUM-56): Add prompt_history evidence rule for BK-074 revenue API integration (summary/trend param sync, loading/error/empty, 400/401/403/5xx+network retry and previous snapshot restoration evidence).
- v1.2.28 (2026-02-26, SCRUM-57): Add prompt_history evidence rule for BK-075 settings API integration (company/geofences/members wiring, dirty/partial-save/schemaVersion, RBAC read-only, 400/403/409/5xx+retry, beforeunload guard).
- v1.2.27 (2026-02-26, SCRUM-50): Add prompt_history evidence rule for BK-064 payment status sync integration (canonical mapping/priority + reservations-home-action sync + 401/403/404/5xx fallback+retry evidence).
- v1.2.26 (2026-02-26, SCRUM-64): Add prompt_history evidence rule for BK-085 OCR flow integration (upload/sign + extract/job polling + partial/reupload/fallback/error branches).
- v1.2.25 (2026-02-26, SCRUM-45): Add prompt_history evidence rule for BK-054 reservations mock removal (mock import/fixture removal + v2 reservations single-source + no fallback evidence).
- v1.2.24 (2026-02-26, SCRUM-49): Add prompt_history evidence rule for BK-063 ActionRequired write integration (status/resolve/memo API, optimistic rollback, duplicate-submit guard, 400/403/409/5xx+network+Retry branches, filter drift handling).
- v1.2.23 (2026-02-26, SCRUM-44): Add prompt_history evidence rule for BK-053 reservations write integration (create/return/accident, submitting guard, success detail ID sync, 400/403/409/5xx handling).
- v1.2.22 (2026-02-26, SCRUM-43): Add prompt_history evidence rule for BK-052 reservations read integration (`page/size/status/from/to` sync, list/detail race-safe fetch, `from>to` validation, 400/401/403/404/5xx branches).
- v1.2.21 (2026-02-26, SCRUM-40): Add prompt_history evidence rule for BK-044 assets mock removal (mock import/flag removal + API single-source + no fallback evidence).
- v1.2.20 (2026-02-26, SCRUM-39): Add prompt_history evidence rule for BK-043 assets write integration (create/patch/history + dirty/saving + 400/403/409(form preservation)/5xx branches).
- v1.2.19 (2026-02-26, SCRUM-48): Add prompt_history evidence rule for ActionRequired query integration tickets (list query params/detail 404 fallback/filter race handling).
- v1.2.18 (2026-02-26, SCRUM-34): Add prompt_history evidence rule for login/protected-route tickets (returnUrl restore, login 401/429/network branches, single refresh-retry order).
- v1.2.17 (2026-02-26, SCRUM-38): Add prompt_history capture rule for BK-042 assets read integration evidence (`page/size/status/q` sync + 400/401/403/404/5xx handling).
- v1.2.17.1 (2026-02-26, SCRUM-35): Add prompt_history evidence rule for logout/session-expiry UX tickets (toast/modal/returnUrl/single-run 401 cleanup/storage cleanup).
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
