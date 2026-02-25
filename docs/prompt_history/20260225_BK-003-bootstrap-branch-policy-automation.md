# BK-003 Bootstrap Branch Policy Automation

- Date: 2026-02-25 20:00 KST
- Author: Codex
- Branch: feat/20260225-initial-setup-bootstrap
- Tags: BK-003,bootstrap,branch-policy,prompt-library,prompt-history,pr-automation

## Start Context
- Start Prompt 목표: 프롬프트 라이브러리/히스토리 템플릿, 브랜치 정책(`dev -> production`, `main` 미사용), 초기 세팅 산출물 정리.
- Jira 주요 요구사항(BK-003): Jira 운영 규칙 및 작업 산출물 문서화 표준을 명확히 하고 재사용 가능한 형태로 남긴다.
- 종료 조건: 문서 표준화, 변경사항 커밋, 원격 푸시, `dev` 대상 PR 생성.

## Prompt
End Prompt 규칙에 따라 `prompt_library`/`prompt_history` 문서를 갱신하고, 커밋 후 `dev` 대상 PR까지 자동화.

## Assumptions
- 기본 브랜치 `dev`, 배포 브랜치 `production`, `main` 미사용 정책이 확정되어 있음.
- `dev`/`production` 보호 규칙이 적용되어 direct push 불가.
- `production` 반영 시 태그 자동 생성 워크플로를 사용함.

## Plan
- 남은 변경 파일 점검
- `prompt_library_v1.md` 버전 및 규칙 업데이트
- 티켓 포함 네이밍 규칙의 `prompt_history` 파일 추가
- 전체 변경 커밋
- 원격 푸시 및 `dev` 대상 PR 생성

## Changes Summary
- `prompt_library_v1.md`를 `v1.2.1`로 갱신하고, `prompt_history` 파일명을 `{YYYYMMDD}_{TICKET-ID}-{slug}.md`로 명시해 Jira 추적성을 강화했다.
- 브랜치 정책 관련 문서(`AGENTS.md`, `README.md`)와 자동 태깅 워크플로(`production-auto-tag.yml`)를 커밋 대상에 포함해 초기 세팅 산출물을 정리했다.
- `.gitignore`에 venv/pycache 무시 규칙을 추가해 대량 노이즈 파일 유입을 방지했다.
- `prompt_library`/`prompt_history` 템플릿 및 안내 문서를 함께 반영해 문서화 워크플로를 저장소에 정착시켰다.

## Diffs & Files
- `docs/prompt_library/prompt_library_v1.md`
- `docs/prompt_history/20260225_BK-003-bootstrap-branch-policy-automation.md`
- `docs/prompt_library/README.md`
- `docs/prompt_library/_TEMPLATE.md`
- `docs/prompt_history/README.md`
- `docs/prompt_history/_TEMPLATE.md`
- `AGENTS.md`
- `README.md`
- `.gitignore`
- `.github/workflows/production-auto-tag.yml`

## Validation
```bash
git status --short
git log --oneline -n 5
gh repo view ProjectPrometheusFindrive/pangea-frontend --json defaultBranchRef --jq '.defaultBranchRef.name'
gh api repos/ProjectPrometheusFindrive/pangea-frontend/branches/dev/protection
gh api repos/ProjectPrometheusFindrive/pangea-frontend/branches/production/protection
```

## Commands Used (optional)
```bash
git add <files>
git commit -m "Docs: update prompt_library to v1.2.1; add 20260225_BK-003-bootstrap-branch-policy-automation.md" -m "<summary bullets>"
git push -u origin feat/20260225-initial-setup-bootstrap
gh pr create --base dev --title "[Docs] BK-003: 프롬프트 라이브러리 및 이력 갱신" --body "<korean body>"
```

## Notes
- 차기 문서 작업 시 `prompt_library_v1.md`의 Version/Date/Version History를 항상 동기화한다.
- 차기 태스크 권장사항은 즉시 반영하지 않고 `Notes`에만 누적한다.
