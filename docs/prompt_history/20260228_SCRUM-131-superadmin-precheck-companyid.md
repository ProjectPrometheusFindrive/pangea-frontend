# SCRUM-131 Super Admin Pre-check CompanyId Guard

- Date: 2026-02-28 20:18
- Author: Codex
- Branch: `fix/SCRUM-131-superadmin-precheck-companyid`
- Jira Key: SCRUM-131
- Jira Status: Resolved
- PR URL: https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/49
- Tags: scrum-131,device-installation,tenant-scope,super-admin,pre-check

## Start Context
- Start Prompt 기준으로 `dev`에서 분기한 독립 worktree에서 작업하고, Jira 상태를 `진행 중`으로 전환 후 작업 계획 코멘트를 먼저 남긴다.
- Jira AC: `PremiumInstallationRequestSection` 사전조회(list)에서 `companyId` 누락으로 `super_admin` 기준 cross-tenant 결과 혼합 가능성이 있어, lookup 호출에 tenant selector를 명시 전달해야 한다.
- 제약: non-super_admin 기존 동작은 유지해야 하며, 변경은 최소 범위로 제한한다.

## Changes Summary
- `findInProgressInstallationByVin`의 scheduled/in_progress 사전조회 호출에 `companyId: user?.companyId`를 추가해 조회 범위를 tenant 단위로 고정했다.
- `useCallback` 의존성에 `user?.companyId`를 추가해 값 변경 시 조회 함수가 최신 tenant 컨텍스트를 사용하도록 맞췄다.
- 기존 non-super_admin도 동일한 사용자 `companyId`를 전달하는 흐름이라 권한/조회 동작의 의미를 바꾸지 않고 회귀 포인트만 보정했다.

## Diffs & Files
- `src/app/components/PremiumInstallationRequestSection.tsx`
  - `getDeviceInstallationList`(scheduled, in_progress) 두 호출에 `companyId` 전달 추가.
  - `findInProgressInstallationByVin` 콜백 의존성 배열을 `[] -> [user?.companyId]`로 조정.
- `docs/prompt_library/prompt_library_v1.md`
  - 버전을 `v1.2.39`로 올리고 SCRUM-131 tenant-scope 회귀 기록 규칙 및 Version History 추가.
- `docs/prompt_history/20260228_SCRUM-131-superadmin-precheck-companyid.md`
  - 본 작업 이력 문서 신규 작성.

## Commands Used
```bash
git fetch --all --prune && git switch dev && git pull --ff-only
git worktree add -b fix/SCRUM-131-superadmin-precheck-companyid /home/jh/code/SCRUM-131-superadmin-precheck-companyid dev
rg --files | rg 'PremiumInstallationRequestSection\\.tsx$'
npm ci
npm run build
```

## Validation
```bash
npm run build
```
- 결과: 성공 (`vite build` 완료)
- 참고: 번들 chunk size 경고만 존재(기능 실패 아님)

## Notes
- 백엔드 `super_admin` list 정책 강화(`companyId` 필수)는 별도 서버 티켓 범위로 유지한다.
