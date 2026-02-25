# SCRUM-30 AuthContext JWT Migration

- Date: 2026-02-26 08:30 KST
- Author: Codex
- Branch: feat/SCRUM-30-authcontext-jwt
- Tags: scrum-30,bk-021,frontend,auth,jwt,session-restore,api-client,context

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 후 상태를 `진행 중`으로 전환
  - `dev` 최신화 후 `git worktree`로 분리 브랜치 생성
  - `rg` 기반 영향 범위 분석 후 `update_plan`에 작업 계획 등록
- Jira 요구사항:
  - Ticket: `SCRUM-30` (`[BK-021] AuthContext JWT 기반 교체`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md`의 BK-021 완료 기준
  - 핵심 AC: `login/me/logout` 흐름과 세션 복원 동작
- 제약:
  - AGENTS.md 준수, 최소/정밀 변경
  - 코드 변경은 `apply_patch` 기반으로 반영
  - 로그인 UI/보호 라우트는 BK-031 범위로 유지

## Changes Summary
- Jira `SCRUM-30`를 `진행 중`으로 전환하고, 작업 범위/검증 계획 코멘트를 등록했다.
- `src/services/auth.ts`를 신규 추가해 `POST /api/v2/auth/login`, `GET /api/v2/auth/me`, `POST /api/v2/auth/logout` API 래퍼를 분리했다.
- `AuthContext`를 하드코딩 사용자 상태에서 JWT 세션 기반으로 교체했다:
  - 세션 저장 키: `pangea.auth.v1`
  - 저장 필드: `token`, `expiresAt`, `user`
  - 앱 시작 시 세션 복원 + `/auth/me` 검증 + 만료 세션 제거
  - `setApiAccessTokenProvider` 연동으로 API 클라이언트 Authorization 주입 연결
- 역할 매핑 규칙을 고정했다:
  - 백엔드 role 원본은 `AuthUser.role`로 유지
  - UI 권한은 `toViewRole()`로 `rental-business` / `device-installer` 계산
- `Layout`/`DeviceInstallation`의 `useAuth` 소비 지점을 신규 컨텍스트 인터페이스에 맞춰 수정해 null-safe 처리와 로그아웃 동작을 정리했다.

## Diffs & Files
- `src/services/auth.ts` (new): auth API 함수(`postLogin`, `getMe`, `postLogout`) 및 `toViewRole` 정의
- `src/app/context/AuthContext.tsx`: JWT 세션 상태 모델, 세션 복원/로그인/로그아웃, API token provider 연동
- `src/app/components/Layout.tsx`: `viewRole` 기반 메뉴 필터링, `logout()` 호출 연결
- `src/app/pages/DeviceInstallation.tsx`: `installer` 필드에 `user?.name` null-safe 적용
- `docs/prompt_library/prompt_library_v1.md`: `v1.2.14` 반영 및 auth-context 이력 기록 규칙 추가
- `docs/prompt_history/20260226_SCRUM-30-authcontext-jwt.md` (new): 본 작업 이력 기록

## Validation
```bash
npm install
npm run build
git status --short
```

## Notes
- `vite build`는 성공했으며, 기존과 동일한 chunk size warning만 출력되었다.
- 후속 티켓(BK-031)에서 로그인 페이지/보호 라우트 연결 시 `AuthContext.status`와 `isAuthenticated`를 기준으로 라우트 가드를 연결하면 된다.
