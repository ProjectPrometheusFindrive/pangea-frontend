# SCRUM-22 Common Glossary Finalization

- Date: 2026-02-25 21:07
- Author: Codex
- Branch: feat/20260225-blueprint-registry-update
- Tags: scrum-22,bk-001,glossary,terminology,status-normalization

## Start Context
- Start Prompt 핵심 절차:
  - `git fetch --all --prune`
  - `git switch dev && git pull --ff-only`
  - 영향 범위 `rg` 검색
- Jira 요구사항:
  - Ticket: `SCRUM-22` (`[BK-001] FE-BE 공통 용어집 확정`)
  - AC 기준: `planning/06_jira_backlog_breakdown.md`의 BK-001 (`vehicleNumber/vin/plate`, `reservation/rental`, `status` 용어 고정)
- 작업 제약:
  - AGENTS.md 준수, 최소·정밀 변경
  - `dev` 기반 브랜치 전략 준수
  - 파괴적 git 명령 금지

## Changes Summary
- 공통 용어 기준 문서 신설:
  - `docs/common_glossary.md` 생성
  - canonical 용어(`vehicleNumber`, `vin`, `reservation/rental/return`) 및 도메인별 `status` 값 확정
  - 레거시 입력 `예약됨` -> `예약` 정규화 규칙 명시
- 문서 참조 연결:
  - `README.md`에 glossary 링크와 source-of-truth 안내 추가
  - `planning/04_legacy_gap_apply_todo.md`의 Phase 0 용어집 항목 완료 처리
- 코드 정합성 최소 보정:
  - `Assets`: 상태 필터 canonical을 `예약`으로 전환하고 `예약됨` 호환 유지
  - `Settings`: CSV 출력/검증 canonical `예약` 적용 + `예약됨` 입력 호환/정규화
  - `Reservations`: 상태 색상에 `예약` 케이스 추가
  - `Revenue`: 용어 주석 `예약됨` -> `예약` 정리
- End Prompt 규칙 반영:
  - `docs/prompt_library/prompt_library_v1.md`를 `v1.2.3`으로 갱신
  - `prompt_history` 필수 섹션 규칙(Start Context/Changes Summary/Diffs & Files/Notes) 명문화

## Diffs & Files
- `docs/common_glossary.md` (new)
- `README.md`
- `planning/04_legacy_gap_apply_todo.md`
- `src/app/pages/Assets.tsx`
- `src/app/pages/Settings.tsx`
- `src/app/pages/Reservations.tsx`
- `src/app/pages/Revenue.tsx`
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260225_SCRUM-22-common-glossary-finalization.md` (new)
- `package-lock.json` (new, npm 기준 lockfile 관리)

## Validation
```bash
npm i
npm run build
# vite build 성공
```

## Notes
- `package-lock.json`은 npm 기준 운영 원칙에 따라 커밋 포함 대상으로 유지.
- `예약됨`은 하위호환 값으로만 허용하고 내부 canonical 저장 값은 `예약` 유지.
- 차기 권장 태스크(즉시 반영 금지): OpenAPI v2 초안(BK-002)에 본 용어집을 직접 링크해 계약 필드명 검증 자동화.
