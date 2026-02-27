# SCRUM-101~114 FE E2E Permissions Contract Alignment

- Date: 2026-02-27 23:55
- Author: Codex
- Branch: `fix/SCRUM-101-114-fe-contract-regression`
- Tags: scrum-101,scrum-102,scrum-103,scrum-104,scrum-105,scrum-106,scrum-107,scrum-108,scrum-109,scrum-110,scrum-111,scrum-112,scrum-113,scrum-114,fe,e2e,permissions,deny-by-default

## Start Context
- 대상 배치: `SCRUM-101`~`SCRUM-114` 통합 처리 중 FE PR `#46`의 `e2e-smoke` 실패를 후속 복구.
- 관찰된 실패: 로그인 이후 주요 시나리오가 `/forbidden`으로 이동하며 heading/assertion 다수 실패.
- 원인 후보: FE 권한 정책이 `404 -> deny-by-default`로 강화되었는데, E2E 기본 mock이 `/api/v2/permissions/me`에서 여전히 `404` 반환.

## Changes Summary
- E2E 기본 API mock 계약을 현재 FE 권한 정책과 정렬했다.
- `/api/v2/permissions/me` 기본 응답을 `404` 에러에서 role 기반 권한 payload 성공 응답으로 교체했다.
- role(`member/admin/super_admin/installer`)별 기본 permission 세트를 명시하여 테스트가 role-fallback에 의존하지 않도록 고정했다.
- Device Installation E2E 스펙의 목록 조회 mock 경로를 `/api/v2/device-installations/tasks`로 정렬해 canonical 경로 변경 이후 발생한 단일 실패를 제거했다.

## Diffs & Files
- `e2e/helpers/apiMock.ts`
  - role별 기본 permission 매핑 상수 추가.
  - `buildPermissionPayload()` 헬퍼 추가.
  - `GET /api/v2/permissions/me` 기본 핸들러를 `fulfillSuccess(permissionPayload)`로 전환.
- `e2e/device-installation.spec.ts`
  - 목록 조회 핸들러 경로를 `/api/v2/device-installations/tasks`로 변경해 앱 서비스 경로와 테스트 mock 계약을 일치시킴.
- `docs/prompt_library/prompt_library_v1.md`
  - 버전 `v1.2.37` 업데이트 및 본 변경의 Version History/Rules 추가.

## Validation
```bash
npm run build
```
- 결과: 성공
- 참고: 로컬 Playwright 실행은 시스템 브라우저 의존성 부족(`browserType.launch` 호스트 dependency 누락)으로 불가하여, 최종 검증은 GitHub Actions `e2e-smoke` 재실행으로 확인.

## Notes
- 본 변경은 FE 정책(`deny-by-default`)을 낮추지 않고 E2E mock 계약을 정책에 맞춘 수정이다.
