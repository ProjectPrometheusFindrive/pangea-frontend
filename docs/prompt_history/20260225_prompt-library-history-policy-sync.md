# Prompt Library History Policy Sync

- Date: 2026-02-25 19:45 KST
- Author: Codex
- Branch: feat/20260225-initial-setup-bootstrap
- Tags: prompt-library,prompt-history,version-policy,commit-policy

## Prompt
- 목적: prompt_library 및 prompt_history 문서화
- 금지: `git push` 실행
- 추가 제약: `push/tag/rebase/reset` 금지, `prompt_library_v1.md` 누적 업데이트, 신규 버전 파일 생성 금지

## Assumptions
- 브랜치 운영 기준은 `dev` 통합, `production` 배포이며 `main`은 사용하지 않는다.
- 본 작업은 문서 범위(`docs/prompt_library`, `docs/prompt_history`)로 제한한다.
- 워킹트리의 다른 변경은 유지하고, 이번 커밋에는 대상 문서만 포함한다.

## Plan
- `prompt_library_v1.md` 현재 구조/버전 확인
- 버전 정책 및 히스토리 네이밍/커밋 규칙 섹션 추가
- Version/Date/Version History 갱신
- 템플릿 기반 신규 `prompt_history` 파일 작성
- 대상 파일만 스테이징 후 규칙에 맞는 커밋 수행

## Changes Summary
- `prompt_library_v1.md`에 `Documentation Scope`, `Version Policy` 섹션을 추가해 버전 업 기준을 명시했다.
- `Prompt History Naming Rules`, `End-of-Task Checklist`를 추가해 기록 파일 규칙과 종료 절차를 표준화했다.
- `Commit Message Convention`을 추가해 Subject/Body 작성 규칙과 금지 동작(`push/tag/rebase/reset`)을 고정했다.
- 구조적 섹션 추가에 따라 버전을 `v1.0.0 -> v1.1.0`으로 상향하고 Version History를 갱신했다.
- 본 작업 이력을 `prompt_history`에 신규 파일로 기록해 추적 가능성을 확보했다.

## Affected Files
- `docs/prompt_library/prompt_library_v1.md`: 버전 정책/이력 규칙/커밋 규칙 섹션 추가 및 메타데이터 갱신
- `docs/prompt_history/20260225_prompt-library-history-policy-sync.md`: 이번 문서화 작업의 프롬프트/가정/계획/변경 요약 기록

## Validation
```bash
rg -n "Version:|Version Policy|Prompt History Naming Rules|Commit Message Convention|Version History" docs/prompt_library/prompt_library_v1.md
ls -1 docs/prompt_history/20260225_prompt-library-history-policy-sync.md
```

## Diffs (optional)
```diff
+ Add Version Policy table
+ Add Prompt History Naming Rules
+ Add Commit Message Convention
```

## Commands Used (optional)
```bash
git status --short
nl -ba docs/prompt_library/prompt_library_v1.md
nl -ba docs/prompt_history/_TEMPLATE.md
date +%Y%m%d
```

## Notes/Follow-ups
- 다음 변경부터는 해당 변경 범위에 맞게 patch/minor/major 규칙을 동일하게 적용한다.
- 배포가 필요하면 코드 리뷰 완료 후 `dev -> production` PR로만 진행한다.
