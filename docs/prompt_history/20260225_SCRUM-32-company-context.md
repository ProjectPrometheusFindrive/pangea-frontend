# SCRUM-32 Company Context

- Date: 2026-02-25 23:44 KST
- Author: Codex
- Branch: feat/SCRUM-32-company-context
- Tags: scrum-32,bk-022,company,context,settings,api-v2

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 후 상태를 `진행 중`으로 전환
  - `dev` 최신화 후 `git worktree`로 분리 브랜치 생성
  - `rg` 기반 영향 범위 분석 후 `update_plan` 등록
- Jira 요구사항:
  - Ticket: `SCRUM-32` (`[BK-022] CompanyContext 도입`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md`의 BK-022 완료 기준
  - 핵심 AC: 회사 정보 조회/갱신 전역 상태 동작
- 제약:
  - AGENTS.md 준수, 최소/정밀 변경
  - 커밋/푸시 금지 상태에서 코드만 반영

## Changes Summary
- `CompanyContext`를 신규 도입해 회사 정보 전역 상태(`company`, `isLoading`, `isUpdating`, `error`)와 조회/갱신 액션(`refreshCompany`, `updateCompany`)을 제공했다.
- OpenAPI v2 초안(`GET/PATCH /api/v2/company`)을 따르는 회사 API 레이어(`getCompany`, `patchCompany`)를 추가했다.
- `App` Provider 트리를 `AuthProvider -> CompanyProvider -> RouterProvider`로 변경해 전 라우트에서 회사 상태를 공유하도록 구성했다.
- `Layout`의 회사명 로컬 상태를 제거하고 전역 `useCompany()` 기반으로 전환했다.
  - 계정 드롭다운 회사명 표시가 전역 상태를 사용
  - 계정 설정 모달의 회사명 저장이 `updateCompany`를 호출
  - 저장 중 UI 비활성화 및 오류 메시지 노출 처리
- API 실패 시 앱이 깨지지 않도록 `localStorage` 캐시 + fallback 회사 데이터로 읽기/쓰기 복구 경로를 추가했다.

## Diffs & Files
- `src/services/company.ts` (new)
  - `/api/v2/company` 조회/수정 API 함수 추가
- `src/app/context/CompanyContext.tsx` (new)
  - 회사 전역 컨텍스트/Provider/Hook 구현
  - AC 근거:
    - 조회: `refreshCompany`에서 `getCompany()` 호출
    - 갱신: `updateCompany`에서 `patchCompany()` 호출 및 전역 상태 반영
- `src/app/App.tsx`
  - `CompanyProvider` 주입
- `src/app/components/Layout.tsx`
  - 로컬 `companyName` 상태 제거
  - `useCompany()` 기반 표시/수정 흐름으로 변경

## Validation
```bash
npm run build
# 실패: vite: not found

npm i
npm run build
# 성공: vite production build 완료
```

## Notes
- 후속 티켓(BK-075)에서 Settings 페이지의 회사 상세 필드(`businessNumber`, `contactName`, `address` 등)를 `CompanyContext`와 동일한 데이터 소스로 통합하면 중복 상태를 줄일 수 있다.
