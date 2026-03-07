# SCRUM-175 Support Admin View

- Date: 2026-03-07 09:27
- Author: J Hong
- Branch: feat/SCRUM-175-support-admin-view-fe
- Jira Key: SCRUM-175
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-175,support-center,super-admin,filters

## Start Context
- Jira 요구사항은 `super_admin`이 전체 tenant 문의를 기본 로드하고, tenant/status/date 필터를 통해 문의 목록을 탐색할 수 있게 하는 것이다.
- 기존 문의 상세 조회와 상태 변경 흐름은 재사용하고, 일반 사용자/tenant admin의 기존 UX는 보존해야 한다.

## Changes Summary
- `super_admin`일 때만 관리형 문의 목록/필터 UI를 표시하도록 `SupportCenter`를 확장했다.
- tenant, status, createdAt 기간 필터를 FE service payload와 연동했다.
- 목록에서 상세 보기와 상태 변경을 이어서 처리할 수 있도록 화면 상태를 정리했다.
- 관리 시나리오 Playwright 스펙을 추가했다.

## Diffs & Files
- `src/app/pages/SupportCenter.tsx`: super_admin 목록/필터/상세 관리 UI 추가.
- `src/services/support.ts`: support ticket list query 확장.
- `e2e/support-center.spec.ts`: support-center 관리 시나리오 추가.

## Commands Used
```bash
npm install --package-lock=false
npm run build
npx playwright test e2e/support-center.spec.ts --list
```

## Validation
```bash
npm run build
npx playwright test e2e/support-center.spec.ts --list
# Result: build passed, spec registered
```

## Notes
- 실제 Playwright 브라우저 실행은 호스트 의존성 부족으로 보류됐다.
- BE 필터 계약 변경과 함께 synchronized merge가 필요하다.
