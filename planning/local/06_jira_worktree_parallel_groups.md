# Jira Worktree 병렬 작업 범위 분류 (선후 순서 반영)

## 기준
- FE Repo: `pangea-front`
- BE Repo: `_legacy/Project_Prometheus_BE`
- 아래 순서는 `planning/06_jira_backlog_breakdown.md`의 `Depends On` 기준
- **볼드** 의존 티켓 = 다른 팀(BE↔FE) 크로스 의존 → 팀 간 동기화 필요
- 상태 체크 기준: Jira `SCRUM` 프로젝트 조회 결과 (2026-02-26)
- 본 문서의 "신규 티켓"은 `SCRUM-78`, `SCRUM-79`, `SCRUM-80`을 의미

## 전체 진행 순서도

```
┌──────────────── 초반 셋업 + 신규 티켓 트랙 ────────────────┐
│                                                          │
│  G0 BK-001 용어집                                        │
│    ├── G1 BK-003 Jira 규칙  (공통)                       │
│    ├── BE B0 → B1 → B2 → B3  (BE Worktree)              │
│    │     └── D0 SCRUM-79 OpenAPI canonical 문서화       │
│    │          └── D1 SCRUM-80 FE 사본 제거 (after D0)   │
│    ├── FE F0 → F1 → F2 → F3  (FE Worktree)              │
│    │     └── H0 SCRUM-78 CompanyContext 저장 실패 버그   │
│    └── ↕ 크로스 의존 ↕                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
                       │
          BE B3 완료(BK-090) + FE F3 완료(BK-091)
                       ▼
┌─────────────────── 후반 릴리즈 ─────────────────┐
│                                                  │
│  G2 BK-092 보안 회귀                             │
│    → G3 BK-093 스테이징 리허설                    │
│      → G4 BK-094 릴리즈 + BK-096 부하테스트      │
│        → G5 BK-095 관측성                        │
│          → G6 BK-099 릴리즈 자동화               │
│                                                  │
│  (BE B4 BK-098 백업리허설은 G3 이후 병렬 진행)    │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 실행 순서 (토폴로지 정렬)

> 같은 Step 안의 티켓은 모두 **병렬 진행 가능**.
> 다음 Step은 선행 의존이 모두 완료된 후 착수.
> `[공통]` `[BE]` `[FE]` 로 담당 구분. **볼드** = 크로스팀 의존.
> `⏸` = 같은 병렬 그룹 구분선. 그룹 내 티켓은 **동일 선행 의존** → 동시 착수 가능.

## Jira 상태 스냅샷 (2026-02-26)
- 완료: BK-001(SCRUM-22), BK-002(SCRUM-23), BK-003(SCRUM-24), BK-010(SCRUM-25), BK-011(SCRUM-26), BK-012(SCRUM-27), BK-013(SCRUM-28), BK-020(SCRUM-29), BK-021(SCRUM-30), BK-022(SCRUM-32), BK-023(SCRUM-31), BK-030(SCRUM-33), BK-072(SCRUM-54), BK-080(SCRUM-59), SCRUM-78, SCRUM-79, SCRUM-80
- 진행 중: 없음 (완료 외 이슈는 대부분 `To-do`)
- 신규(비-BK): `SCRUM-78`, `SCRUM-79`, `SCRUM-80` (모두 완료)

### Step 0 — 시작점
- [x] `[공통]` BK-001 (SCRUM-22) FE/BE 공통 용어집 확정 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-22))

### Step 1 — BK-001 이후 (병렬)
> ┌ 병렬 그룹 ── after BK-001
- [x] `[BE]` BK-002 (SCRUM-23) OpenAPI v2 초안 작성 (after BK-001) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-23))
- [x] `[공통]` BK-003 (SCRUM-24) Jira 운영 규칙 확정 (after BK-001) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-24))
> └

### Step 2 — BK-002 이후 (병렬)
> ┌ 병렬 그룹 ── after BK-002
- [x] `[BE]` BK-010 (SCRUM-25) `/api/v2` 라우팅 스켈레톤 추가 (after BK-002) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-25))
- [x] `[FE]` BK-020 (SCRUM-29) 공통 API 클라이언트 구축 (after **BK-002**) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-29))
> └

### Step 3 — BE 플랫폼 + FE 기반 (병렬, 일부 완료)
> ┌ BE 병렬 그룹 ── after BK-010
- [x] `[BE]` BK-011 (SCRUM-26) 공통 응답/에러 포맷 통일 (after BK-010) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-26))
- [x] `[BE]` BK-012 (SCRUM-27) v2 인증 + tenant guard 적용 (after BK-010) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-27))
- [x] `[BE]` BK-013 (SCRUM-28) 신규 컬렉션/인덱스 마이그레이션 (after BK-010) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-28))
> └
> ┌ FE 병렬 그룹 ── after BK-020
- [x] `[FE]` BK-022 (SCRUM-32) CompanyContext 도입 (after BK-020) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-32))
- [x] `[FE]` BK-023 (SCRUM-31) 공통 loading/error/empty UI (after BK-020) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-31))
> └

### Step 3.5 — 신규 티켓 트랙 (2026-02-26 추가, 병렬)
> ┌ FE 버그 그룹 ── after BK-022
- [x] `[FE]` SCRUM-78 CompanyContext 저장 실패 시 성공 알림 노출 버그 수정 (relates BK-022) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-78))
> └
> ┌ OpenAPI 문서 그룹 ── relates BK-011
- [x] `[BE]` SCRUM-79 BE OpenAPI v2 source-of-truth 정책 문서화 (relates BK-011) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-79))
- [x] `[FE]` SCRUM-80 FE OpenAPI v2 사본 제거 + canonical 링크 문서화 (after SCRUM-79, relates BK-011) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-80))
> └

### Step 4 — 도메인 API 1차 + FE 인증 기반 (병렬, 대량)
> ┌ FE 그룹 ── after BK-020 + **BK-012**
- [x] `[FE]` BK-021 (SCRUM-30) AuthContext JWT 기반 교체 (after BK-020, **BK-012**) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-30))
> └
> ┌ BE 그룹 A ── after BK-011 + BK-012
- [x] `[BE]` BK-030 (SCRUM-33) v2 auth API(login/me/logout) 구현 (after BK-011, BK-012) ⟵ 인증 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-33))
- [x] `[BE]` BK-072 (SCRUM-54) company/geofences/members v2 정리 (after BK-011, BK-012) ⟵ 설정 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-54))
- [x] `[BE]` BK-080 (SCRUM-59) v2 업로드 서명/세션 API 안정화 (after BK-011, BK-012) ⟵ 업로드 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-59))
> └
> ┌ BE 그룹 B ── after BK-011 only
- [ ] `[BE]` BK-082 (SCRUM-61) terminal-requests API 정리 (after BK-011) ⟵ 장착 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-61))
- [ ] `[BE]` BK-083 (SCRUM-62) support-tickets API 정리 (after BK-011) ⟵ 고객센터 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-62))
> └
> ┌ BE 그룹 C ── after BK-011 + BK-013
- [ ] `[BE]` BK-040 (SCRUM-36) v2 assets 조회 API (after BK-011, BK-013) ⟵ 자산 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-36))
- [ ] `[BE]` BK-050 (SCRUM-42) v2 reservations 조회/쓰기 API (after BK-011, BK-013) ⟵ 예약 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-42))
- [ ] `[BE]` BK-060 (SCRUM-46) payments API (after BK-011, BK-013) ⟵ 결제 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-46))
- [ ] `[BE]` BK-061 (SCRUM-47) action-items API (after BK-011, BK-013) ⟵ 조치 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-47))
- [ ] `[BE]` BK-084 (SCRUM-63) device-installations API (after BK-011, BK-013) ⟵ 장착작업 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-63))
> └

### Step 5 — 도메인 확장 + FE 인증 진입 (병렬)
> ┌ FE 그룹 A ── after BK-021 + **BK-030**
- [ ] `[FE]` BK-031 (SCRUM-34) 로그인/보호 라우트 연동 (after BK-021, **BK-030**) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-34))
> └
> ┌ FE 그룹 B ── after **BK-061** + **BK-060**
- [ ] `[FE]` BK-062 (SCRUM-48) ActionRequired 조회 연동 (after **BK-061**, **BK-060**) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-48))
> └
> ┌ FE 그룹 C ── after **BK-072** + BK-022
- [ ] `[FE]` BK-075 (SCRUM-57) Settings API 연동 (after **BK-072**, BK-022) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-57))
> └
> ┌ BE 그룹 A ── 각각 단일 의존 (독립)
- [ ] `[BE]` BK-041 (SCRUM-37) v2 assets 쓰기 API (after BK-040) ⟵ 자산 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-37))
- [ ] `[BE]` BK-051 (SCRUM-41) 계약 상태전환 API (after BK-050) ⟵ 예약 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-41))
- [ ] `[BE]` BK-081 (SCRUM-60) v2 OCR 추출 어댑터 (after BK-080) ⟵ OCR ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-60))
- [ ] `[BE]` BK-090 (SCRUM-68) BE API 통합 테스트 보강 (after BK-084) ⟵ QA ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-68))
> └
> ┌ BE 그룹 B ── after BK-060 + BK-061 + BK-050 (집계)
- [ ] `[BE]` BK-070 (SCRUM-51) 홈 집계 API (after BK-060, BK-061, BK-050) ⟵ 홈 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-51))
- [ ] `[BE]` BK-071 (SCRUM-53) 매출 집계 API (after BK-060, BK-050) ⟵ 매출 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-53))
> └
> ┌ BE 그룹 C ── after BK-012 + BK-080
- [ ] `[BE]` BK-097 (SCRUM-75) 보안 하드닝 (after BK-012, BK-080) ⟵ 보안 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-75))
> └

### Step 6 — FE 도메인 읽기/쓰기 1차 (병렬)
> ┌ FE 그룹 A ── after BK-031 (인증 완료 후)
- [ ] `[FE]` BK-032 (SCRUM-35) 로그아웃/만료 처리 UX 정리 (after BK-031) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-35))
- [ ] `[FE]` BK-042 (SCRUM-38) Assets 페이지 조회 연동 (after **BK-040**, BK-031) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-38))
- [ ] `[FE]` BK-052 (SCRUM-43) Reservations 조회 연동 (after **BK-050**, BK-031) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-43))
- [ ] `[FE]` BK-076 (SCRUM-58) 역할 기반 메뉴/권한 하드닝 (after BK-031, BK-075) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-58))
- [ ] `[FE]` BK-087 (SCRUM-66) 고객센터 UI/연동 추가 (after **BK-083**, BK-031) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-66))
- [ ] `[FE]` BK-088 (SCRUM-67) DeviceInstallation 서버 연동 (after **BK-084**, BK-031) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-67))
> └
> ┌ FE 그룹 B ── after BK-062
- [ ] `[FE]` BK-063 (SCRUM-49) ActionRequired 쓰기 연동 (after BK-062) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-49))
> └
> ┌ FE 그룹 C ── after **BK-071**
- [ ] `[FE]` BK-074 (SCRUM-56) Revenue API 연동 (after **BK-071**) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-56))
> └

### Step 7 — FE 도메인 완성 (병렬)
> ┌ FE 그룹 ── 각각 독립 (서로 다른 의존)
- [ ] `[FE]` BK-043 (SCRUM-39) Assets 수정/등록 연동 (after **BK-041**, BK-042) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-39))
- [ ] `[FE]` BK-053 (SCRUM-44) Reservations 쓰기 연동 (after BK-052, **BK-051**) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-44))
- [ ] `[FE]` BK-091 (SCRUM-69) FE E2E 테스트 보강 (after BK-088) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-69))
> └

### Step 8 — Mock 제거 + 통합 + 보안 회귀 (병렬)
> ┌ FE 그룹 A ── 각각 독립 mock 제거
- [ ] `[FE]` BK-044 (SCRUM-40) Assets mock 제거 (after BK-043) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-40))
- [ ] `[FE]` BK-054 (SCRUM-45) Reservations mock 제거 (after BK-053) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-45))
> └
> ┌ FE 그룹 B ── 크로스 도메인 통합
- [ ] `[FE]` BK-064 (SCRUM-50) 결제상태 연동 통합 (after **BK-060**, BK-053, BK-062) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-50))
- [ ] `[FE]` BK-085 (SCRUM-64) OCR 플로우 연동 (after **BK-081**, BK-043, BK-053) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-64))
> └
> ┌ 공통 ── after **BK-090** + **BK-091** (BE/FE 테스트 모두 완료)
- [ ] `[공통]` BK-092 (SCRUM-70) 테넌시/권한 보안 회귀 (after **BK-090**, **BK-091**) ← G2 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-70))
> └

### Step 9 — 최종 통합 + 스테이징 (병렬)
> ┌ FE 그룹 ── after BK-064
- [ ] `[FE]` BK-065 (SCRUM-52) Action/Payment mock 제거 (after BK-064) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-52))
- [ ] `[FE]` BK-073 (SCRUM-55) Home API 연동 (after **BK-070**, BK-064) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-55))
> └
> ┌ 공통 ── after BK-092
- [ ] `[공통]` BK-093 (SCRUM-72) 스테이징 리허설 + 마이그레이션 드라이런 (after BK-092) ← G3 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-72))
> └

### Step 10 — 릴리즈 준비 (병렬)
> ┌ 병렬 그룹 ── after BK-093
- [ ] `[FE]` BK-086 (SCRUM-65) Premium CTA → 장착신청 연동 (after **BK-082**, BK-073) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-65))
- [ ] `[공통]` BK-094 (SCRUM-71) 릴리즈 체크리스트 + 롤아웃 (after BK-093) ← G4 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-71))
- [ ] `[공통]` BK-096 (SCRUM-74) 성능/부하 테스트 및 튜닝 (after BK-093) ← G4 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-74))
- [ ] `[BE]` BK-098 (SCRUM-76) 백업/복구 리허설 (after BK-093) ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-76))
> └

### Step 11 — 관측성
- [ ] `[공통]` BK-095 (SCRUM-73) 운영 관측성 구축 (after BK-094) ← G5 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-73))

### Step 12 — 릴리즈 자동화
- [ ] `[공통]` BK-099 (SCRUM-77) 릴리즈 전략(canary/rollback) 자동화 (after BK-094, BK-095) ← G6 ([Jira](https://pangea-autos.atlassian.net/browse/SCRUM-77))
