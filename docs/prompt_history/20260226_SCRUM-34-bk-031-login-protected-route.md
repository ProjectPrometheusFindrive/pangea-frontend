# SCRUM-34 로그인-보호 라우트 연동

- Date: 2026-02-26 19:55 KST
- Author: Codex
- Branch: feat/SCRUM-34-bk-031-login-protected-route
- Tags: scrum-34,bk-031,frontend,auth,routing,return-url,refresh-retry

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 후 상태를 `진행 중`으로 전환
  - `dev` 최신화 후 `git worktree` 분리 브랜치에서 작업
  - 영향 범위 분석(`rg`) 후 `update_plan` 등록
- Jira 요구사항:
  - Ticket: `SCRUM-34` (`[BK-031] 로그인-보호 라우트 연동`)
  - 핵심 AC:
    - `POST /api/v2/auth/login`, `GET /api/v2/auth/me`, `POST /api/v2/auth/refresh` 연동 및 토큰 갱신 순서 문서화
    - 비로그인 보호 경로 접근 시 로그인 이동 + 로그인 후 원래 경로 복귀(`returnUrl`)
    - 로그인 에러 분기(`401`, `429`, 네트워크 재시도 버튼)
    - 다중 탭 로그아웃 동기화, 새로고침 직후 세션 복구, refresh 실패 시 안전 로그아웃
- 제약:
  - `pangea-frontend`만 수정
  - 최소/정밀 변경, `apply_patch` 기반 수정
  - `git`/`gh` 단계마다 worktree guard 확인

## Changes Summary
- 인증 API 클라이언트에 401 처리 훅을 추가해 `401 -> refresh handler 호출 -> 성공 시 원요청 1회 재시도`를 표준화했다.
  - `ApiRequestConfig.skipAuthRefresh` 플래그와 `ApiUnauthorizedHandler` 타입을 추가.
  - `ApiClient.request()` 내부에서 최초 401만 refresh 핸들러를 호출하고, 성공 시 동일 요청을 1회 재실행하도록 구현.
- AuthContext를 확장해 refresh/token/session 복구 예외 케이스를 처리했다.
  - `POST /api/v2/auth/refresh` 연동(`postRefresh`) 추가.
  - refresh single-flight(`refreshPromiseRef`)로 동시 401 요청 시 refresh 중복 호출 방지.
  - refresh 실패 시 세션 정리 + 안전 로그아웃 처리.
  - `storage` 이벤트 기반 다중 탭 세션 동기화(타 탭 로그아웃/로그인 반영).
- 라우팅을 보호 라우트 구조로 재구성했다.
  - `RequireAuth`에서 인증 확인 중 로딩, 비인증 시 `/login?returnUrl=...` 리다이렉트.
  - 권한 불일치 시 `/forbidden` 이동(403 안내 화면).
  - 로그인 성공 후 `returnUrl`로 복귀하고, open redirect 방지를 위해 상대 경로(`/...`)만 허용.
- 로그인 UX 분기를 AC에 맞춰 반영했다.
  - `401`: 아이디/비밀번호 오류 문구
  - `429`: 재시도 대기 문구
  - `NETWORK_ERROR`/`TIMEOUT`: 재시도 버튼 노출
- 로그아웃 이후 이동 경로를 `/login`으로 고정해 보호 라우트 동작과 일관화했다.

## Diffs & Files
- `src/services/api/types.ts`: `skipAuthRefresh`, `ApiUnauthorizedHandler` 타입 추가
- `src/services/api/client.ts`: 401 감지 후 refresh handler 호출 + 원요청 1회 재시도 로직 추가
- `src/services/api/index.ts`: `setApiUnauthorizedHandler` export 추가
- `src/services/auth.ts`: `postRefresh`/`AuthRefreshData` 추가 (`POST /api/v2/auth/refresh`)
- `src/app/context/AuthContext.tsx`:
  - refresh single-flight 및 안전 로그아웃 처리
  - API unauthorized handler 등록
  - `storage` 이벤트 기반 다중 탭 세션 동기화
- `src/app/components/RequireAuth.tsx` (new): 인증/권한 보호 라우트 컴포넌트
- `src/app/pages/Login.tsx` (new): 로그인 화면 + 401/429/네트워크 분기 + returnUrl 복귀
- `src/app/pages/Forbidden.tsx` (new): 권한 없음(403) 안내 화면
- `src/app/routes.ts`: public(`/login`, `/forbidden`) + protected(route-role split) 재구성
- `src/app/components/Layout.tsx`: 로그아웃 후 `/login`으로 이동
- `docs/prompt_library/prompt_library_v1.md`: v1.2.16 및 BK-031 증적 기록 규칙 추가
- `docs/prompt_history/20260226_SCRUM-34-bk-031-login-protected-route.md` (new): 본 작업 이력

## Validation
```bash
npm install
npm run build
```

- `npm install`: 성공 (Node 18 환경에서 `react-router@7.13.0` engine warning 출력)
- `npm run build`: 성공
  - output: `dist/assets/index-fH95yv_s.js` 번들 크기 경고만 존재(기존 성격 warning)

## Notes
- 현재 FE canonical 참조 OpenAPI에는 `/auth/refresh`가 명시되어 있지 않으나, 본 티켓 AC 요구에 따라 FE는 refresh 연동 경로를 선반영했다.
- 후속으로 BE OpenAPI 명세에 `/auth/refresh` 계약을 동기화하면 FE/BE 문서 정합성이 높아진다.
