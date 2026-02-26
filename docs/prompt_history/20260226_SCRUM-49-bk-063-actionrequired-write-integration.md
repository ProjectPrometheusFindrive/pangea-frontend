# SCRUM-49 BK-063 ActionRequired Write Integration

- Date: 2026-02-26 22:10
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-49-bk-063-action-required-write
- Tags: scrum-49,bk-063,frontend,action-required,write,integration,rollback

## Start Context
- Start Prompt 기준으로 Jira `SCRUM-49`를 먼저 분석하고 상태를 `진행 중`으로 전환한 뒤 작업 계획 코멘트를 등록했다.
- Jira AC 핵심: `PATCH /api/v2/action-required/{actionId}/status`, `PATCH /api/v2/action-required/{actionId}/memo` 연동, saving 표시, 성공 시 목록/상세 즉시 동기화, `400/403/409/5xx` 분기, 5xx/네트워크 Retry, 중복 요청 방지, 상태 변경 후 필터 이탈 처리.
- BK-062 조회 연동을 유지한 상태에서 쓰기 플로우만 최소 변경으로 확장하고 실패 시 롤백 동작을 추가하는 범위로 제한했다.

## Changes Summary
- `src/services/actionRequired.ts`에 ActionRequired 쓰기 API(`patchActionRequiredStatus`, `patchActionRequiredMemo`)를 추가했다.
- ActionRequired 쓰기 경로는 Jira AC의 `/action-required`를 우선 사용하고, 환경 차이 대응을 위해 `/action-items` legacy endpoint로 안전 fallback을 추가했다.
- `src/app/pages/ActionRequired.tsx`에서 상태 저장/해결 완료/메모 저장을 모두 비동기 쓰기 플로우로 전환했다.
- 쓰기 요청마다 saving 상태를 분리(`status/memo/resolve`)하고, 저장 중 버튼 비활성화로 중복 제출을 차단했다.
- 상태/메모 저장은 낙관적 업데이트를 먼저 반영한 뒤 실패 시 목록/상세/입력값을 롤백하도록 구성했다.
- 오류 분기는 `400/401/403/404/409/5xx/network`별 메시지로 분리했고, `5xx/network/aborted`는 Retry 버튼으로 재시도할 수 있게 했다.
- 상태 변경으로 현재 필터와 불일치할 경우 목록에서 즉시 제외되도록 처리해 필터 이탈 케이스를 반영했다.
- 성공 후에는 목록/상세를 재hydrate하여 서버 기준 상태로 재동기화되도록 했다.

## Diffs & Files
- `src/services/actionRequired.ts`
  - status/memo write API 함수 추가
  - `/action-required` 우선 호출 + legacy(`/action-items`) fallback
- `src/app/pages/ActionRequired.tsx`
  - `statusCode` 정규화 추가 및 상태 매핑 보강
  - 상태 저장/해결/메모 저장 핸들러를 API 연동으로 전환
  - 낙관적 업데이트 + 실패 롤백 + Retry + saving UI + 중복 클릭 방지 추가
  - 상세 패널에 write success/error 배너, Retry 버튼, 버튼별 saving 표시 추가
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.23로 업데이트
  - BK-063(ActionRequired 쓰기 연동) prompt_history 증빙 규칙 추가

## Validation
```bash
npm run
# scripts: build, dev

npm run build
# 1차 실패: vite not found (node_modules 미설치)

npm install --no-audit --no-fund
# 성공 (react-router engine warning: node >=20 권장)

npm run build
# vite build 성공 (chunk size warning only)
```

## Notes
- 현재 Node `v18.19.1` 환경에서 `react-router@7.13.0`의 engine warning(`>=20`)이 출력되지만 빌드는 정상 완료된다.
- BK-064에서 결제/예약/조치 간 상태 동기화를 결합할 때 ActionRequired status code(`pending/in-progress/resolved`)를 공통 이벤트 규약으로 재검증하는 것이 좋다.
