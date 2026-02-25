# SCRUM-78 Company Save Failure Alert

- Date: 2026-02-26 06:56 KST
- Author: Codex
- Branch: fix/scrum-78-company-save-failure-alert
- Tags: scrum-78,bug,company-context,layout,save-flow,error-handling,ac-evidence

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 후 상태를 `진행 중`으로 전환
  - `dev` 최신화 후 `git worktree`로 분리 브랜치 생성
  - `rg` 기반 영향 범위 분석 후 `update_plan`에 작업 계획 등록
- Jira 요구사항:
  - Ticket: `SCRUM-78` (`[BUG] CompanyContext 저장 실패 시 성공 알림 노출`)
  - 핵심 AC:
    - PATCH 실패 시 성공 alert 미노출
    - PATCH 실패 시 모달 미닫힘
    - PATCH 실패 시 오류 메시지 모달 내 노출
    - PATCH 성공 시에만 모달 닫힘 + 성공 alert
- 제약:
  - AGENTS.md 준수, 최소/정밀 변경
  - worktree context guard(`pwd`, `repo top`, `branch`)를 git 단계마다 확인

## Changes Summary
- `CompanyContext.updateCompany`에서 PATCH 실패 시 optimistic 성공 반환을 제거하고 예외를 호출부로 전파하도록 변경했다.
  - 실패 시: `error` 설정 + throw
  - 성공 시: 기존대로 회사 상태/캐시 갱신
- `Layout.handleSaveSettings`를 저장 성공/실패 분기로 변경했다.
  - 실패 시: `catch` 후 즉시 `return`하여 모달 유지, 성공 alert 미표시
  - 성공 시: 기존대로 모달 닫힘 + `계정 정보가 저장되었습니다` alert 표시
- Jira 프로토콜을 반영해 진행 상태 전환(`진행 중`)과 작업/검증 코멘트 등록을 완료했다.
- `prompt_library_v1.md`를 `v1.2.11`로 갱신하고, 저장/수정 버그 티켓의 성공/실패 분기 근거 기록 규칙을 추가했다.

## Diffs & Files
- `src/app/context/CompanyContext.tsx`
  - `updateCompany` 실패 경로에서 optimistic 반영 제거 및 `throw updateError` 적용
- `src/app/components/Layout.tsx`
  - `handleSaveSettings` 내 `updateCompany` 호출을 `try/catch`로 감싸 실패 시 조기 종료
- `docs/prompt_library/prompt_library_v1.md`
  - `Version`을 `v1.2.11`로 갱신
  - `Prompt History Capture Rules`에 저장/수정 버그 티켓 분기 근거 기록 규칙 추가
  - `Version History`에 `SCRUM-78` 이력 추가
- `docs/prompt_history/20260226_SCRUM-78-company-save-failure-alert.md` (new)
  - 본 작업 이력 기록

## Validation
```bash
npm run build
# 초기 실패: vite: not found

npm install --no-package-lock
npm run build
# 성공: vite production build 완료
```

## Notes
- `vite build`는 성공했고 기존과 동일하게 chunk size 경고가 출력되었다.
- 후속으로 계정 설정 저장 UX를 확장할 때는 `name` 필드 저장 정책(로컬 반영/서버 동기화)을 별도 티켓에서 정리하는 것이 안전하다.
