# SCRUM-101~109,113 FE Contract/RBAC Regression Batch

- Date: 2026-02-27 19:20
- Author: Codex
- Branch: `fix/SCRUM-101-114-fe-contract-regression`
- Tags: scrum-101,scrum-102,scrum-103,scrum-104,scrum-105,scrum-106,scrum-107,scrum-108,scrum-109,scrum-113,contract,rbac,regression

## Start Context
- 대상 티켓: `SCRUM-101`~`SCRUM-114` 배치 중 FE 범위(`SCRUM-101`~`SCRUM-109`, `SCRUM-113`)를 우선 처리.
- 핵심 요구사항:
- 인증/설정/조치필요/결제/단말장착 API 호출 경로를 BE canonical 계약으로 정렬.
- 권한 파서가 메타데이터 문자열(`role: "admin"`)을 권한 토큰으로 오인하지 않도록 보정.
- `permissions: ["*"]` 와일드카드가 전체 권한으로 정상 해석되도록 보정.
- Authorization refresh 경쟁상황에서 stale 응답이 최신 세션 권한을 덮어쓰지 않도록 race-safe 처리.
- ActionRequired 쓰기 실패 시 snapshot 통복원으로 최신 필터/목록을 덮어쓰는 회귀 제거.

## Changes Summary
- 계약 canonical 정렬:
- Company API를 `/api/v2/settings/company` 단일 경로로 전환.
- ActionRequired 쓰기 API를 `/api/v2/action-items/{id}/status`, `/api/v2/action-items/{id}/memos` 단일 경로로 고정.
- ActionRequired 대시보드 경로를 `/api/v2/action-items`로 정렬.
- DeviceInstallation 목록/취소 경로를 tasks/status 기반 canonical로 정리하고 상세 조회는 `/api/v2/device-installations/{id}`를 기준으로 사용.
- 권한 파서/해석 회귀 수정:
- `toNormalizedToken("*")`가 `*`를 유지하도록 수정해 wildcard 전체 권한 해석을 복구.
- 권한 토큰 수집을 `permissions/scopes/authorities/routes/actions` 컨테이너 하위로 제한해 메타데이터 문자열 권한 승격을 차단.
- Authorization refresh race-safe:
- 요청 시퀀스 + `AbortController`를 도입해 stale/in-flight 응답 무시.
- 로그아웃/사용자 변경 시 기존 in-flight 요청을 즉시 abort.
- `role-fallback` 의존을 제거하고 비정상/계약불일치 응답은 `deny-by-default`로 처리.
- ActionRequired rollback 보정:
- 저장 실패 시 전체 snapshot 복원을 제거.
- 실패 시 현재 필터 기준 `hydrateActionItems()/hydrateActionDetail()` 재동기화로 최신 화면 상태를 보존.

## Diffs & Files
- `src/services/company.ts`: settings/company canonical 경로 및 payload 매핑 적용.
- `src/services/actionRequired.ts`: action-required 레거시 fallback 제거, action-items 단일 경로화.
- `src/services/dashboard.ts`: action-required 대시보드 API 경로 정렬.
- `src/services/deviceInstallations.ts`: tasks/status 기준 canonical 호출 정리.
- `src/app/authorization.ts`: wildcard 보존 및 권한 토큰 수집 범위 제한.
- `src/app/context/AuthorizationContext.tsx`: role-fallback 제거, request sequence/abort 기반 race-safe refresh.
- `src/app/pages/ActionRequired.tsx`: 실패 rollback을 snapshot 복원에서 재동기화 방식으로 전환.
- `src/app/context/CompanyContext.tsx`: Company 캐시 타입 가드(선택 필드) 정합화.
- `docs/prompt_library/prompt_library_v1.md`: 버전/히스토리 갱신.

## Validation
```bash
npm ci
npm run build
```
- 결과: build 성공
- 참고 경고: `react-router@7.13.0`의 Node engine 권고(`>=20`) 경고, chunk size 경고(기능 실패 아님)

## Notes
- FE 단위 테스트 스크립트는 레포에 정의되어 있지 않아(`npm test` 부재) 빌드 검증으로 대체.
- BE 연계 변경(`device-installations/{id}` 상세, tenant mismatch 처리)은 별도 BE 브랜치에서 동시 반영.
