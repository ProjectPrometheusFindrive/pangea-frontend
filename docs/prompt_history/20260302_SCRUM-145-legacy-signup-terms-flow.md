# SCRUM-145 Legacy Signup Terms Flow Alignment

- Date: 2026-03-02 20:45
- Author: codex
- Branch: feat/SCRUM-145-v2-auth-register
- Jira Key: SCRUM-145
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-145, signup, terms, auth, frontend, pangea-frontend

## Start Context
- Start Prompt 기준으로 `SCRUM-145` 작업을 worktree 브랜치(`feat/SCRUM-145-v2-auth-register`)에서 진행.
- 레거시 FE(`Project_Prometheus_FE`)의 회원가입 UX를 준용해, 현재 `pangea-frontend`에 약관 동의 단계 + 정보입력 단계 회원가입 플로우를 추가.
- 가입 API 경로는 `/api/v2/auth/register`를 우선 사용하고, 필요 시 `/api/v2/auth/signup` fallback 정책을 유지.

## Changes Summary
- 라우팅에 공개 회원가입 경로(`/terms`, `/signup`)를 추가해 로그인 전 단계 진입을 지원했다.
- 레거시 FE와 동일한 구조의 약관 동의 페이지를 추가했다.
  - 필수: 개인정보 처리방침, 위치정보 이용약관
  - 선택: 마케팅 정보 수신 동의
  - 약관 상태를 `sessionStorage`에 저장해 다음 단계(`/signup`)로 전달
- 회원가입 폼 페이지를 추가했다.
  - 필드: userId/password/confirm/name/phone/email/position/company/bizRegNo
  - 아이디 중복 확인: `GET /api/v2/auth/check-userid`
  - 가입 제출: `POST /api/v2/auth/register` (404 시 `POST /api/v2/auth/signup` fallback)
  - 필수 약관 미동의 상태로 `/signup` 직접 진입 시 `/terms`로 리다이렉트
- 로그인 페이지에 회원가입 진입 링크(`/terms`)를 추가했다.
- Auth 서비스 레이어에 signup/check-userid/register 타입 및 API 함수를 확장했다.

## Diffs & Files
- `src/app/routes.ts`: `/terms`, `/signup` 공개 라우트 등록
- `src/app/pages/TermsAgreement.tsx`: 약관 동의 Step 1 UI/상태 처리 추가
- `src/app/pages/SignUp.tsx`: 정보입력 Step 2 UI, 유효성 검사, 중복확인/가입 제출 로직 추가
- `src/app/pages/signupAgreementState.ts`: 약관 동의 상태(sessionStorage) load/save/clear 유틸 추가
- `src/services/auth.ts`: `getCheckUserId`, `postRegister` 및 관련 payload/data 타입 추가
- `src/app/pages/Login.tsx`: 회원가입 링크(`/terms`) 추가
- `docs/prompt_library/prompt_library_v1.md`: Version/Date/Version History 및 SCRUM-145 기록 규칙 반영

## Commands Used
```bash
rg -n "signup|terms|약관|check-userid|register" src
npm ci
npm run build
```

## Validation
```bash
npm run build
# result: success (vite production build completed)
```

## Notes
- Node 18 환경에서 `npm ci` 시 `react-router@7.13.0` engine warning이 출력되었지만, 빌드는 정상 완료됨.
- PR 생성 후 Jira 상태를 `Resolved`로 전환하고 핵심 변경 사항/특이사항/PR 링크를 코멘트로 기록 예정.
