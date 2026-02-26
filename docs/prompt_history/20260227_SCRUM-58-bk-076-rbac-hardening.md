# SCRUM-58 BK-076 역할 기반 메뉴/권한 하드닝

- Date: 2026-02-27 08:06 KST
- Author: Codex (GPT-5)
- Branch: fix/SCRUM-58-bk-076-rbac-hardening
- Tags: scrum-58,bk-076,rbac,permissions,menu-guard,route-guard,action-guard,deny-by-default

## Start Context
- Ticket: `SCRUM-58` (`[BK-076] 역할 기반 메뉴-권한 하드닝`)
- Jira AC 핵심:
  - `/api/v2/auth/me`, `/api/v2/permissions/me` 기준으로 메뉴/라우트 접근을 제어
  - 권한 없는 메뉴 숨김/비활성 + 직접 URL 접근 시 `403` 화면
  - 권한 API `401/403/5xx` 분기 정책 정합 (`401` 세션 정책, `403` 접근불가, `5xx` deny-by-default)
  - 로그인 후 역할 변경 반영, 권한 캐시 만료 처리, 테넌트 전환 시 메뉴 재계산
- 작업 제약:
  - `dev` 기준 worktree 분리(`fix/SCRUM-58-bk-076-rbac-hardening`)
  - Jira 상태 `진행 중` 확인 및 구현 계획 코멘트 기록
  - 최소 `npm run build` 검증

## Changes Summary
- 권한 모델을 단일화했다.
  - `src/app/authorization.ts` 신설: 메뉴/라우트/액션 권한 키 정의(`route.*`, `action.*`), role fallback 권한 매트릭스, `/permissions/me` payload 파서, 경로별 권한 매핑 유틸 추가.
  - `src/services/permissions.ts` 신설: `GET /api/v2/permissions/me` 클라이언트 추가.
- 인증/권한 상태를 분리해 하드닝했다.
  - `src/app/context/AuthorizationContext.tsx` 신설:
    - 권한 조회 + 캐시(`pangea.authorization.v1`) + TTL(5분) 처리
    - `401` 시 세션 재검증(`refreshSession`), `403`/`5xx`/network 시 deny-by-default
    - `404/405` 및 계약 미배포 케이스는 role fallback 적용
    - window focus/visibility 기반 재검증으로 role/tenant 변경 반영 강화
  - `src/app/App.tsx`: `AuthorizationProvider`를 전역에 주입.
  - `src/services/auth.ts`: 미확인 role 기본 허용 제거(`toViewRole` -> unknown role은 `null`).
- 메뉴/라우트 일관성을 맞췄다.
  - `src/app/components/RequireAuth.tsx`:
    - 인증 확인과 별도로 권한 확인 단계 추가
    - 현재 경로 기반 권한 체크 실패 시 `/forbidden` 전환
  - `src/app/components/Layout.tsx`:
    - 기존 role 기반 사이드바 필터를 route permission 기반으로 교체
    - 알림 클릭/전체 알림 이동 시 경로 권한 가드 적용
- 액션 권한을 주요 화면에 일관 적용했다.
  - `src/app/pages/Assets.tsx` + `VehicleDetailModal.tsx`:
    - 자산 생성/수정/OCR 실행 시 권한 가드
    - 수정 폼 read-only/저장 버튼 비활성 상태 반영
  - `src/app/pages/Reservations.tsx`:
    - 예약 생성/반납/사고 등록 액션 권한 가드
    - 액션 버튼(`자산 상세`, `조치항목`)의 route 권한 가드
  - `src/app/pages/ActionRequired.tsx`:
    - 상태 저장/메모 저장/해결 처리 액션 권한 가드
    - 관련 자산/예약 이동 액션에 route 권한 가드
  - `src/app/pages/Settings.tsx`:
    - 기존 `user.role` 분기 제거, 액션 권한 키 기반으로 편집/멤버 권한 변경 분리 적용
  - `src/app/pages/DeviceInstallation.tsx`:
    - 장착 신청/취소 액션 권한 가드 및 입력 컨트롤 비활성화
  - `src/app/pages/Home.tsx`:
    - 대시보드 카드 이동 액션에 route 권한 가드 적용

## Diffs & Files
- `src/app/authorization.ts` (new)
  - 권한 키/role fallback/permissions payload 파서/경로 권한 매핑 유틸 추가
- `src/services/permissions.ts` (new)
  - `GET /api/v2/permissions/me` API wrapper 추가
- `src/app/context/AuthorizationContext.tsx` (new)
  - 권한 조회, 캐시 TTL, 401/403/5xx 분기, deny-by-default, focus 재검증 구현
- `src/app/App.tsx`
  - `AuthorizationProvider` 주입
- `src/services/auth.ts`
  - unknown role permissive fallback 제거
- `src/app/components/RequireAuth.tsx`
  - 경로 권한 체크 통합
- `src/app/components/Layout.tsx`
  - 메뉴 권한 필터 + 알림 이동 가드
- `src/app/components/VehicleDetailModal.tsx`
  - 자산 수정 read-only 상태 지원
- `src/app/pages/Home.tsx`
  - 카드 이동 route 권한 가드
- `src/app/pages/Assets.tsx`
  - 자산 생성/수정/OCR 액션 가드
- `src/app/pages/Reservations.tsx`
  - 생성/반납/사고 등록 액션 가드 + 관련 화면 이동 가드
- `src/app/pages/ActionRequired.tsx`
  - 상태/메모/해결 액션 가드 + 관련 화면 이동 가드
- `src/app/pages/Settings.tsx`
  - 설정 편집/멤버 권한 변경을 액션 권한 키로 분리
- `src/app/pages/DeviceInstallation.tsx`
  - 장착 신청/취소 액션 가드
- `docs/prompt_library/prompt_library_v1.md`
  - `v1.2.30` 메타데이터 및 BK-076 증적 규칙 추가
- `docs/prompt_history/20260227_SCRUM-58-bk-076-rbac-hardening.md` (new)
  - 본 작업 이력 기록

## Validation
```bash
npm run build
# 실패: sh: 1: vite: not found

npm install
# 성공: 의존성 설치 완료

npm run build
# 성공: vite production build 완료
```

## Notes
- 현재 `package.json`에는 `lint`, `test` 스크립트가 정의되어 있지 않아 build 외 추가 자동 검증은 수행하지 못했다.
- `permissions/me` 계약이 미배포된 환경에서도 운영 중단을 피하기 위해 `404/405`는 role fallback으로 처리했고, `403/5xx/network`는 deny-by-default를 유지했다.
