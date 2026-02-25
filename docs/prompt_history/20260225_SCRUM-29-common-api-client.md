# SCRUM-29 Common API Client

- Date: 2026-02-25 23:40 KST
- Author: Codex
- Branch: feat/SCRUM-29-common-api-client
- Tags: scrum-29,bk-020,api-client,token-injection,timeout,error-standardization,interceptor

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 후 상태를 `진행 중`으로 전환
  - `dev` 최신화 후 `git worktree`로 분리 브랜치 생성
  - `rg` 기반 영향 범위 분석 후 `update_plan`에 작업 계획 등록
- Jira 요구사항:
  - Ticket: `SCRUM-29` (`[BK-020] FE 공통 API 클라이언트 구축`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md`의 BK-020 완료 기준
  - 핵심 AC: 토큰 주입, timeout, 에러 표준화, 인터셉터 동작
- 제약:
  - AGENTS.md 준수, 최소/정밀 변경
  - 코드 변경은 `apply_patch` 기반으로만 반영

## Changes Summary
- `src/services/api` 공통 클라이언트 레이어를 신규 추가하고, 요청/응답 인터셉터 체계를 구현했다.
- 기본 요청 인터셉터에서 access token provider 기반 `Authorization: Bearer <token>` 주입을 적용했다.
- 기본 timeout(10초) 및 요청 단위 timeout override를 구현하고 `AbortSignal`과 결합해 취소/타임아웃 처리를 표준화했다.
- OpenAPI v2 draft의 envelope 형식에 맞춰 `ApiError` 기반 에러 매핑(401/403/404/409/422/5xx, 네트워크/타임아웃)을 구현했다.
- API 클라이언트 진입점(`apiClient`, `createApiClient`, `setApiAccessTokenProvider`)과 `VITE_API_BASE_URL`/`VITE_API_TIMEOUT_MS` 환경변수 타입을 추가했다.
- README에 BK-020 사용 가이드를 추가하고, `prompt_library_v1.md`를 `v1.2.6`으로 업데이트했다.

## Diffs & Files
- `src/services/api/client.ts` (new): 공통 HTTP 클라이언트, timeout 처리, 인터셉터 파이프라인
- `src/services/api/errors.ts` (new): `ApiError` 정의 및 응답/네트워크 에러 표준화
- `src/services/api/types.ts` (new): envelope/인터셉터/요청 설정 타입 정의
- `src/services/api/index.ts` (new): 기본 클라이언트 생성, env 설정, 공개 API export
- `src/vite-env.d.ts` (new): `VITE_API_BASE_URL`, `VITE_API_TIMEOUT_MS` 타입 선언
- `README.md`: BK-020 공통 API 클라이언트 섹션 추가
- `docs/prompt_library/prompt_library_v1.md`: `v1.2.6` 버전 반영 및 코드 티켓용 AC/검증 기록 규칙 추가
- `docs/prompt_history/20260225_SCRUM-29-common-api-client.md` (new): 본 작업 이력 기록

## Validation
```bash
npm run build
git status --short
```

## Notes
- 후속 티켓(`BK-021`)에서 `AuthContext`를 JWT 세션 기반으로 교체하며 `setApiAccessTokenProvider`를 실제 로그인 토큰 흐름에 연결하는 작업이 필요하다.
