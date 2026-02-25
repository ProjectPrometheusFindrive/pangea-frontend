# Jira 운영 규칙 (BK-003)

## 1. 목적과 적용 범위
- 목적: `SCRUM` 프로젝트에서 티켓 생성/전환 시 라벨, 컴포넌트, DoR/DoD, 의존성 표기 규칙을 일관되게 적용한다.
- 범위: `planning/06_jira_backlog_breakdown.md`와 `planning/07_jira_backlog_seed.csv`를 기준으로 생성/운영되는 Epic/BK 티켓.

## 2. Label 규칙

### 2.1 공통 네이밍
- 라벨은 `lower-kebab-case`만 사용한다.
- 한 티켓에 같은 축(axis)의 라벨을 중복 부여하지 않는다.

### 2.2 필수 축 (모든 BK 티켓)
- `repo` 축:
  - FE 전용: `repo-fe`
  - BE 전용: `repo-be`
  - FE+BE: `repo-fe`, `repo-be`를 모두 부여
- `stage` 축: `stage-s0` ~ `stage-s8` 중 정확히 1개
- `temp id` 축: `temp-bk-###` 1개 (Epic은 `temp-ep-###`)
- `seed` 축: 백로그 시드 기반 티켓은 `backlog-seed` 유지
- `domain` 축: 최소 1개 이상 (예: `auth`, `assets`, `reservations`, `payments`, `ops`, `qa`)

### 2.3 권장 도메인 라벨 목록
- 현재 `planning/07_jira_backlog_seed.csv`에서 사용 중인 도메인 라벨:
  - `action-items`, `action-required`, `api-client`, `api-v2`, `assets`, `auth`, `backend`, `backup`, `canary`, `common`, `company`, `context`, `contract`, `dashboard`, `db`, `device-installation`, `disaster-recovery`, `e2e`, `epic`, `error`, `frontend`, `hardening`, `home`, `integration`, `jira`, `load-test`, `migration`, `mock-removal`, `monitoring`, `observability`, `ocr`, `openapi`, `operations`, `ops`, `payments`, `performance`, `premium`, `qa`, `rbac`, `release`, `reservations`, `revenue`, `rollback`, `routing`, `security`, `settings`, `staging`, `state-machine`, `support`, `tenant`, `terminal-requests`, `tests`, `uploads`, `ux`

## 3. Component 규칙
- 표준 컴포넌트 세트: `frontend`, `backend`, `integration`, `qa`, `ops`
- Repo 기준 기본 매핑:
  - FE 전용: `frontend`
  - BE 전용: `backend`
  - FE+BE: `frontend`, `backend` (+ 경계 계약 작업이면 `integration`)
  - QA/릴리즈 중심: `qa`
  - 운영/고객센터/OCR/장착: `ops`
- 2026-02-25 기준 `SCRUM` 프로젝트 컴포넌트는 비어 있으므로, 컴포넌트 필드가 준비되기 전까지 동일 의미를 라벨로 유지한다.
- 컴포넌트가 생성되면 신규 티켓부터 필수 적용하고, 기존 시드 티켓은 그루밍 시 순차 보정한다.

## 4. DoR (Definition of Ready)
`Backlog -> 진행 중` 전환 전 아래 항목이 모두 충족되어야 한다.

- Summary가 `"[BK-###] ..."` 패턴을 따른다.
- Epic(parent) 링크가 설정되어 있다.
- Description에 최소 항목이 채워져 있다:
  - `Temp ID`, `Epic Temp ID`, `Repo`, `Stage`, `Depends On`, `AC`, `Source`
- Priority가 설정되어 있다.
- Label 필수 축(`repo`, `stage`, `temp id`)이 누락 없이 부여되어 있다.
- `Depends On`이 Jira 이슈 링크로 변환되어 있다.

## 5. DoD (Definition of Done)
`진행 중 -> 완료` 전환 전 아래 항목이 모두 충족되어야 한다.

- AC(완료 기준)가 충족되었고 검증 근거(문서/PR/테스트 결과)가 남아 있다.
- 변경 사항에 대한 검증 명령과 결과가 기록되어 있다.
- 후속 작업이 필요한 경우 별도 티켓으로 분리되어 링크되어 있다.
- 치명/높음 수준 미해결 블로커가 없다.

## 6. Depends On 표기 및 Jira 링크 방향

### 6.1 문서 표기 규칙
- `planning/06_jira_backlog_breakdown.md`의 `Depends On`은 `BK-001,BK-002` 형태로 표기한다.
- `planning/07_jira_backlog_seed.csv`의 `Depends On`은 `BK-001;BK-002` 형태로 표기한다.

### 6.2 Jira 링크 변환 규칙
- 의미: `A Depends On B`이면, Jira에서는 `B blocks A`가 되어야 한다.
- 즉, A 이슈 화면 기준으로 `is blocked by B`가 보여야 올바른 방향이다.
- 등록 후 반드시 링크 방향을 샘플 검증한다 (`A blocks B`로 역전되면 안 됨).

### 6.3 예시
- 표기: `BK-031 Depends On BK-021,BK-030`
- 링크:
  - `BK-021 blocks BK-031`
  - `BK-030 blocks BK-031`
