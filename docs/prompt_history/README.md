# Prompt History Workflow

`docs/prompt_history/`는 "작업 단위 프롬프트 실행 기록"을 남기는 공간입니다.
한 작업(또는 이슈)마다 Markdown 파일 1개를 생성해, 프롬프트부터 결과까지 추적 가능하게 관리합니다.

## 목적
- 어떤 프롬프트로 어떤 변경이 발생했는지 추적
- 코드 리뷰/회고 시 의사결정 근거 확보
- 반복되는 패턴을 `prompt_library`로 승격하기 위한 원본 데이터 축적

## 파일 네이밍 규칙
- `{YYYYMMDD}_{작업-요약}.md`
- 예시:
  - `20260225_header_layout_fix.md`
  - `20260225_reservation_filter_refactor.md`

## 작성 순서
1. 작업 시작 전에 `_TEMPLATE.md`를 복사해 파일을 만듭니다.
2. `Prompt`, `Assumptions`, `Plan`을 먼저 채웁니다.
3. 구현 후 `Changes Summary`, `Affected Files`, `Validation`을 업데이트합니다.
4. 후속 작업이 있으면 `Notes/Follow-ups`에 남깁니다.
5. 재사용 가치가 높아지면 `docs/prompt_library/` 문서로 승격합니다.

## 적용 방식
- 모든 기능 수정/버그 수정/리팩터링 작업에 대해 1개 기록 파일 생성
- PR 또는 커밋 메시지에 해당 기록 파일명을 함께 언급
- 코드 변경과 기록 문서를 같은 변경 단위로 관리

## 사용 방식 예시
```bash
cp docs/prompt_history/_TEMPLATE.md docs/prompt_history/$(date +%Y%m%d)_your_task.md
```
