# 2026-03-07 Wave 3 Auth Support Account

## Start Context
- Wave 3 대상: `SCRUM-174`, `SCRUM-176`, `SCRUM-204`, `SCRUM-205`, `SCRUM-206`, `SCRUM-207`, `SCRUM-208`, `SCRUM-210`
- 레포 범위: `pangea-frontend`
- 목표: 로그인 전 company 조회 차단, auth refresh 단일화, support 관리 권한 반영, 권한 재조회 보강, 계정 삭제를 withdrawn 기반 API와 연결

## Changes Summary
- `CompanyContext`를 인증 상태 기준으로 동작하도록 바꿔 로그인 전 `settings/company` 호출을 막았다.
- `AuthContext`에서 `/login` 경로일 때 세션 만료 모달을 숨기고, generic API client 401 재시도 경로를 제거해 refresh owner를 단일화했다.
- 권한 계약에 `action.revenue.write`, `action.payments.write`, `action.support.manage`를 추가하고, `SupportCenter`를 permission 기준 관리 뷰로 분기했다.
- `Layout` 계정 삭제를 `/api/v2/auth/withdraw` + logout 흐름으로 교체했다.
- Playwright 시나리오를 추가해 login/company, expired-session, permission refresh, admin support manage, account withdraw 회귀를 고정했다.

## Diffs & Files
- `src/app/authorization.ts`
- `src/app/components/Layout.tsx`
- `src/app/context/AuthContext.tsx`
- `src/app/context/AuthorizationContext.tsx`
- `src/app/context/CompanyContext.tsx`
- `src/app/pages/SupportCenter.tsx`
- `src/services/api/client.ts`
- `src/services/auth.ts`
- `e2e/helpers/apiMock.ts`
- `e2e/login.spec.ts`
- `e2e/support-center.spec.ts`
- `e2e/account-settings.spec.ts`

## Notes
- 로컬 FE 검증은 `npm run build`와 `npx playwright test --list`까지 확인했다.
- 실제 Playwright 브라우저 실행은 호스트 시스템 의존성 부족으로 CI 검증에 의존한다.
