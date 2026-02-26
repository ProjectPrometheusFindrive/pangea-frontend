# SCRUM-40 BK-044 Assets Mock Removal

- Date: 2026-02-26 21:08
- Author: Codex (GPT-5)
- Branch: refactor/SCRUM-40-assets-mock-removal
- Tags: scrum-40,bk-044,assets,mock-removal,api-single-source

## Start Context
- Start Prompt 기준: `dev` 기반 worktree에서 작업, Jira `In Progress` 전환/계획 코멘트 선반영, 완료 후 `dev` 대상 PR + Jira `Resolved` 동기화.
- Jira `SCRUM-40` AC 핵심:
  - Assets는 `GET /api/v2/assets`, `GET /api/v2/assets/{assetId}`, `POST /api/v2/assets`, `PATCH /api/v2/assets/{assetId}` 기반으로만 동작.
  - Assets 프로덕션 경로의 mock import/flag 제거.
  - API 실패 시 mock 대체 없이 명시적 에러 상태 유지 및 Retry 재호출.

## Changes Summary
- Assets 도메인 타입을 `src/app/types/assets.ts`로 분리해 mock 데이터 모듈 의존을 제거했다.
- `Assets` 페이지와 `VehicleDetailModal`이 `mockData` 타입 import를 사용하지 않도록 변경했다.
- `mockData`는 자산 타입을 직접 정의하지 않고 새 타입 모듈을 재사용/재노출하도록 정리했다.
- `NewContractModal`, `Reservations`의 `VehicleAsset` 타입 참조도 공통 타입 모듈로 일관화했다.
- Assets API 서비스 호출 경로(`src/services/assets.ts`) 및 목록/상세/등록/수정 런타임 로직은 변경하지 않아 실 API 단일 소스를 유지했다.

## Diffs & Files
- `src/app/types/assets.ts`
  - `VehicleAsset`/`VehicleDeviceStatus`/`DTCRecord` 타입 신설.
- `src/app/pages/Assets.tsx`
  - `VehicleAsset` 타입 import를 `../types/assets`로 전환.
- `src/app/components/VehicleDetailModal.tsx`
  - `VehicleAsset` 타입 import를 `../types/assets`로 전환.
- `src/app/data/mockData.ts`
  - 자산 타입 직접 선언 제거, `../types/assets` 기반 import/re-export로 정리.
- `src/app/components/NewContractModal.tsx`
  - `VehicleAsset` 타입 import를 `../types/assets`로 전환.
- `src/app/pages/Reservations.tsx`
  - `VehicleAsset` 타입 import를 `../types/assets`로 전환.
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.21 갱신 및 BK-044 증빙 기록 규칙 추가.

## Validation
```bash
npm run build
# 첫 실행: vite not found (의존성 미설치)

npm install
# 의존성 설치 완료

npm run build
# vite build 성공
# chunk size warning only
```

## Notes
- `Home/Revenue/Settings/Reservations`의 mock 데이터 의존은 별도 Jira 트랙(BK-052/054/073/074/075 등) 범위로 유지했다.
- 본 변경은 SCRUM-40 범위(Assets 도메인 mock 경로 제거 + 타입 의존 분리)에 한정했다.
