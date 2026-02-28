# SCRUM-130 Super Admin Installation Create CompanyId

- Date: 2026-02-28 20:34
- Author: Codex
- Branch: `fix/SCRUM-130-superadmin-create-companyid`
- Jira Key: SCRUM-130
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-130,device-installations,super-admin,tenant,company-id,frontend

## Start Context
- Base 브랜치는 `dev`이며, `git worktree`로 격리된 작업 공간에서만 변경해야 한다.
- `SCRUM-130` 이슈는 super_admin Premium 장착신청 생성 시 `companyId` 미전달로 `400 (companyId is required for super_admin)`가 발생하는 FE 계약 불일치 수정이 목적이다.
- 요구사항은 생성 API에서 `companyId` payload/options 지원, `PremiumInstallationRequestSection` 생성 submit 경로에서 명시 전달, non-super_admin 동작 유지다.

## Changes Summary
- `createDeviceInstallation` 서비스에 `companyId`를 payload 또는 options로 전달할 수 있도록 시그니처를 확장했다.
- Premium 신청 submit 경로에서 super_admin일 때 선택 자산의 `companyId`(fallback: `user.companyId`)를 명시 전달하도록 연결했다.
- Assets 목록 파싱/전달 타입에 `companyId`를 포함해 submit 경로에서 tenant 값을 안정적으로 참조할 수 있도록 정리했다.
- non-super_admin 경로에서는 기존처럼 `companyId`를 생성 요청에 강제 전달하지 않도록 분기해 동작 변화를 최소화했다.

## Diffs & Files
- `src/services/deviceInstallations.ts`
  - `CreateDeviceInstallationPayload`에 `companyId` 추가.
  - `CreateDeviceInstallationOptions` 추가 및 `createDeviceInstallation(payload, options?)` 시그니처 확장.
  - 요청 바디에 `companyId`를 merge하고 `signal` 전달 지원.
- `src/app/components/PremiumInstallationRequestSection.tsx`
  - `PremiumInstallableAsset`에 `companyId` 필드 추가.
  - submit에서 super_admin 판별 후 `createCompanyId`를 계산해 `createDeviceInstallation(..., { companyId })`로 전달.
  - 생성 직후 상세 재조회에도 동일 tenant 컨텍스트를 우선 적용.
- `src/app/pages/Assets.tsx`
  - 내부 `Asset` 타입과 `toAssetRecord` 파싱에 `companyId` 추가.
  - `premiumInstallableAssets` 전달 payload에 `companyId` 포함.

## Validation
```bash
npm run build
```
- 결과: 실패 (환경 블로커)
- 로그: `sh: 1: vite: not found`
- 해석: 로컬 의존성(특히 `vite`)이 설치되지 않아 build 검증을 완료할 수 없음.

## Notes
- 로컬 패키지 설치(`npm install` 또는 팀 표준 패키지 매니저 설치 절차) 후 `npm run build` 재검증이 필요하다.
