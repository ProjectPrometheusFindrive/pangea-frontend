# End Prompt Template Push PR Automation

- Date: 2026-02-25 19:57 KST
- Author: Codex
- Branch: feat/20260225-initial-setup-bootstrap
- Tags: prompt-library,prompt-history,start-prompt,pr-automation

## Prompt
- 목적: prompt_library 및 prompt_history 문서화 + 작업 자동화 (Push & PR)
- Start Prompt 포함 요구: 세션 시작 시 사용한 `start_prompt` 작업분은 `prompt_library`와 분리하여 `prompt_history`에 기록
- 브랜치 정책 핵심(Start Prompt): `dev` 통합, `production` 배포, `main` 미사용, `dev/production` direct push 금지, 태그 수동 생성 금지
- PR 요구: 작업 완료 후 `git push` 및 한글 기반 `PR(base=dev)` 생성

## Assumptions
- 현재 작업 브랜치에서 문서 파일만 수정/커밋한다.
- 기존 워킹트리의 다른 변경사항은 이번 커밋/푸시/PR 범위에서 제외한다.
- 한글 PR 본문은 UTF-8로 작성한다.

## Plan
- `prompt_library_v1.md`에 Start Prompt 이력 분리 규칙 추가
- Git Workflow에 Commit 단계 제약과 Push/PR 단계를 분리해 명시
- 버전 메타데이터 및 Version History 갱신
- 세션 이력 파일 작성 후 대상 파일만 커밋
- 원격 푸시 후 `dev` 대상 한글 PR 생성

## Changes Summary
- `prompt_library_v1.md`를 `v1.2.0`으로 상향하고, Start Prompt 반영 이력을 `prompt_history`에 분리 기록하도록 규칙을 추가했다.
- `User Prompt (canonical)`를 업데이트해 커밋 단계 금지사항과 후속 Push/PR 단계를 명확히 분리했다.
- `Prompt History Capture Rules`를 추가해 Start Prompt 핵심 내용과 반영 결과를 세션 이력에 의무 기록하도록 고정했다.
- `Push & PR Convention`을 추가해 `base=dev`, 한글/UTF-8 PR 작성 규칙을 표준화했다.
- 본 변경을 세션 단위 `prompt_history` 파일로 별도 기록해 라이브러리와 이력의 역할을 분리했다.

## Affected Files
- `docs/prompt_library/prompt_library_v1.md`: v1.2.0 업데이트 및 Start Prompt/Push-PR 규칙 추가
- `docs/prompt_history/20260225_end-prompt-template-push-pr-automation.md`: 세션 이력 기록 추가

## Validation
```bash
rg -n "Version:|Prompt History Capture Rules|Push & PR Convention|Version History" docs/prompt_library/prompt_library_v1.md
ls -1 docs/prompt_history/20260225_end-prompt-template-push-pr-automation.md
```

## Diffs (optional)
```diff
+ Add Prompt History Capture Rules section
+ Add Push & PR Convention section
+ Bump version v1.1.0 -> v1.2.0
```

## Commands Used (optional)
```bash
git status --short
nl -ba docs/prompt_library/prompt_library_v1.md
date '+%Y%m%d %Y-%m-%d %H:%M %Z'
```

## Notes/Follow-ups
- 다음 문서화 작업도 동일하게 Start Prompt 반영분을 `prompt_history`에 분리 기록한다.
- 배포 관련 변경은 코드 리뷰 완료 후 `dev -> production` PR로만 진행한다.
