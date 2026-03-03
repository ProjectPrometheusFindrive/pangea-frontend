<!-- markdownlint-disable MD013 MD060 -->

# Notifications QA/Integration Release Scenarios (SCRUM-159)

## 문서 정보

- Ticket: `SCRUM-159`
- 목적: Notifications 기능 릴리즈 전 QA/통합 검증 시나리오와 sign-off 기준 고정
- 마지막 갱신: `2026-03-03`

## 1. 검증 범위

- 역할별 접근 시나리오: `super_admin`, `admin`, `member`
- 핵심 E2E 경로: 이벤트 발생 -> 알림 생성 -> FE 노출(미읽음) -> 읽음 처리
- 예외 케이스: `401/403/404/5xx`, 빈 데이터, tenant mismatch, stale id
- 회귀 검증: 상단 레이아웃(헤더/뱃지/드롭다운) 및 기존 메뉴 네비게이션 영향

## 2. 테스트 데이터/계정 기준

- Tenant A: `super_admin_a`, `admin_a`, `member_a`
- Tenant B: `admin_b`, `member_b` (cross-tenant 검증 전용)
- 이벤트 샘플: `사고 접수`, `도난 의심`, `결제 실패`
- 사전 조건:
  - 인증/권한 API 정상 응답 가능한 환경
  - 대상 이벤트가 알림으로 매핑되는 BE 규칙 배포 상태
  - 테스트 실행 중 tenant 전환 로그를 캡처할 수 있어야 함

## 3. 역할별 기대 동작

| Role | 알림 목록 조회 | 읽음 처리 | tenant 범위 | 비정상 접근 기대 결과 |
| --- | --- | --- | --- | --- |
| `super_admin` | 가능 | 가능 | 현재 선택 tenant 기준만 조회 | 타 tenant 데이터 직접 접근 시 `403` 또는 `404` |
| `admin` | 가능 | 가능 | 본인 tenant 고정 | 타 tenant 데이터 조회/읽음 요청 차단 |
| `member` | 가능 | 가능(본인 권한 범위) | 본인 tenant 고정 | 권한 없는 링크 이동 시 `forbidden` 또는 접근 차단 |

## 4. 핵심 E2E 시나리오

| ID | 시나리오 | 절차(요약) | 기대 결과 |
| --- | --- | --- | --- |
| `NTF-E2E-001` | 이벤트 기반 신규 알림 생성/노출 | 1) 이벤트 발생 2) 알림 UI 열기 3) 미읽음 배지/리스트 확인 | 신규 알림 1건 이상 노출, 미읽음 카운트 증가, 앱 크래시 없음 |
| `NTF-E2E-002` | 단건 읽음 처리 + 링크 이동 | 1) 미읽음 알림 클릭 2) 연결 화면 이동 3) 다시 알림 열기 | 해당 알림 `isRead=true` 상태 반영, 미읽음 카운트 감소, 링크 라우팅 정상 |
| `NTF-E2E-003` | 일괄 읽음 처리 | 1) 미읽음 2건 이상 준비 2) 전체 읽음 실행 | 모든 항목 읽음 상태, 배지 `0`, 중복 클릭/중복 요청 시도에도 상태 일관성 유지 |
| `NTF-E2E-004` | 새로고침 후 상태 일관성 | 1) 읽음/미읽음 상태 혼합 생성 2) 브라우저 새로고침 | 읽음 상태와 카운트가 새로고침 후에도 동일하게 유지 |

## 5. 오류/빈 데이터/tenant 케이스

| ID | 케이스 | 기대 결과 | 심각도 기준 |
| --- | --- | --- | --- |
| `NTF-EDGE-001` | 목록 API 응답 `[]` (빈 데이터) | 빈 상태 UI 노출, 카운트 `0`, 레이아웃 깨짐 없음 | `Normal` |
| `NTF-EDGE-002` | 목록 조회 `401` | 세션 만료 처리(재로그인 유도), 민감 데이터 노출 없음 | `Blocker` |
| `NTF-EDGE-003` | 목록 조회 `403` | 권한 부족 처리, 데이터 미노출, 우회 접근 불가 | `Blocker` |
| `NTF-EDGE-004` | 목록 조회 `404` | 사용자 가이드 메시지 또는 안전한 fallback, 앱 크래시 없음 | `Major` |
| `NTF-EDGE-005` | 목록/읽음 처리 `5xx` 또는 network timeout | 에러 메시지 + 재시도 경로 제공, 무한 로딩 없음 | `Major` |
| `NTF-EDGE-006` | 읽음 처리 대상이 다른 tenant 데이터 | 요청 차단(`403/404`), 카운트/리스트 불일치 미발생 | `Blocker` |
| `NTF-EDGE-007` | stale notification id 읽음 요청(`404`) | UI 상태 롤백 또는 재조회로 일관성 회복 | `Major` |

## 6. 회귀 체크 포인트

- 헤더 알림 버튼/배지 렌더링이 메뉴/프로필 UI를 가리지 않아야 함
- 알림 드롭다운 open/close 동작(outside click 포함)이 기존 네비게이션과 충돌하지 않아야 함
- 알림 링크 이동 후 기존 메뉴 active 상태/route guard 동작이 유지되어야 함
- 기존 핵심 메뉴(`Home`, `Assets`, `Reservations`, `Settings`) 접근성 저하가 없어야 함

## 7. 릴리즈 Sign-off 기준

### 7.1 버그 분류 규칙

- `Blocker`: 보안/권한/tenant 격리 실패, 데이터 누출, 치명적 크래시, 핵심 E2E 경로 중단
- `Major`: 핵심 기능 실패(읽음 처리/카운트 불일치/에러 복구 불가), 사용자 진행 심각 저해
- `Normal`: 우회 가능한 UI/문구/경미한 동작 이슈

### 7.2 릴리즈 게이트

- `Blocker` 미해결 0건
- `Major` 미해결 0건 (예외 승인 시 Jira 링크 + 담당자 + 목표 수정일 필수)
- `NTF-E2E-*` 전 항목 PASS
- `NTF-EDGE-*` 중 `Blocker/Major` 항목 PASS
- QA 실행 증적(스크린샷, 로그, 재현 절차, 테스트 환경/tenant 정보) 첨부 완료

## 8. 실행 결과 기록 템플릿

| 항목 | 결과 | 근거 링크/비고 |
| --- | --- | --- |
| `NTF-E2E-001` | `PASS/FAIL` |  |
| `NTF-E2E-002` | `PASS/FAIL` |  |
| `NTF-E2E-003` | `PASS/FAIL` |  |
| `NTF-E2E-004` | `PASS/FAIL` |  |
| `NTF-EDGE-002` | `PASS/FAIL` |  |
| `NTF-EDGE-003` | `PASS/FAIL` |  |
| `NTF-EDGE-005` | `PASS/FAIL` |  |
| `NTF-EDGE-006` | `PASS/FAIL` |  |
