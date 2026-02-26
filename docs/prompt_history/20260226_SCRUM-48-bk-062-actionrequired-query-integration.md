# SCRUM-48 BK-062 ActionRequired Query Integration

- Date: 2026-02-26 20:40
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-48-actionrequired-query-integration
- Tags: scrum-48,bk-062,frontend,action-required,integration,api-v2

## Start Context
- Start Prompt 기준: `dev` 기반 격리 worktree에서 작업하고 Jira `In Progress` 전환 + 작업 계획 코멘트 등록 후 구현한다.
- Jira `SCRUM-48` AC 핵심: `GET /api/v2/action-required?page&size&status&priority` 및 `GET /api/v2/action-required/{actionId}` 연동, loading/success/empty/error 분기, 400/401/403/5xx 처리와 Retry, 중복 노출 방지, 필터-페이지 race 및 404 fallback 대응.
- 범위 제한: 상태 변경/메모 저장 API 연동은 BK-063 범위로 제외하고 조회 연동만 최소 변경으로 반영한다.

## Changes Summary
- `src/services/actionRequired.ts`를 추가해 ActionRequired 목록/상세 전용 API 클라이언트를 분리하고 `page/size/status/priority/assignee` 쿼리를 명시적으로 전달하도록 했다.
- `ActionRequired` 페이지에서 mock fallback 의존(`mockActionItems`, `mockPayments`)을 제거하고, 목록 응답을 단일 정규화 파이프라인으로 변환하면서 ID 기준 중복 제거를 적용했다.
- 서버 필터(`status`, `priority`, `assignee`)와 페이지/사이즈 상태를 UI에 추가하고, `usePageEndpointState` 기반 재요청으로 필터 변경 중 race를 abort+sequence로 차단했다.
- 상세 패널은 항목 선택 시 `/api/v2/action-required/{actionId}`를 호출하도록 변경했고, `404`는 목록 정보 fallback + 경고 배너로 처리해 패널 동작을 유지했다.
- 공통 페이지 상태 경계(`PageStateBoundary`)를 유지해 Retry, 401/403 액션, 빈 상태/오류 상태 흐름을 기존 패턴으로 일관화했다.

## Diffs & Files
- `src/services/actionRequired.ts`: ActionRequired 목록/상세 조회 API 함수 신규 추가.
- `src/app/pages/ActionRequired.tsx`: mock 제거, 목록/상세 정규화, 서버 필터+페이지네이션, 상세 404 fallback, 중복 제거 및 race-safe 조회로 전환.
- `docs/prompt_library/prompt_library_v1.md`: v1.2.18 메타데이터 및 BK-062 계열 prompt_history 증빙 규칙 추가.

## Validation
```bash
npm install --no-audit --no-fund
# 성공 (react-router engine warning only)

npm run build
# vite build 성공
# output: build success, chunk size warning only

npm run
# scripts: build, dev (test/lint 스크립트 미정의)
```

## Notes
- Node `v18.19.1` 환경에서 `react-router@7.13.0` engine warning(`>=20`)이 발생했지만, 실제 build는 정상 완료했다.
- BK-063에서 상태 변경/메모 저장 API를 연결할 때, 현재 페이지의 로컬 메모/상태 임시 동작을 서버 동기화 방식으로 치환해야 한다.
