# SCRUM-67 DeviceInstallation 서버 연동

- Date: 2026-02-26 20:50 KST
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-67-deviceinstallation-server-integration
- Tags: jira,scrum-67,bk-088,frontend,device-installation,integration

## Start Context
- Ticket: `SCRUM-67` (`[BK-088] DeviceInstallation 서버 연동`)
- 목표: DeviceInstallation 화면의 mock 의존 제거 및 서버 연동 완료
- Jira AC 핵심:
  - 목록/신청/취소 API 연동
  - 신청 후 pending(대기) 상태 즉시 반영
  - 400/401/403/404/409/5xx 에러 분기 처리와 Retry 동선
  - 중복 신청 차단, 페이지네이션 중 상태 변경 동기화
- 확인된 BE canonical 계약(`SCRUM-63`, OpenAPI):
  - `POST /api/v2/device-installations`
  - `GET /api/v2/device-installations/tasks`
  - `PATCH /api/v2/device-installations/{installationId}/status`

## Plan
- DeviceInstallation 전용 서비스 모듈을 추가하고, 경로 차이(`.../tasks`, `.../status` vs ticket 문구 경로)를 안전하게 호환한다.
- `src/app/pages/DeviceInstallation.tsx`를 mock 기반 상태에서 API 기반 상태로 교체한다.
- 신청/취소 액션에서 에러 상태별 사용자 메시지와 재시도 동선을 보강한다.
- 페이지네이션/상태 필터/요약 카운트 갱신을 추가해 상태 동기화를 보장한다.

## Changes Summary
- `src/services/deviceInstallations.ts` 신규 추가
  - 목록 조회, 생성, 취소 API 래퍼 구현
  - 상태 정규화(`pending -> scheduled`, `canceled -> cancelled`) 처리
  - 목록 조회는 `GET /api/v2/device-installations` 시도 후 `404/405`에서 `.../tasks`로 fallback
  - 취소는 `PATCH .../{id}/cancel` 시도 후 `404/405`에서 `.../{id}/status` + `status=cancelled` fallback
- `src/app/pages/DeviceInstallation.tsx` 전면 연동
  - mock 데이터 제거, API 기반 목록/요약/필터/페이지네이션 적용
  - 신청 시 VIN/예약일시/시리얼/사진 검증 + 중복 신청 차단
  - 사진 2종을 data URL로 변환하여 `photos` 필드로 서버 저장
  - 취소 액션 버튼 추가(`scheduled`, `in_progress` 상태만 허용)
  - 400/401/403/404/409/5xx 메시지 분기 및 retry 유도
  - 페이지네이션 중 상태 변경으로 현재 페이지가 비는 경우 이전 페이지 자동 이동

## Diffs & Files
- `src/services/deviceInstallations.ts`
  - DeviceInstallation API client + payload normalization + legacy/canonical endpoint fallback
- `src/app/pages/DeviceInstallation.tsx`
  - 서버 연동 기반 UI 상태 관리, 신청/취소 액션, 에러 처리, 상태 필터/페이지네이션/요약 카운트

## Validation
```bash
npm run build
```

- 결과: 성공 (`vite build` 완료)
- 비고: 로컬 Node 버전(`v18.19.0`)에서 `react-router@7.13.0` 엔진 경고가 있으나 build 자체는 통과

## Notes/Follow-ups
- `docs/prompt_library/prompt_library_v1.md`는 프롬프트 정책 변경이 없어 버전 업데이트를 생략함.
- BE 계약은 현재 `/tasks`, `/status` 기준이므로 FE에서 안전 fallback을 유지했다.
