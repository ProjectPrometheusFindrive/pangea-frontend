# SCRUM-64 BK-085 OCR Flow Integration (Assets New Contract)

- Date: 2026-02-26 22:24
- Author: Codex (GPT-5)
- Branch: feat/SCRUM-64-bk-085-ocr-flow-assets-contract
- Tags: scrum-64,bk-085,assets,ocr,upload,polling,fallback

## Start Context
- Start Prompt 기준으로 `dev` 기반 worktree(`../SCRUM-64-bk-085-ocr-flow-assets-contract`)에서 작업했다.
- Jira `SCRUM-64`는 `진행 중` 상태였고, 구현 계획 코멘트를 먼저 남긴 뒤 작업을 진행했다.
- AC 핵심:
  - `POST /api/v2/ocr/extract`, `GET /api/v2/ocr/jobs/{jobId}`, `POST /api/v2/assets` 연동
  - 업로드 후 parsing 상태 표시, OCR 제안값 prefill, 수정 후 저장(saving/success)
  - OCR 실패/타임아웃 시 수동 입력 fallback, `400/413` 파일 오류 안내, `5xx` 재시도
  - partial 결과 처리, 재업로드 시 이전 OCR 제안 폐기, 느린 OCR polling 중 이탈/복귀 처리

## Changes Summary
- OCR/업로드 서비스 계층 신규 추가:
  - `src/services/assetOcr.ts`에 `assets/upload` 서명 요청, signed URL PUT 업로드, OCR extract/job polling API 래퍼를 구현했다.
  - v2 `status: success` envelope와 일반 payload를 모두 파싱하도록 처리하고, 업로드 응답 필수 필드 검증을 추가했다.
- Assets 신규 등록 모달 OCR 흐름을 실제 API 기반으로 교체:
  - 기존 `setTimeout` 더미 prefill 제거.
  - `문서 업로드 -> upload sign -> PUT 업로드 -> OCR job submit -> polling -> prefill` 흐름으로 교체.
  - 처리중 단계에서 진행 메시지 노출 및 수동 입력 전환 버튼을 추가했다.
- AC 분기/예외 처리 보강:
  - partial 추출은 가능한 필드만 폼에 반영하고 나머지는 수동 입력 가능하게 유지.
  - 재업로드 시 기존 OCR 제안 상태를 초기화하고, 기존 OCR로 채워진 값은 조건부로 정리해 이전 결과를 폐기.
  - 필수 문서 OCR 실패 시 preview 단계(수동 입력)로 fallback.
  - 파일 형식/크기(`400/413/415`), rate limit(`429`), 서버/타임아웃(`5xx/504`) 메시지 분기와 재시도 가능 상태를 반영.
  - 탭 비가시 상태(`document.visibilityState=hidden`)에서도 polling 간격을 조정해 복귀 시 상태 확인이 이어지도록 처리.

## Diffs & Files
- `src/services/assetOcr.ts` (new)
  - `signAssetUpload`, `uploadFileToSignedUrl`, `submitOcrExtractJob`, `getOcrExtractJob` 추가.
- `src/app/pages/Assets.tsx`
  - OCR 상태/오류/경고/제안 상태 추가.
  - OCR job polling 및 abort-safe request sequencing 적용.
  - 업로드 단계 UI에서 `OCR 추출 시작`을 명시적으로 실행하도록 변경.
  - processing/preview 단계에 수동 fallback, 재시도, 경고/요약 UI 추가.
- `docs/prompt_library/prompt_library_v1.md`
  - v1.2.25로 갱신 및 BK-085 OCR 증빙 규칙 추가.

## Validation
```bash
npm run build
# 초기 실패: vite not found (dependencies 미설치)

npm install
# 설치 완료 (react-router engine warning only)

npm run build
# vite build 성공
# large chunk warning only

npm run
# scripts: build, dev (lint/test 미제공)
```

## Notes
- 현재 저장 API는 BK-043 경로(`POST /api/v2/assets`)를 재사용하며, OCR 추출값은 저장 전 사용자가 preview 폼에서 최종 확인/수정 가능하다.
- `lint`/`test` 스크립트가 없어 build 기반 검증으로 완료했다.
