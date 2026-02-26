# SCRUM-43 BK-052 Reservations Read Integration

- Date: 2026-02-26 21:40
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-43-reservations-read-integration
- Tags: scrum-43,bk-052,reservations,read-integration,history,url-query,error-handling

## Start Context
- Start Prompt 기준: `dev` 기반 worktree(`../SCRUM-43-reservations-read-integration`)에서 작업, Jira 상태/코멘트 동기화 후 `dev` 대상 PR까지 수행.
- Jira `SCRUM-43` AC 핵심:
  - `GET /api/v2/reservations?page&size&status&from&to`, `GET /api/v2/reservations/{reservationId}` 연동
  - loading/list/empty/detail 갱신 UI
  - `400/401/403/404/5xx` 분기 + Retry
  - `from>to` 기간 역전 검증, 필터/페이지 동시 변경 race-safe 처리
- 정합성 제약: BK-050(reservations API 계약) + BK-031(401 인증 흐름/로그인 이동) 패턴 준수.

## Changes Summary
- Reservations 서비스 분리:
  - `src/services/reservations.ts` 신규 추가.
  - 목록/상세 조회 API 래퍼 제공 (`getReservationsList`, `getReservationDetail`).
  - BK-052 쿼리(`page/size/status/from/to`)와 BK-050 호환 alias(`pageSize`, `contractStatus`)를 함께 전달하도록 구성.
- Reservations 페이지 조회 연동 리팩터:
  - 기존 dashboard + mock fallback 경로 제거, 목록/상세를 실제 reservations API 기반으로 교체.
  - 응답 정규화 유틸을 추가해 `reservationId/rentalId`, `contractStatus`, `startAt/endAt` 등 계약 필드 변형을 흡수.
  - 차량 행은 API vehicle 컬렉션이 없더라도 reservation 목록 기반 fallback을 생성해 캘린더 렌더가 가능하도록 처리.
- URL-API 파라미터 동기화:
  - `page/size/status/from/to/q`를 canonical query로 사용하고 legacy 파라미터(`filter`, `contractStatus`, `pageSize`, `search`)를 자동 정규화.
  - 상태/기간 변경 시 `page=1`로 리셋, 페이지/사이즈 변경은 URL을 통해 재조회되도록 구성.
- 오류/빈상태/로딩/재시도 강화:
  - `from>to`는 요청 전 `400 VALIDATION_ERROR`로 처리해 사용자에게 즉시 안내.
  - `400`은 "조건 초기화" 액션으로 필터 리셋, `401/403`은 기존 공통 액션(`로그인 이동/홈 이동`) 유지, `5xx/네트워크`는 Retry로 재호출.
  - PageStateBoundary를 유지하며 empty/reset 동작을 URL 기반으로 통일.
- 상세 조회 안전 처리(404/403 포함):
  - 예약 클릭 시 detail API를 별도 호출하고 abort+sequence 기반 race-safe 처리를 적용.
  - `404/403` 또는 기타 오류 시 fallback 목록 데이터를 유지하면서 경고 배너를 표시해 안전하게 동작.

## Diffs & Files
- `src/services/reservations.ts`
  - reservations 목록/상세 조회 API 래퍼 신규 추가.
- `src/app/pages/Reservations.tsx`
  - mock fallback 제거, list/detail API 연동, URL query canonicalization, 400/401/403/404/5xx 분기, from>to 검증, 상세 로딩/오류 배너 추가.
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.21로 갱신, BK-052 증빙 기록 규칙 추가.

## Validation
```bash
npm run build
# vite build 성공
# chunk size warning only
```

## Notes
- `package.json`에 lint/test 스크립트가 없어 추가 자동 검증은 수행하지 못했다.
- BK-053 단계에서 쓰기 API(create/return/accident) 연동 시 현재 상세 fallback/배너 패턴을 재사용하면 상태 전이 리스크를 줄일 수 있다.
