# AGENTS.md

## Branch Strategy

- Default branch is `dev`.
- Start all feature/fix/docs branches from `dev`.
- Merge work by PR into `dev` (no direct push).
- Release only via PR from `dev` to `production`.
- `main` is not used in this repository.

## Protection Rules

- `dev` and `production` are protected.
- Direct push is blocked.
- At least 1 approving review is required.
- Force-push and branch deletion are blocked.

## Version Tagging

- Version tags (`vX.Y.Z`) are created automatically when changes are pushed to `production`.
- Do not create release tags manually unless explicitly required.
