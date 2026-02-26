# SCRUM-38 BK-042 Assets Page Read Integration

- Date: 2026-02-26 20:40
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-38-bk-042-assets-page-fetch
- Tags: scrum-38,bk-042,assets,api-integration,query-sync,error-handling

## Start Context
- Start Prompt 기준: `dev` 기반 격리 worktree에서 작업하고, Jira 상태/코멘트 동기화 후 PR(`base=dev`)까지 완료.
- Jira `SCRUM-38` AC 핵심: `GET /api/v2/assets?page&size&status&q`, `GET /api/v2/assets/{assetId}` 연동, loading/list/empty/detail 상태 반영, 400/401/403/5xx 처리, 404 fallback, race-safe 최신 요청 반영.
- 범위 제외: 자산 생성/수정(write) 동작(BK-043).

## Changes Summary
- Assets 전용 API 서비스(`src/services/assets.ts`)를 추가해 목록/상세 조회 endpoint를 분리하고 `AbortSignal` 전달 구조를 유지했다.
- `src/app/pages/Assets.tsx`를 URL 쿼리 기반(`page`, `size`, `status`, `q`) 조회 흐름으로 전환했다.
- 목록 조회를 실서버 응답 기준으로 렌더하도록 변경하고(mock fallback 제거), 페이지네이션/사이즈 변경/상태 필터/검색 입력이 쿼리스트링 및 API 파라미터와 일치하도록 정규화했다.
- 에러 분기 처리:
  - `400`: 필터 초기화 안내/액션
  - `401`: 로그인 이동 액션(공통 핸들러)
  - `403`: 접근 불가 안내 액션(공통 핸들러)
  - `5xx/네트워크`: Retry 버튼으로 재호출
  - `404 (detail)`: 안전 fallback 메시지 + 상세 모달 미오픈 처리
- 상세 조회는 `assetId` 기반으로 별도 API 호출되며, 요청 경쟁 시 이전 요청을 abort하여 최신 요청만 반영되도록 처리했다.
- `VehicleDetailModal`에서 예약 히스토리 mock 직접 참조를 제거하고, 외부 데이터 주입 방식으로 변경했다(현재 Assets에서는 빈 배열 전달).

## Diffs & Files
- `src/services/assets.ts`: `/api/v2/assets` 목록/상세 조회 API 래퍼 추가.
- `src/app/pages/Assets.tsx`: query-param 동기화, 목록/상세 API 연동, 페이지네이션, AC 기반 예외 처리, detail 404 fallback, race-safe 상세 조회 로직 적용.
- `src/app/components/VehicleDetailModal.tsx`: mock reservations 의존 제거, `reservationHistory` prop 기반 렌더로 변경.
- `docs/prompt_library/prompt_library_v1.md`: v1.2.17 업데이트 및 BK-042 계열 evidence 기록 규칙 추가.

## Validation
```bash
npm run build
# vite build 성공
# output: build success, chunk size warning only
```

## Notes
- 현재 상세 모달의 예약 히스토리는 API 응답 계약이 확정되면 `reservationHistory` prop으로 연결 가능하도록 준비되어 있다.
- 로컬 환경 Node 버전(18.x)에서 `react-router@7` engine warning이 있으나 빌드는 정상 완료되었다.
