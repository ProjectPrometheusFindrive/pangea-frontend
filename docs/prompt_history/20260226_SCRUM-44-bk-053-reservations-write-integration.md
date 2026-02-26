# SCRUM-44 BK-053 Reservations Write Integration

- Date: 2026-02-26 22:05
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-44-bk-053-reservations-write
- Tags: scrum-44,bk-053,reservations,write-integration,create-return-accident,error-handling

## Start Context
- Start Prompt 기준으로 `dev` 기반 worktree(`../SCRUM-44-bk-053-reservations-write`)에서 작업했고, Jira `SCRUM-44`를 `진행 중`으로 전환 후 작업 계획 코멘트를 선반영했다.
- Jira AC 핵심:
  - `POST /api/v2/reservations`, `POST /api/v2/reservations/{reservationId}/return`, `POST /api/v2/reservations/{reservationId}/accident` FE 연동
  - create/return/accident 실행 시 submitting 표시 및 성공 후 목록/상세 상태 즉시 동기화
  - `400` 필드/폼 오류, `403` 권한 안내, `409` 상태 충돌 안내, `5xx` 재시도 토스트 분기
  - 이중 클릭 중복 요청 방지, 이미 반납 상태 재반납 차단, 사고 첨부 누락/과대용량 처리

## Changes Summary
- Reservations 쓰기 API 클라이언트 추가:
  - `createReservation`, `returnReservation`, `reportReservationAccident`를 `src/services/reservations.ts`에 추가해 BK-053 대상 엔드포인트를 FE에서 직접 호출하도록 구성.
- 새 계약 모달(NewContractModal) 쓰기 연동:
  - 모달을 async submit 구조로 리팩터링하고, 제출 중 버튼 disable/로더 표시로 중복 제출을 차단.
  - 단계별 필수값 검증 + 필드 단위 에러 렌더링 + 상단 폼 에러 배너를 추가.
  - API 실패(`400/403/409/5xx`) 시 입력값 보존 상태로 에러를 노출하도록 변경.
- 사고 등록 모달(AccidentReportModal) 쓰기 연동:
  - 사고 등록을 async submit 구조로 교체하고, 블랙박스 첨부 필수/50MB 제한 검증을 추가.
  - 제출 중 상태/중복 제출 방지/필드 에러 처리(`description`, `blackboxFile`)를 반영.
- Reservations 페이지 쓰기 핸들러 구현:
  - create 성공 시 응답 ID를 기준으로 상세 모달을 즉시 열고(상세 이동), 목록 재조회로 서버 상태를 동기화.
  - return 성공 시 상세/목록 상태를 `return`으로 즉시 반영 후 재조회하고, 이미 반납 상태는 클라이언트에서 차단.
  - accident 성공 시 사고 이슈 배지(`사고 접수`)를 즉시 반영 후 재조회하고 조치 페이지로 이동.
  - 오류 분기:
    - `400`: 필드/폼 오류 메시지 노출
    - `403`: 권한 안내
    - `409`: 상태 충돌 안내(입력 보존)
    - `5xx`/네트워크: 재시도 토스트(`sonner`) 노출
  - mock fallback 경로 없이 API 실패를 명시적 에러 상태로 처리.

## Diffs & Files
- `src/services/reservations.ts`
  - BK-053 대상 쓰기 API(create/return/accident) 함수 및 payload 타입 추가.
- `src/app/components/NewContractModal.tsx`
  - async submit/onSubmit 피드백 구조 도입, step 검증/필드 에러/UI submitting 상태 추가.
- `src/app/components/AccidentReportModal.tsx`
  - 첨부 파일 필수/용량 검증, async submit, 필드/폼 오류 및 submitting 상태 추가.
- `src/app/pages/Reservations.tsx`
  - 쓰기 API 연동(create/return/accident), 상태 동기화, 400/403/409/5xx 분기, 재시도 토스트, 상세 즉시 이동 로직 반영.
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.23 갱신 및 BK-053 prompt_history 캡처 규칙 추가.

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
- `package.json`에 `lint`/`test` 스크립트가 없어 추가 자동 검증은 수행하지 못했다.
- 로컬 Node 버전(`v18.19.1`)에서 `react-router@7.13.0` 엔진 경고가 발생했지만, 빌드는 정상 완료되었다.
