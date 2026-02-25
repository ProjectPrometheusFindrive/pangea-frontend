# SCRUM-31 Common Loading/Error/Empty UI

- Date: 2026-02-26 05:22 KST
- Author: Codex
- Branch: feat/SCRUM-31-common-loading-error-empty-ui
- Tags: scrum-31,bk-023,frontend,ux,page-fallback,loading,error,empty,state-boundary

## Start Context
- Start Prompt 핵심 절차:
  - Jira AC 확인 후 상태를 `진행 중`으로 전환
  - `dev` 최신화 후 `git worktree`로 분리 브랜치 생성
  - `rg` 기반 영향 범위 분석 후 `update_plan`에 작업 계획 등록
- Jira 요구사항:
  - Ticket: `SCRUM-31` (`[BK-023] 공통 loading-error-empty UI 추가`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md`의 BK-023 완료 기준
  - 핵심 AC: 페이지 공통 fallback UI 적용
- 제약:
  - AGENTS.md 준수, 최소/정밀 변경
  - 코드 변경은 `apply_patch` 기반으로 반영

## Changes Summary
- `src/app/components/PageStateBoundary.tsx`를 신규 추가해 `loading/error/empty` 상태를 공통 UI로 표준화했다.
- `Assets`, `Reservations`, `ActionRequired`, `DeviceInstallation` 페이지에 공통 경계 컴포넌트를 연결해 페이지 단위 fallback을 일관되게 적용했다.
- 각 페이지에 hydrate 함수를 추가해 데이터 로드 흐름을 `isLoading/error/empty` 조건으로 명시적으로 분리하고, 에러 시 재시도 버튼을 공통 패턴으로 제공했다.
- 필터/검색 결과가 없는 경우 기존 빈 상태 공백을 공통 empty fallback으로 통합해 UX 일관성을 높였다.
- `prompt_library_v1.md`를 `v1.2.9`로 갱신하고, PR 후 Jira `Resolved` 전환 직후 Jira 코멘트(핵심 변경/특이사항/PR 링크) 기록 규칙을 추가했다.

## Diffs & Files
- `src/app/components/PageStateBoundary.tsx` (new): 공통 `loading/error/empty` fallback 렌더링 및 상태 경계
- `src/app/pages/Assets.tsx`: 자산 목록 hydrate + 공통 fallback 연결
- `src/app/pages/Reservations.tsx`: 예약 캘린더 데이터 hydrate + 공통 fallback 연결
- `src/app/pages/ActionRequired.tsx`: 조치항목 소스 로드 상태 분리 + 공통 fallback 연결
- `src/app/pages/DeviceInstallation.tsx`: 장착 대상 데이터 hydrate + 공통 fallback 연결
- `docs/prompt_library/prompt_library_v1.md`: `v1.2.9` 버전 반영 및 Jira 완료 코멘트 규칙 추가
- `docs/prompt_history/20260226_SCRUM-31-common-loading-error-empty-ui.md` (new): 본 작업 이력 기록

## Validation
```bash
npm run build
git status --short
```

## Notes
- `vite build`는 성공했으며, 기존과 동일하게 번들 크기(chunk size) 경고가 출력되었다.
- 후속 티켓에서 API 연동이 본격화되면 hydrate 로직의 mock 초기화를 실제 API 호출/재시도 전략으로 교체하는 작업이 필요하다.
