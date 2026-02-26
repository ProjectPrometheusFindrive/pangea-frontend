# SCRUM-57 BK-075 Settings API Integration

- Date: 2026-02-27 07:41 KST
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-57-bk-075-settings-api
- Tags: scrum-57,bk-075,settings,api-integration,company,geofence,members,dirty-check,error-handling

## Start Context
- Ticket: `SCRUM-57` (`[BK-075] Settings API 연동`)
- Jira AC 핵심:
  - Settings 화면에서 회사/지오펜스/멤버 설정을 API와 연동
  - dirty-check, 저장 상태(saving/success), 저장 실패 분기(400/403/409/5xx+network) 강화
  - 부분 업데이트(partial patch)에서 누락 필드 보존
  - 저장 중/미저장 상태 이탈 경고 처리
- 작업 제약:
  - `dev` 기준 `git worktree` 분리 작업
  - Jira 상태 `To-do -> 진행 중` 전환 후 작업 계획 코멘트 기록
  - 최소 `npm run build` 검증

## Changes Summary
- Settings 도메인 전용 서비스 모듈(`src/services/settings.ts`)을 추가해 `company/geofences/members` API 계약을 typed wrapper로 고정했다.
  - `GET/PUT /api/v2/settings/company`
  - `GET/POST/PUT/DELETE /api/v2/settings/geofences`
  - `GET /api/v2/settings/members`, `PATCH /api/v2/settings/members/{userId}/role`
- `src/app/pages/Settings.tsx`를 mock 중심 구조에서 API 기반 구조로 리팩터링했다.
  - 초기 진입 시 company/geofences/members를 병렬 hydrate
  - 기존 bulk 업로드 탭은 유지하고, 회사 정보 탭을 추가
- 회사 설정 저장 플로우를 구현했다.
  - dirty-check 기반 저장 버튼 활성화
  - 변경 필드만 전송하는 partial update 구성
  - 변경 발생 시 `schemaVersion` 필드 포함 전송
  - 400 필드 오류 매핑, 403 권한 메시지, 409 충돌 시 재로딩, 5xx/네트워크 재시도 버튼 제공
- 지오펜스 저장 플로우를 구현했다.
  - 생성/편집/활성 토글/삭제 API 연동
  - 입력 검증 + 400/403/409/5xx 분기 처리
  - 충돌 시 목록 재조회, retryable 오류에서 재시도 버튼 제공
- 멤버 권한 저장 플로우를 구현했다.
  - 행 단위 draft role 변경/저장/취소
  - 권한 기반 편집 제한(read-only)
  - 400/403/409/5xx 분기 처리와 retryable 재시도 지원
- 이탈 경고를 강화했다.
  - 회사/지오펜스/멤버 변경사항 또는 저장 중 상태에서 `beforeunload` 경고 활성화
  - 탭 이동 시 미저장 변경사항 확인(confirm) 추가

## Diffs & Files
- `src/services/settings.ts` (new)
  - Settings API 서비스 계층 추가 및 요청/응답 타입 정의
- `src/app/pages/Settings.tsx`
  - Settings 페이지 API hydrate, 회사/지오펜스/멤버 저장 플로우, 오류/재시도/권한 분기, 이탈 경고 구현
- `docs/prompt_library/prompt_library_v1.md`
  - `v1.2.27` 버전 업데이트 및 BK-075 계열 prompt_history 증적 규칙 추가
- `docs/prompt_history/20260227_SCRUM-57-bk-075-settings-api-integration.md` (new)
  - 본 작업 이력 기록

## Validation
```bash
npm run build
# 실패: sh: 1: vite: not found

npm install
npm run build
# 성공: vite production build 완료
```

## Notes
- `package.json` 기준 lint/test 스크립트는 정의되어 있지 않아 별도 lint/test 실행은 생략했다.
- Build 결과에서 기존 번들 chunk size 경고는 유지되며, 기능 검증에는 영향 없는 경고다.
