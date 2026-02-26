# SCRUM-45 BK-054 Reservations Mock Removal

- Date: 2026-02-26 22:25
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-45-bk-054-reservations-mock-removal
- Tags: scrum-45,bk-054,reservations,mock-removal,api-single-source

## Start Context
- Start Prompt 기준으로 `dev` 기반 worktree(`../SCRUM-45-bk-054-reservations-mock-removal`)에서 작업했고, Jira `SCRUM-45`를 `진행 중`으로 전환 후 작업 계획 코멘트를 먼저 등록했다.
- Jira AC 핵심:
  - Reservations 프로덕션 경로에서 mock adapter/fixture 의존 제거
  - `GET /api/v2/reservations`, `GET /api/v2/reservations/{reservationId}`, `POST /api/v2/reservations`, `POST /api/v2/reservations/{reservationId}/return`, `POST /api/v2/reservations/{reservationId}/accident` 경로만 사용
  - API 실패 시 mock 대체 없이 명시적 error-state/Retry 정책 유지

## Changes Summary
- Reservations 페이지의 mockData 타입 의존 제거:
  - `src/app/pages/Reservations.tsx`에서 `../data/mockData`의 `Reservation` 타입 import를 제거했다.
  - Reservations 전용 타입을 `src/app/types/reservations.ts`로 분리해 Reservations 화면이 mock 데이터 모듈에 의존하지 않도록 정리했다.
- API 단일 소스 경로 유지 확인:
  - `src/services/reservations.ts`가 AC의 5개 v2 endpoint만 사용함을 재검증했다.
- mock fallback 미사용 근거:
  - Reservations 페이지/서비스 경로에서 `mock`/`fixture`/`mockData` 참조가 제거(혹은 부재)된 상태를 검색으로 확인했다.

## Diffs & Files
- `src/app/types/reservations.ts`
  - Reservations 도메인 타입(`Reservation`) 신규 추가.
- `src/app/pages/Reservations.tsx`
  - `Reservation` 타입 import를 mockData 경로에서 도메인 타입 경로로 교체.
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.25 갱신 및 BK-054 prompt_history 캡처 규칙 추가.

## Validation
```bash
npm run build
# 실패: sh: 1: vite: not found

npm install
# 의존성 설치 완료 (node engine warning only)

npm run build
# vite build 성공
# chunk size warning only
```

## Notes
- `package.json`에 `lint`/`test` 스크립트가 없어 추가 검증은 수행하지 못했다.
- 로컬 Node 버전(`v18.19.1`)에서 `react-router@7.13.0` 엔진 경고가 출력됐지만, 빌드는 정상 완료되었다.
