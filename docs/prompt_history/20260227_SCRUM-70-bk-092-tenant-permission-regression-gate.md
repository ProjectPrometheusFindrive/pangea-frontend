# SCRUM-70 BK-092 FE Tenant/Permission Regression Gate

- Date: 2026-02-27
- Author: Codex (GPT-5)
- Branch: fix/SCRUM-70-fe-gate
- Tags: scrum-70,bk-092,frontend,e2e,tenant,permission,security

## Start Context
- Ticket: `SCRUM-70` (`[BK-092] 테넌시-권한 보안 회귀`)
- 목표: staging 의존 없이 FE 보안 회귀 게이트를 강화하고, 401/403/404 및 권한/테넌시 차단 분기를 E2E로 고정.

## Changes Summary
- 권한 응답 기반으로 메뉴 비노출 및 직접 URL 접근 차단(`/forbidden`)을 검증하는 E2E를 추가.
- 예약 상세 조회에서 `403(TENANT_MISMATCH)`와 `404(NOT_FOUND/은닉)` 분기 시 사용자 안내 문구가 다르게 노출되는 회귀 케이스를 추가.
- 기존 `401` 세션 만료 케이스와 결합해 예약 상세 흐름의 401/403/404 보안 분기 커버리지를 강화.

## Diffs & Files
- `e2e/login.spec.ts`
  - 설정 메뉴 비노출 + `/settings` 직접 접근 시 `/forbidden` 전환 테스트 추가
- `e2e/reservations.spec.ts`
  - 예약 상세 `403` 접근 불가 안내 테스트 추가
  - 예약 상세 `404` 삭제/은닉 안내 테스트 추가

## Validation
```bash
npm run build
# success

npx playwright test e2e/login.spec.ts --grep "권한 없는 설정 메뉴"
# failed: host system missing Playwright browser dependencies
```

## Notes
- Playwright 런타임 OS 의존성 부족으로 로컬 브라우저 실행은 불가했으나, 빌드 및 테스트 코드 반영은 완료됨.
- 본 변경은 FE 권한 UX와 BE 권한 응답(403/404) 해석 일관성을 강화한다.
