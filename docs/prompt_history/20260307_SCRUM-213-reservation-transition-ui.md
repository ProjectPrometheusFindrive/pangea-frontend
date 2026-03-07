# SCRUM-213 Reservation Transition UI

- Date: 2026-03-07 09:27
- Author: J Hong
- Branch: feat/SCRUM-213-reservation-transition-ui
- Jira Key: SCRUM-213
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-213,reservations,transition-ui,return-flow

## Start Context
- Jira 요구사항은 예약 상세에서 `대여 시작`, 대여 상세에서 `차량 반납 처리`를 제공하되 기존 전이 API와 회원가입/권한 구조를 건드리지 않는 것이다.
- 변경 범위는 FE 한정이며, 다른 활성 worktree와 겹치지 않도록 reservations 화면과 service 레이어에 국한한다.

## Changes Summary
- 기존 transition API를 재사용하는 `transitionReservation` service를 추가했다.
- 상세 유형에 따라 CTA를 분리해 예약 상세에는 `대여 시작`, 대여 상세에는 `차량 반납 처리`만 노출되도록 정리했다.
- 전이 성공 후 상세/목록을 다시 조회하도록 연결했고, 전이 충돌 시 재조회 경로를 보강했다.
- E2E 시나리오에 예약 시작/반납 처리 흐름을 추가했다.

## Diffs & Files
- `src/services/reservations.ts`: reservation transition 호출 추가.
- `src/app/pages/Reservations.tsx`: 상세 액션 노출 조건, 실행 핸들러, 재조회 흐름 추가.
- `e2e/reservations.spec.ts`: 예약 시작/반납 처리 회귀 시나리오 추가.

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
- Playwright 실제 실행은 호스트 브라우저 의존성 부족으로 보류됐다.
- PR 생성 후 Jira를 `Resolved`로 전환하고 링크를 코멘트에 남긴다.
