# SCRUM-69 BK-091 FE E2E 테스트 보강

- Date: 2026-02-27 11:10 KST
- Author: Codex (GPT-5)
- Branch: test/SCRUM-69-bk-091-fe-e2e-hardening
- Tags: scrum-69,bk-091,e2e,playwright,login,assets,reservations,device-installation,ci-artifacts

## Start Context
- Ticket: `SCRUM-69` (`[BK-091] FE E2E 테스트 보강`)
- Jira AC 핵심:
  - `POST /api/v2/auth/login`, `GET /api/v2/assets`, `POST /api/v2/reservations`, `POST /api/v2/device-installations` 포함 사용자 플로우 E2E 보강
  - 각 시나리오에서 `loading -> success` 상태 전환 assertion 포함
  - `401/403/5xx` 오류 분기와 권한/재시도/세션 만료 UI 분기 검증
  - CI 안정화(재시도/타임아웃 기준) 및 실패 아티팩트 수집 정책 명시
- 작업 제약:
  - `dev` 기준 worktree/branch 격리
  - FE 저장소 범위만 수정
  - 종료 시 PR 생성, Jira `Resolved` 전환 + 코멘트

## Changes Summary
- Playwright 기반 E2E 인프라를 신규 도입했다.
  - `@playwright/test` 의존성 추가, `test:e2e*` 스크립트와 `playwright.config.ts` 신설
  - CI 기준 retry(`2`), timeout, worker(`1`) 정책을 설정해 flaky 통제 기준을 코드화
  - `trace/screenshot/video` 실패 아티팩트와 HTML/JUnit 리포트 경로를 표준화
- AC 시나리오를 4개 도메인으로 분리해 E2E 스펙을 구현했다.
  - `e2e/login.spec.ts`: 로그인 성공(loading->success) + `401` 인증 실패
  - `e2e/assets.spec.ts`: 목록 조회/저장 성공, `5xx` retry 복구, 저장 `403` 권한 분기
  - `e2e/reservations.spec.ts`: 생성+반납 전이 성공, 생성 `403`, 반납 `5xx`, 조회 `401` 세션 만료 분기
  - `e2e/device-installation.spec.ts`: 장착 신청 성공(프리미엄 설치 요청 경로), `403/5xx` 오류 분기
- 테스트 안정성 강화를 위해 핵심 인터랙션에 `data-testid`를 추가했다.
  - 로그인/자산 상세 저장/예약 생성·반납/장착 신청 폼 중심으로 최소 hook 부여
  - 텍스트 기반 취약 selector를 줄여 CI 실행 변동성 완화
- 실패 아티팩트 정책과 PR 게이트 연결을 워크플로우로 반영했다.
  - `.github/workflows/e2e-smoke.yml` 추가(`pull_request -> dev`) 및 Playwright 아티팩트 업로드(`always`)
- 프롬프트 운영 문서도 BK-091 규칙으로 갱신했다.
  - `prompt_library_v1.md`를 `v1.2.34`로 올리고 BK-091 증적 규칙(플로우/에러 분기/아티팩트/CI 연계)을 추가

## Diffs & Files
- `package.json`, `package-lock.json`
  - Playwright 의존성 및 `test:e2e`/`test:e2e:install` 스크립트 추가
- `playwright.config.ts` (new)
  - retries/timeouts/reporters/artifact policy/webServer 설정
- `e2e/helpers/apiMock.ts` (new)
  - API envelope/오류 응답/공통 mock 라우팅 유틸
- `e2e/helpers/session.ts` (new)
  - localStorage 기반 인증 세션 주입 유틸
- `e2e/helpers/files.ts` (new)
  - 파일 업로드 시나리오용 fixture
- `e2e/login.spec.ts` (new)
- `e2e/assets.spec.ts` (new)
- `e2e/reservations.spec.ts` (new)
- `e2e/device-installation.spec.ts` (new)
  - AC 커버리지 시나리오 구현
- `.github/workflows/e2e-smoke.yml` (new)
  - PR(dev) 대상 E2E smoke + artifact upload 정책 연결
- `.gitignore`
  - `playwright-report/`, `test-results/` 산출물 ignore 추가
- `src/app/pages/Login.tsx`
  - login/retry/error 영역 `data-testid` 추가
- `src/app/pages/Assets.tsx`
  - 자산 행 test hook 추가
- `src/app/components/VehicleDetailModal.tsx`
  - 저장 플로우/필드/error test hook 추가
- `src/app/pages/Reservations.tsx`
  - 생성/반납/상세 모달 test hook 추가
- `src/app/components/NewContractModal.tsx`
  - 단계별 입력/버튼/error test hook 추가
- `src/app/pages/DeviceInstallation.tsx`
  - 신청 폼/결과 메시지 test hook 추가
- `e2e/README.md` (new)
  - flaky 제어와 failure artifact 정책 문서화
- `docs/prompt_library/prompt_library_v1.md`
  - `v1.2.34` 메타데이터 및 BK-091 prompt_history 규칙 추가
- `docs/prompt_history/20260227_SCRUM-69-bk-091-fe-e2e-hardening.md` (new)
  - 본 작업 이력 기록

## Validation
```bash
npm run build
# 성공: vite production build 완료

npm run test:e2e:install
# 성공(브라우저 다운로드 완료), 단 Host dependency 경고 출력

npm run test:e2e
# 실패(환경 이슈): Playwright browser launch 시 OS 의존성 부족(libatk/libatspi/libxdamage/libasound)

npx playwright test --list
# 성공: 4 files / 12 tests 인식 확인(테스트 코드 로딩·파싱 정상)
```

## Notes
- 현재 실행 환경에서 Playwright 런타임 OS 라이브러리(`install-deps`)가 없어 실제 브라우저 구동 테스트는 실패했다.
- CI 워크플로우에는 `npx playwright install --with-deps chromium`를 포함해 동일 이슈를 해소하도록 구성했다.
