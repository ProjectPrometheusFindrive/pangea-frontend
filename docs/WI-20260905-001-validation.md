# WI-20260905-001 v2.1 로컬 구현 증거

2026-09-17 갱신. 정책/상태 source of truth는 [06 Result Review](https://app.notion.com/p/3ddf7cb84d958101a561c955cb4ef637)다. 최신 최종 결과는 전체 70개 통과이며 아래 중간 실패 기록과 구분한다.
이 파일은 코드와 함께 보관하는 검증 기록이며 배포 완료 기록이 아니다.

## 승인 범위

[Q00–Q15 답변](https://app.notion.com/p/3d3f7cb84d9581ddac97d7d1dec82cc6), 사용자 선택 v2.1 계열.
member 기본 계약/사고 초안과 실제 금융 권한 분리, 검사 ACK, 블랙박스 사유, super 설치 회사 scope, 수동 면허 결과, KST, 계약 점유율 UI.

## main 검토 및 재작업

- GPT-5.6 Luna medium 작업을 main이 재검토했다. 단순 버튼 확인을 실제 draft PATCH, allocation POST, refund PATCH 증거로 보강했다.
- super route의 installer 전용 제한, 잘못된 hook 의존 변수, 회사 scope 누락, 완료 재시도 중복 생성, 목록 로딩 중 제출을 수정했다.
- refund/waive payload와 결제 생성/확정/배정 각각의 권한을 BE 계약에 맞췄다.
- 가동률 오류/잘못된 날짜에도 회사·기간 입력을 보존하고 재시도 가능하게 보완했다.

## 검증

```bash
npm run test:e2e -- e2e/device-installation.spec.ts e2e/questionnaire-*.spec.ts e2e/action-required-payment-actions.spec.ts e2e/reservations.spec.ts --workers=2
npm run build
```

2026-09-17 최종 대상 42개 통과(questionnaire 18개 + 설치 3개 + 결제 권한/확인 4개 + 예약 17개). Vite 3,141 modules build 성공, bundle >500kB 경고 유지.
브라우저에서 실제 컴포넌트/입력/요청을 실행하지만 API는 합성 mock이다. 실제 DB와 묶은 full-stack E2E로 보고하지 않는다.

기존 Home 3건, 계정 초대 1건 실패는 변경 전 HEAD를 별도 임시 폴더/5275 포트에서 실행해 같은 실패를 재현했다.
login의 member settings 비노출 테스트는 기존 permission fixture가 role 정책과 달랐고 fixture를 수정한 뒤 통과했다.
2026-09-17 `npm run test:e2e -- e2e/reservations.spec.ts --workers=2`는 17개 통과했다. 검사/보험 만료일 fixture를 상대 미래일로 바꿨고 실제 검사 차단 정책은 변경하지 않았다.
사용자가 별도 승인하기 전 운영 데이터 이관·배포·외부 연동을 진행하지 않는다.

## 마지막 권한 재검토

main은 버튼 표시만 검사한 테스트를 반려하고 confirm-only member의 확인 dialog → 실제 PATCH 1회/payload를 검증하도록 했다. 금융 권한이 없는 member와 완료된 이슈의 실제 admin 계정은 완료/면제/금액 편집 UI가 없고 금융 요청이 0건임을 확인했다. 금액/유형 편집과 confirm/void/waive의 권한 및 resolved 차단을 분리했다. 마지막 테스트의 admin fixture와 전체 금융 mutation 관측을 main이 보강한 후 해당 4개를 다시 실행해 통과했다.

## N01 전체 Playwright 회귀 검증 — 중간 이력

2026-09-17 전체 suite를 실행했다.

```bash
npm run test:e2e -- --workers=2
```

총 70개 중 67개 통과, 3개 실패했다.

- `customer-manual-live-smoke.spec.ts` 2건: 실제 backend `127.0.0.1:5000` 로그인 호출에서 `ECONNREFUSED`.
- `settings-bulk-ocr.spec.ts` 1건: Settings hydration 실패로 `settings-tab-bulk` 렌더링 전 중단.

실패 테스트를 삭제하거나 skip하지 않았다. N01 지정 suite는 별도로 모두 통과했다.

```bash
npm run test:e2e -- e2e/home.spec.ts e2e/account-settings.spec.ts --workers=2
# 7 passed (4.3s)
npm run build
# Vite 3,141 modules transformed; build succeeded
```

settings-bulk-ocr fixture에 `settings/garages` 및 `invitations` mock을 보강한 뒤 targeted test는 통과했다. backend simulator DB(`pangea-v21-db`)를 명시해 live smoke를 재실행한 결과 installer 시나리오는 통과했고, admin 시나리오는 정책상 viewer 계정이 제거되어 `viewer@demo-company.com` 기대값에서 실패했다. 이는 현재 승인된 viewer 제거 정책과 기존 live-smoke 기대값의 불일치이며, 테스트 파일 소유 agent/main이 member 기준으로 갱신할 사항이다.

중간 보고의 68/70에는 이전 backend 미기동과 재실행의 viewer fixture 불일치 설명이 혼재했다. 이를 최신 단일 실행 결과로 인용하지 않는다. 아래 N02 최종 전체 실행 70/70으로 대체한다.

## N02 viewer 제거 및 실제 권한 회귀 재검증

승인된 N02 정책에 맞춰 `customer-manual-live-smoke.spec.ts`의 viewer 계정 기대를 제거했다. 관리자 로그인 후 실제 `/api/v2/permissions/me` 응답으로 브라우저 권한 캐시를 구성하며, 고정된 역할 권한 목록을 주입하지 않는다. 실제 `/api/v2/settings/members?status=approved` 응답은 `admin@demo-company.com` 및 `member@demo-company.com`만 반환하고 viewer는 0건이었다. installer는 별도 `/api/v2/device-installations/tasks` 실조회와 설치 화면으로 검증했다.

실행 환경은 현재 frontend/backend 코드, backend `127.0.0.1:5000`, MongoDB `localhost:27017`, DB `pangea-v21-db`였다. 두 live-smoke 테스트가 통과했다.

- `rental admin can inspect generated manual anchors through UI screens`
- `installer sees generated installation work and remains blocked from rental settings`

```bash
npm run test:e2e -- --workers=2
# 70 passed (46.4s)
npm run build
# Vite 3,141 modules transformed; build succeeded
```

bundle >500kB 경고는 유지되며 실패가 아니다. 실제 DB를 대상으로 한 smoke 외 전체 E2E API는 기존 합성 mock을 사용한다.

## 2026-09-18 N02 공통 권한 fixture 최종 검증

`e2e/helpers/apiMock.ts`의 공통 role matrix를 backend `current_permissions()`와 정합화했다. admin에서는 `action.support.manage`를 제거했고, admin/super_admin에는 실제 claim·billing·payment·reservation granular actions를 포함했다. member의 settings route 제외 및 claim draft, installer의 installation 권한은 유지했다. esbuild 비교 결과 member 10/admin 25/super_admin 30/installer 2 권한 모두 누락·초과 0건이었다.

admin support 테스트는 관리 grant를 주입하지 않고 접수 화면을 표시하며 support ticket 관리 목록 GET 요청 0건을 확인한다. super_admin의 회사별 목록·상태변경 관리 테스트는 유지했다.

```bash
npm run test:e2e -- e2e/support-center.spec.ts --workers=1
# 2 passed (2.5s)
npm run test:e2e -- --workers=2
# 70 passed (46.5s)
npm run build
# Vite 3,141 modules transformed; build succeeded
```

최종 FE 전체 E2E는 70개 전부 통과했다. backend smoke는 `127.0.0.1:5000`에서 현재 코드로 기동했고 MongoDB `localhost:27017`, DB `pangea-v21-db`를 사용했다. bundle >500kB 경고는 기존과 동일하다.

main이 변경된 Home/계정/OCR/live smoke 총 10개를 별도로 재실행하여 10 passed (6.0s)를 확인했다. 이는 전체 70개 결과에 더해 집계하는 새 독립 테스트 수가 아니라 교차 재검증이다.
