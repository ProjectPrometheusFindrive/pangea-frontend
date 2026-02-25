# Prompt Library v1

- Version: v1.0.0
- Date: 2026-02-25
- Owner: Pangea Frontend Team
- Tags: prompt-library,workflow,bootstrap,branch-policy

## Context
- 초기 세팅 작업에서 프롬프트 템플릿, 브랜치 정책, 문서화 절차를 반복 가능하게 표준화할 필요가 있음.

## Goal
- Start/End Prompt를 기준으로 작업 재현성 확보.
- `dev -> production` 브랜치 운영 정책과 문서화 규칙을 일관되게 적용.
- 작업 기록(`prompt_history`)과 재사용 템플릿(`prompt_library`)의 연결 고정.

## System Prompt
```text
Follow repository AGENTS.md and keep changes minimal and precise.
Do not run destructive git commands. Respect branch policy: dev for integration, production for release.
```

## Developer Prompt (optional)
```text
Use rg for impact search.
Create a short execution plan before substantial edits.
For API changes, update docs/ together with code.
```

## User Prompt (canonical)
```text
Start Prompt:
- Base branch: dev
- Work only through PR into dev
- Do not use main branch

End Prompt:
- Update docs/prompt_library/prompt_library_v1.md version metadata
- Add docs/prompt_history/{YYYYMMDD}_{task}.md from template
- No push/tag/rebase/reset
```

## Inputs
- 작업 목표 한 줄
- 브랜치 네이밍 slug
- 변경 파일 목록
- 검증 명령 결과

## Outputs
- 업데이트된 `prompt_library_v1.md`
- 신규 `prompt_history` 기록 파일 1개
- 변경 요약(섹션 영향, 의도, 기대 효과)

## Usage
```bash
cp docs/prompt_history/_TEMPLATE.md docs/prompt_history/$(date +%Y%m%d)_your-task.md
# 작업 종료 시 prompt_library_v1.md Version/Date/Version History 갱신
```

## Dependencies & Assumptions
- Default branch: `dev`
- Release branch: `production`
- `main` branch is not used
- `dev`/`production` protected (PR + review required)
- Production push triggers auto tag (`vX.Y.Z`)

## Version History
- v1.0.0 (2026-02-25): Initial baseline for prompt library + history workflow and branch policy alignment.
