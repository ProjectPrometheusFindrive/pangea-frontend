# SCRUM-297 Home Remove Issue Period Filter

- Date: 2026-03-11 19:04
- Author: Codex
- Branch: fix/SCRUM-297-home-remove-issue-period-filter
- Jira Key: SCRUM-297
- Jira Status: In Progress
- PR URL: PENDING
- Tags: home,period-filter,current-snapshot,prompt-history

## Start Context
- 홈 화면의 이슈 조회기간 필터 버튼은 불필요하므로 제거해야 한다.
- 홈 데이터는 사용자가 접속한 시점을 기준으로 해결할 이슈 count를 보여주면 충분하다.
- 기존 super_admin 회사 범위 selector 동작은 유지하고, 회사 hierarchy 정책 자체는 이번 티켓 범위에서 변경하지 않는다.

## Assumptions (optional)
- Home summary API는 `from`/`to` 쿼리를 필수로 요구하므로, FE에서 기간 선택 UI를 제거하더라도 요청 범위는 명시적으로 계속 전달해야 한다.
- 현재 접속 시점 기준 요구사항은 Home summary 조회 범위를 `오늘 하루`로 고정하는 것으로 해석한다.

## Plan (optional)
- Home 페이지에서 `preset` URL 상태와 기간 버튼 렌더링을 제거한다.
- Home summary fetch 범위를 `resolveTodayRange()` 기반 단일 날짜로 고정한다.
- 기간 의존 빈 상태/최근 변경 문구를 현재 시점 기준 카피로 교체하고 회귀 테스트를 추가한다.

## Changes Summary
- Home 화면에서 `preset` 쿼리 파싱, 자동 보정, 기간 선택 버튼 렌더링을 제거해 조회기간 필터 자체가 다시 나타나지 않도록 정리했다.
- Home summary 요청 범위를 `from=to=today`로 고정해 접속 시점 기준 단일 스냅샷으로만 집계되게 바꿨다.
- 빈 상태와 최근 변경 문구를 기간 조정 전제 없이 현재 기준 표현으로 바꾸고, 관련 회귀 테스트를 추가했다.

## Diffs & Files
- `src/app/pages/Home.tsx`: `preset` 상태/버튼/문구를 제거하고 Home summary 요청 범위를 오늘 기준으로 고정했다.
- `tests/home-current-snapshot.test.mjs`: `preset` 제거, today-range 고정, 현재 시점 기준 카피를 회귀 테스트로 고정했다.
- `docs/prompt_library/prompt_library_v1.md`: SCRUM-297 문서화 규칙과 버전 메타데이터를 갱신했다.

## Validation (optional)
```bash
node --test tests/home-current-snapshot.test.mjs tests/home-actionrequired-alignment.test.mjs tests/home-priority-panel.test.mjs tests/home-issue-card-figma-parity.test.mjs tests/home-score-layout-parity.test.mjs
npm.cmd run build
```

## Notes
- super_admin 회사 범위 selector와 settings-backed company 목록 로딩 흐름은 유지했다.
- 추가로 런타임 `useSearchParams` 흐름까지 검증하려면 `?preset=...&companyId=...` 진입 케이스를 실제 마운트하는 통합 테스트를 후속으로 고려할 수 있다.
