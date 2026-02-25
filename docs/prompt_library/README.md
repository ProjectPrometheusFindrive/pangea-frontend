# Prompt Library

`docs/prompt_library/`는 반복 사용 가능한 "검증 완료 프롬프트"를 보관하는 공간입니다.
여기에 있는 문서는 작업 재현성과 품질 기준을 맞추기 위한 기준 문서로 사용합니다.

## 언제 등록하나
- 동일/유사 작업에서 2회 이상 재사용 가치가 있을 때
- 결과 품질과 출력 형식이 안정적일 때
- 팀 규칙(코딩 스타일, 검증 절차, 제약사항)이 반영되어 있을 때

## 파일 구성
- `_TEMPLATE.md`: 라이브러리 문서 작성 템플릿
- `{주제}_{버전}.md` 또는 `{YYYYMMDD}_{주제}.md`: 실제 프롬프트 문서

## 파일 네이밍 규칙
- 권장 형식: `{주제}_{버전}.md`
- 대안 형식: `{YYYYMMDD}_{주제}.md`
- 예시:
  - `frontend_bugfix_v1.0.0.md`
  - `20260225_dashboard_data_sync.md`

## 적용 방식
1. 먼저 `docs/prompt_history/`에 작업 단위 기록을 남깁니다.
2. 반복 사용해 검증된 프롬프트를 `docs/prompt_library/`로 승격합니다.
3. 승격 시 버전을 올리고(`v1.0.0 -> v1.1.0`) 변경 이유를 `Version History`에 기록합니다.
4. 이후 유사 작업은 라이브러리 문서를 기준으로 시작합니다.

## 사용 방식
1. `_TEMPLATE.md`를 복사해 새 파일을 만듭니다.
2. `System/Developer/User Prompt`를 실제 운영 가능한 문장으로 채웁니다.
3. `Inputs/Outputs/Usage`를 현재 프로젝트 실행 방식(`npm run dev`, `npm run build`)에 맞게 작성합니다.
4. 프롬프트 변경이 발생하면 버전과 변경 이력을 함께 갱신합니다.

## 빠른 시작 예시
```bash
cp docs/prompt_library/_TEMPLATE.md docs/prompt_library/frontend_bugfix_v1.0.0.md
```
