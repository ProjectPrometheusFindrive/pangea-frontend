# SCRUM-73 BK-095 Observability Baseline (FE)

- Date: 2026-03-03 00:27
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-73-observability-baseline
- Jira Key: SCRUM-73
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-73,bk-095,frontend,observability,trace-id,api-client

## Start Context
- Start Prompt 기준으로 `SCRUM-73` 상태를 `진행 중`으로 전환하고 작업 계획 코멘트를 Jira에 기록했다.
- 본 배치에서는 FE/BE 공통 traceId baseline을 구축하되, 실제 외부 연동(Sentry/알림 채널)은 ENV 토글형(no-op 기본값)으로 제한했다.
- FE는 Chrome DevTools MCP를 사용해 네트워크 요청 헤더(`X-Request-Id`) 전파를 검증했다.

## Assumptions
- 운영 알림 채널/외부 Sentry DSN은 이번 배치에서 필수 조건이 아니며, 클라이언트 측 이벤트 훅만 제공한다.
- API 계약은 기존 엔드포인트/응답 구조를 깨지 않고 관측성 메타데이터를 추가하는 범위로 제한한다.

## Plan
- API client에서 요청마다 `X-Request-Id`를 생성/전파한다.
- request/response trace context를 타입과 컨텍스트에 포함한다.
- 관측성 이벤트 emit 모듈을 추가하고 ENV 토글로 활성화한다.
- 빌드 검증 및 Chrome DevTools MCP 네트워크 증거를 남긴다.

## Changes Summary
- `src/services/api/client.ts`
  - 요청 생성 시 `X-Request-Id` 자동 부여 로직을 추가했다.
  - request/response trace context(`requestId`, `responseRequestId`, `requestStartedAtMs`)를 유지하도록 확장했다.
  - 성공/실패 응답에 대해 관측성 이벤트를 emit하도록 연결했다.
- `src/services/observability.ts`
  - `VITE_OBSERVABILITY_ENABLED` 토글 기반 API 이벤트 emit 유틸을 신규 추가했다.
  - 브라우저 환경에서는 `CustomEvent('pangea:observability')`로 이벤트를 발행한다.
- `src/services/api/types.ts`, `src/services/api/index.ts`
  - trace context 타입(`ApiRequestTrace`)을 추가/노출해 인터셉터 체인에서 추적 가능한 형태로 맞췄다.

## Diffs & Files
- `src/services/api/client.ts`: request-id 생성/전파, trace 컨텍스트, observability emit 추가
- `src/services/api/types.ts`: `ApiRequestTrace` 타입 및 context trace 필드 추가
- `src/services/api/index.ts`: `ApiRequestTrace` export 추가
- `src/services/observability.ts`: 토글형 observability 이벤트 emit 신규 파일
- `docs/prompt_library/prompt_library_v1.md`: v1.2.43 버전 히스토리 반영
- `docs/prompt_history/20260303_SCRUM-73-bk-095-observability-baseline.md`: 작업 이력 문서 신규

## Commands Used
```bash
npm.cmd install
npm.cmd run build
```

## Validation
```bash
# FE build
npm.cmd run build

# Chrome DevTools MCP 네트워크 검증 요약
# - OPTIONS /api/v2/auth/login preflight:
#   access-control-request-headers: content-type,x-request-id
# - POST /api/v2/auth/login request headers:
#   x-request-id: <uuid>
```

## Notes
- 로컬 BE CORS 기본값이 `http://localhost:5173`으로 고정되어 있어 `http://127.0.0.1:4173`에서 로그인은 CORS로 실패했다.
- 다만 네트워크 캡처에서 preflight와 실제 POST 요청 모두 `x-request-id` 전파가 확인되어 FE 측 목표는 충족했다.
