# Initial Setup Bootstrap

- Date: 2026-02-25 19:35 KST
- Author: Codex
- Branch: feat/20260225-initial-setup-bootstrap
- Tags: bootstrap,prompt-library,prompt-history,branch-policy

## Prompt
초기 세팅(프롬프트 라이브러리/히스토리 구조, 브랜치 정책, AGENTS.md, 워크플로)을 정리하고 End Prompt 기준으로 문서화.

## Assumptions
- 저장소 운영 브랜치는 `dev` / `production` 이며 `main`은 사용하지 않음.
- 직접 push 없이 PR 기반으로만 반영.
- 문서화는 `docs/prompt_library`와 `docs/prompt_history`에 일관되게 누적.

## Plan
- 현재 변경 상태와 docs 구조 점검
- 브랜치 정책/자동 태깅/ignore 설정 반영 확인
- prompt library 기준 문서(`prompt_library_v1.md`) 생성
- 작업 단위 기록(`prompt_history`) 추가
- 변경 요약 및 후속 액션 정리

## Changes Summary
- `AGENTS.md`를 추가해 브랜치 전략(`dev -> production`, `main` 미사용), 보호 규칙, 자동 태깅 정책을 명시함.
- `README.md`에 Branch strategy 섹션을 추가해 운영 정책을 사용자 문서 레벨에서 동일하게 노출함.
- `.gitignore`에 로컬 Python 가상환경/캐시 패턴을 추가해 대량 미추적 파일(venv) 노이즈를 제거함.
- `.github/workflows/production-auto-tag.yml`을 추가해 `production` 반영 시 패치 버전 태그(`vX.Y.Z`) 자동 생성을 설정함.
- `docs/prompt_library` 및 `docs/prompt_history` 템플릿/README를 구성하고, 본 작업에서 `prompt_library_v1.md`를 초기 생성함.

## Affected Files
- `AGENTS.md`: 저장소 브랜치 정책/보호 규칙/태그 정책 정의
- `README.md`: 브랜치 전략 요약 추가
- `.gitignore`: `.venv*`, `venv/`, `__pycache__/`, `*.pyc` 무시 규칙 추가
- `.github/workflows/production-auto-tag.yml`: production push 시 자동 태깅 워크플로 추가
- `docs/prompt_library/README.md`: 라이브러리 운영 가이드 추가
- `docs/prompt_library/_TEMPLATE.md`: 라이브러리 문서 템플릿 추가
- `docs/prompt_library/prompt_library_v1.md`: 라이브러리 기준 문서(v1.0.0) 생성
- `docs/prompt_history/README.md`: 히스토리 운영 가이드 추가
- `docs/prompt_history/_TEMPLATE.md`: 히스토리 템플릿 추가
- `docs/prompt_history/20260225_initial-setup-bootstrap.md`: 작업 이력 기록 추가

## Validation
```bash
git fetch --all --prune
git switch dev && git pull --ff-only
git status -sb
rg -n "Blueprint|jsonify|status|error|success" src docs README.md DEVELOPER_GUIDE.md

# remote policy check
gh repo view ProjectPrometheusFindrive/pangea-frontend --json defaultBranchRef --jq '.defaultBranchRef.name'
gh api repos/ProjectPrometheusFindrive/pangea-frontend/branches/dev/protection
gh api repos/ProjectPrometheusFindrive/pangea-frontend/branches/production/protection
```

## Commands Used (optional)
```bash
git switch -c feat/20260225-initial-setup-bootstrap
gh api -X PUT repos/ProjectPrometheusFindrive/pangea-frontend/branches/{dev|production}/protection
gh api -X DELETE repos/ProjectPrometheusFindrive/pangea-frontend/git/refs/heads/main
```

## Notes/Follow-ups
- 다음 문서 변경부터는 `docs/prompt_library/prompt_library_v1.md`의 Version/Date/History를 함께 갱신.
- PR 생성 시 base는 항상 `dev`로 유지하고, 배포는 `dev -> production` PR로만 진행.
