# SCRUM-66 BK-087 고객센터 UI/연동 추가

- Date: 2026-02-27 08:05 KST
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-66-support-center-ui-integration
- Tags: scrum-66,bk-087,support,frontend,integration,error-handling,retry,permission

## Start Context
- Ticket: `SCRUM-66` (`[BK-087] 고객센터 UI-연동 추가`)
- Jira AC 핵심:
  - `GET /api/v2/support/categories`, `POST /api/v2/support/tickets`, `GET /api/v2/support/tickets/{ticketId}` 연동
  - 메뉴 진입 시 카테고리 loading, 제출 시 submitting, 성공 시 접수 완료(`ticketId`) 노출, 상세 조회 시 상태 배지 갱신
  - `400/401/403/5xx` 분기 메시지와 재시도/권한 액션 처리
  - 첨부파일 용량 초과, 중복 제출 방지, 제출 후 새로고침 시 접수 정보 복구, 카테고리 empty 처리
- 작업 제약:
  - `dev` 기반 worktree 분리
  - Jira `To-do -> 진행 중` 전환 + 작업 계획 코멘트 등록 후 구현
  - 최소 `npm run build` 검증

## Changes Summary
- 고객센터 도메인 서비스 `src/services/support.ts`를 신규 추가해 Support API 계약을 FE에서 일관되게 호출하도록 구성했다.
  - 카테고리 조회: `GET /api/v2/support/categories`
  - 문의 생성: `POST /api/v2/support/tickets`
  - 문의 상세: `GET /api/v2/support/tickets/{ticketId}`
  - 구버전 호환 fallback:
    - categories 미구현(404/405) 시 기존 티켓 목록에서 카테고리 유추
    - detail 미구현(404/405) 시 목록 조회 기반 ticketId 매칭 fallback
  - 응답 payload 정규화(ticket/category/status/history/attachments) 및 `ApiError` 기반 예외 전달
- 고객센터 페이지 `src/app/pages/SupportCenter.tsx`를 신규 구현하고 라우트/메뉴를 연결했다.
  - 카테고리 로딩/에러/empty 상태를 `PageStateBoundary + usePageEndpointState` 패턴으로 처리
  - 카테고리 empty 시 “직접 입력 모드”로 전환 가능하게 구현
  - 문의 폼(submit) 구현:
    - `isSubmitting` + fingerprint 기반 중복 제출 방지
    - 첨부파일 정책: 최대 개수(`VITE_SUPPORT_ATTACHMENT_MAX_COUNT`, 기본 3), 파일당 최대 용량(`VITE_SUPPORT_ATTACHMENT_MAX_BYTES`, 기본 5MB) 검증
    - `400` 필드 오류 매핑, `401/403` 권한 액션 버튼, `5xx/network/timeout` 재시도 버튼 처리
  - 접수 완료 후 ticketId/상태 배지 노출 및 상태 조회/새로고침 버튼 구현
  - `sessionStorage(pangea.support.last-ticket.v1)`에 접수 내역 저장 후 새로고침 복구 처리
- 라우팅/권한 노출:
  - `/support-center` 경로를 rental-business 보호 라우트에 추가
  - 사이드바 메뉴에 “고객센터” 항목 추가(권한: `rental-business`)

## Diffs & Files
- `src/services/support.ts` (new)
  - support categories/create/detail 서비스, payload 정규화, 404/405 fallback 구현
- `src/app/pages/SupportCenter.tsx` (new)
  - 고객센터 UI/폼/조회/에러/재시도/권한/복구 플로우 구현
- `src/app/routes.ts`
  - 고객센터 라우트(`/support-center`) 추가
- `src/app/components/Layout.tsx`
  - 사이드바 고객센터 메뉴 추가
- `docs/prompt_library/prompt_library_v1.md`
  - `v1.2.30` 업데이트 및 BK-087 prompt_history 증적 규칙 추가
- `docs/prompt_history/20260227_SCRUM-66-bk-087-support-center-ui-integration.md` (new)
  - 본 작업 이력 기록

## Validation
```bash
npm run build
# 실패: sh: 1: vite: not found

npm ci
npm run build
# 성공: vite production build 완료
```

## Notes
- 현재 `package.json`에는 `build/dev`만 정의되어 있어 lint/test 스크립트는 실행 대상이 없다.
- 현 BE 저장소 기준으로 `GET /api/v2/support/categories`, `GET /api/v2/support/tickets/{ticketId}`가 미구현일 수 있어 FE에서 404/405 fallback을 포함했다.
