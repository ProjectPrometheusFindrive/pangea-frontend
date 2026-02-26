# SCRUM-39 BK-043 Assets Write Integration

- Date: 2026-02-26 20:57
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-39-assets-write-integration
- Tags: scrum-39,bk-043,assets,write-integration,history,conflict-handling

## Start Context
- Start Prompt 기준: `dev` 기반 worktree에서 작업, Jira 상태/코멘트 동기화 후 `dev` 대상 PR까지 완료.
- Jira `SCRUM-39` AC 핵심:
  - `POST /api/v2/assets`, `PATCH /api/v2/assets/{assetId}`, `GET /api/v2/assets/{assetId}/history` 연동
  - dirty/saving/중복 제출 방지
  - `400/403/409/5xx` 분기 및 409 시 입력값 보존
  - 저장 전 이탈 확인, 저장 성공 후 목록/상세 동기화, 이력 탭 최신 변경 확인
- 정합성 제약: BK-041(BE write API optimistic lock/version) + BK-042(Assets 조회/상세 hydrate 패턴) 동작과 일치.

## Changes Summary
- Assets 서비스 계층 확장:
  - `src/services/assets.ts`에 create/patch/history API 래퍼 추가.
- Assets 등록(신규) 모달 연동:
  - mock `alert` 저장 제거, 실제 `POST /api/v2/assets` 저장으로 전환.
  - `saving` 상태/버튼 disable로 다중 제출 방지.
  - `400` 필드 에러 매핑, `403` 권한 안내, `409` 충돌 안내, `5xx/네트워크` 재시도 토스트 분기 적용.
  - 실패 시 입력값/업로드 상태 유지(폼 유실 방지).
  - 성공 시 목록 재조회 + `assetId` 쿼리 갱신으로 상세 즉시 진입.
- Assets 상세 수정 연동:
  - 상세 수정 폼을 BK-041 patch 계약 필드(`plate/model/year/status/memo`) 기준으로 재구성.
  - `version` 기반 PATCH 요청, 저장 중복 클릭 방지.
  - `409` 충돌 시 입력값 유지 + 충돌 배너 + 최신 데이터 새로고침 유도 버튼 제공.
  - 성공 시 상세/목록 상태 동기화 및 이력 재조회.
- 이력 탭 교체:
  - `VehicleDetailModal` history 탭을 예약 mock 표시에서 자산 변경 이력 API 렌더링으로 변경.
  - loading/error/retry/empty 상태를 포함.
- 이탈 방지:
  - 등록/수정 dirty 상태에서 모달 닫기 확인 및 `beforeunload` 가드 추가.

## Diffs & Files
- `src/services/assets.ts`
  - `createAsset`, `patchAsset`, `getAssetHistory` 추가.
- `src/app/pages/Assets.tsx`
  - 등록/수정 저장 API 연동, dirty/saving/409 보존 처리, history hydrate, 이탈 확인 처리.
  - 400 필드 에러 파싱(legacy `fields` + canonical `error.details`) 유틸 추가.
- `src/app/components/VehicleDetailModal.tsx`
  - history 탭을 자산 변경 이력 UI로 전환.
  - 상세 메타(`id/version/updatedAt`) 표시 및 patch 가능한 수정 폼/에러 표시 추가.
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.20으로 갱신, BK-043 증빙 기록 규칙 추가.

## Validation
```bash
npm run build
# vite build 성공
# chunk size warning only
```

## Notes
- 현재 저장 검증은 build 기준으로 완료했으며, 저장 분기(400/403/409/5xx)는 코드 경로로 반영했다.
- `package.json` 기준 lint/test 스크립트가 없어 추가 실행은 불가했다.
