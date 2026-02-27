# SCRUM-65 Premium CTA 장착신청 연동

- Date: 2026-02-27 10:45 KST
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-65-premium-cta-installation
- Tags: jira,scrum-65,bk-086,frontend,premium,device-installation,integration

## Start Context
- Ticket: `SCRUM-65` (`[BK-086] Premium CTA -> 장착신청 연동`)
- 목표:
  - Premium CTA를 실제 장착신청 API 연동 플로우로 전환
  - CTA -> 신청 폼 -> 제출 중 -> 접수 완료(접수번호/상태) UX 제공
  - 오류 분기(401/403/409/5xx) 및 재시도 처리
  - 중복/진행중 요청 차단 및 새로고침 후 상태 복구
- AC 핵심 엔드포인트:
  - `POST /api/v2/device-installations`
  - `GET /api/v2/device-installations/{installationId}`
  - `GET /api/v2/assets/{assetId}`

## Changes Summary
- `PremiumBanner`의 CTA를 alert 시뮬레이션에서 실제 신청 섹션으로 연결.
- `PremiumInstallationRequestSection` 신규 구현:
  - 차량 선택/자산 상세 prefill(`GET /api/v2/assets/{assetId}`)
  - 신청 제출(`POST /api/v2/device-installations`)
  - 접수번호/상태 표시 및 상태 새로고침(`GET /api/v2/device-installations/{installationId}`)
  - 401/403/409/5xx+네트워크 오류 분기 및 재시도 버튼
  - VIN 기준 진행중 신청 중복 차단 + 제출 연타 방지
  - sessionStorage 기반 접수번호 복구 및 새로고침 시 상태 재조회
  - CTA click / submit / success / fail 이벤트 dispatch 훅 추가
- `deviceInstallations` 서비스에 단건 조회 API 추가 및 fallback 경로 호환.

## Diffs & Files
- `src/app/components/PremiumInstallationRequestSection.tsx`
  - Premium CTA 신청 플로우 전용 UI/상태머신/오류 처리/복구 로직 구현
- `src/app/pages/Assets.tsx`
  - 기존 Premium alert CTA 제거
  - 신청 섹션 컴포넌트 연결
- `src/app/components/PremiumBanner.tsx`
  - 대상 차량 0건일 때 CTA 비활성화 및 안내 문구 처리
- `src/services/deviceInstallations.ts`
  - `getDeviceInstallation(installationId)` 추가
  - canonical 경로 404/405 시 `/tasks/{id}` fallback

## Validation
```bash
npm run build
```

- 결과: 성공 (`vite build` 완료)
- 비고: Node `v18.19.1`에서 `react-router@7.13.0` engine 경고는 있으나 build는 정상 통과

## Notes
- `docs/prompt_library/prompt_library_v1.md`는 프롬프트 정책 변경이 없어 버전 갱신 없이 유지.
