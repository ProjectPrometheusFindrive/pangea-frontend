# SCRUM-212 Home Today Summary

- Date: 2026-03-07 09:27
- Author: J Hong
- Branch: feat/SCRUM-212-home-today-summary-fe
- Jira Key: SCRUM-212
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-212,home,today-summary,reservations

## Start Context
- Jira 요구사항은 홈 summary 응답의 `today` 객체를 사용해 `오늘 할 일` 카드를 표시하고, 카드 클릭 시 예약 목록으로 정확한 필터를 넘기는 것이다.
- FE는 기존 summary hydrate 흐름을 유지하고 별도 today endpoint를 만들지 않는다.

## Changes Summary
- `home` service 타입에 `today` 객체를 추가하고 홈 화면이 파생 계산 대신 API 응답을 직접 사용하도록 정리했다.
- 홈 `오늘 할 일` 카드 클릭 시 overdue 또는 pickup/return due 필터를 가진 reservations 링크로 이동하게 했다.
- reservations 화면이 today 관련 query param을 인식하도록 분기와 상태 동기화를 보강했다.
- merge 전 점검에서 발견한 누락을 보완해 reservations 목록 요청에도 `due` 필터를 전달하도록 수정했다.

## Diffs & Files
- `src/services/home.ts`: `summary.today` 타입/파서 추가.
- `src/app/pages/Home.tsx`: today 카드 렌더링과 링크 동작 정리.
- `src/app/pages/Reservations.tsx`: today/overdue query 처리 추가 및 due filter API 전달 보강.
- `src/services/reservations.ts`: overdue를 `대여중` 계약 상태로 정규화하고 `due` query 지원 추가.

## Commands Used
```bash
npm install --package-lock=false
npm run build
```

## Validation
```bash
npm run build
# Result: passed
```

## Notes
- `Reservations.tsx`를 `SCRUM-213`도 수정하므로 merge 순서를 `SCRUM-213` 후 `SCRUM-212`로 둔다.
- BE `summary.today` 계약 PR과 synchronized merge가 필요하다.
- home 카드가 여는 today/overdue 목록이 서버 페이지네이션 전에 정확히 필터되도록 BE reservations query와 함께 보강했다.
