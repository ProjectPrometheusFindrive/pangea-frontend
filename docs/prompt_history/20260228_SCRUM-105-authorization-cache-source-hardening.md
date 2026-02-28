# SCRUM-105 Authorization Cache Source Hardening

- Date: 2026-02-28 09:45
- Author: Codex
- Branch: `fix/SCRUM-105-authorization-cache-hardening`
- Tags: scrum-105,rbac,authorization,cache,deny-by-default,hardening

## Start Context
- `SCRUM-105` 완료 이후 재리뷰에서 권한 캐시가 legacy `role-fallback` source를 허용해 stale 권한이 TTL 동안 재사용될 수 있는 위험을 확인했다.
- 목표는 `deny-by-default` 정책과 캐시 계층을 일치시키고, 구버전 캐시를 즉시 무효화하는 것이다.

## Changes Summary
- 권한 source 타입에서 `role-fallback`을 제거하고 `api | deny-by-default`만 허용하도록 정리했다.
- 권한 캐시를 `pangea.authorization.v2`로 롤오버하고 캐시 payload 버전을 `2`로 상향했다.
- 캐시 읽기 경로에서 `source !== "api"`를 즉시 무효 처리해 legacy fallback 캐시 재사용을 차단했다.

## Diffs & Files
- `src/app/authorization.ts`
  - `AuthorizationSource`에서 `role-fallback` 제거.
- `src/app/context/AuthorizationContext.tsx`
  - `AuthorizationCachePayload`를 `version: 2`, `source: "api"`로 고정.
  - `AUTHORIZATION_CACHE_KEY`를 `pangea.authorization.v2`로 변경.
  - read/write 경로 모두 v2 + api-only 검증으로 정렬.
- `docs/prompt_library/prompt_library_v1.md`
  - 버전 `v1.2.38` 업데이트 및 본 작업의 history/rule 추가.

## Validation
```bash
npm run build
```
- 결과: 성공
- 참고: bundle chunk size 경고(기능 실패 아님)

## Notes
- 본 변경은 권한 부여 로직이 아니라 캐시 수용 조건을 강화하는 보안/정합성 하드닝이다.
