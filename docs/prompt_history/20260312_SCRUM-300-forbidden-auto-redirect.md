# SCRUM-300 Forbidden Auto Redirect

- Date: 2026-03-12 08:55
- Author: Codex
- Branch: feat/SCRUM-300-forbidden-auto-redirect
- Jira Key: SCRUM-300
- Jira Status: In Progress
- PR URL: PENDING
- Tags: forbidden,authorization,redirect,countdown,prompt-history

## Start Context
- 권한이 없는 경로로 진입하면 사용자가 `/forbidden` 화면에 머무르며 수동 버튼을 눌러야만 이탈할 수 있었다.
- Jira AC는 `/forbidden` 진입 시 3초 후 역할별 기본 화면으로 자동 이동하고, `installer`는 `/device-installation`, 그 외 역할은 `/`로 보내도록 요구했다.
- 권한 차단 화면 자체와 수동 이동 CTA는 유지해야 하며, 이번 작업은 권한 판정 로직 변경이 아니라 dead-end UX를 줄이는 안전장치 범위다.

## Changes Summary
- `/forbidden` 페이지에 3초 카운트다운 상태와 `useNavigate(..., { replace: true })` 기반 자동 리디렉션 effect를 추가했다.
- 자동 이동 경로와 수동 CTA 경로 모두 `resolveDefaultLandingPath(viewRole)` 결과를 공유하도록 정리해 `installer -> /device-installation`, 그 외 `/` 정책을 그대로 재사용했다.
- 회귀 테스트에 SCRUM-300 검증을 추가해 카운트다운 상수, 자동 이동 effect, 역할별 기본 경로 재사용, CTA 경로 공유를 함께 점검했다.
- Playwright 런타임 검증을 추가해 멤버 계정의 홈 복귀와 back-button loop 방지, installer 계정의 `/device-installation` 자동 이동을 실제 브라우저에서 확인했다.

## Diffs & Files
- `src/app/pages/Forbidden.tsx`: 3초 카운트다운 문구, `replace` 기반 timed redirect, `defaultLandingPath` 재사용 로직을 추가했다.
- `tests/auth-login-navigation.test.mjs`: Forbidden CTA 경로 재사용 패턴을 갱신하고 SCRUM-300 자동 리디렉션 회귀 검증을 추가했다.
- `e2e/forbidden.spec.ts`: 멤버/installer 역할에 대한 `/forbidden` 자동 이동 동작을 브라우저 런타임에서 검증하는 Playwright 시나리오를 추가했다.
- `docs/prompt_library/prompt_library_v1.md`: v1.2.64로 버전 업하고 SCRUM-300 prompt_history 기록 규칙을 추가했다.

## Validation
```bash
node --test tests/auth-login-navigation.test.mjs
npx.cmd playwright test e2e/forbidden.spec.ts
npm.cmd run build
```

## Notes
- `npm install`로 worktree 의존성을 설치한 뒤 빌드를 확인했다.
- Playwright 기본 `webServer` 명령은 Windows PowerShell에서 `VITE_API_BASE_URL=... npm run dev` 구문이 맞지 않아, 로컬 dev server를 수동 기동한 상태에서 `npx.cmd playwright test e2e/forbidden.spec.ts`를 실행해 런타임 검증을 완료했다.
- `npm.cmd run build` 중 `src/app/pages/Reservations.tsx`의 기존 duplicate key 경고와 번들 크기 경고가 보였지만, 이번 티켓 변경과 직접 관련된 새 실패는 없었다.
