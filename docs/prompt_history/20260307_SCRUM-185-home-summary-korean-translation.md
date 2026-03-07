# SCRUM-185 Home Summary Korean Translation

- Date: 2026-03-07 20:52
- Author: Codex
- Branch: `fix/SCRUM-185-home-summary-korean-translation`
- Jira Key: `SCRUM-185`
- Jira Status: `진행 중` during implementation, `Resolved` planned after PR creation
- PR URL: `https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/81`
- Tags: `home`, `copy`, `i18n`, `playwright`

## Start Context
- Jira `SCRUM-185` reported that the Home page still rendered the section title `Home Summary` in English while the surrounding Home UI copy was already Korean.
- Work started from the latest `dev` branch inside an isolated git worktree with Jira plan sync, impact analysis, and a narrow scope limited to the frontend Home screen.
- Acceptance focus was to replace the visible heading with Korean text and lock the regression with UI coverage rather than broad refactoring.

## Changes Summary
- Replaced the Home summary card heading text with `홈 요약` in the live page so the section now matches adjacent Korean error/loading copy.
- Added a Playwright assertion that checks the rendered heading by accessible role/name, preventing the English label from reappearing silently.
- Documented the local verification caveat that the default Playwright config can reuse an already-running Vite server on `127.0.0.1:4173`, and recorded the isolated-port workaround used to verify this worktree safely.
- Updated `prompt_library` to `v1.2.46` so future prompt history entries for Home copy/i18n regressions capture the exact text swap and the reused-server verification condition.

## Diffs & Files
- `src/app/pages/Home.tsx`
  - Changed the visible section heading from `Home Summary` to `홈 요약`.
- `e2e/home.spec.ts`
  - Added `getByRole('heading', { name: '홈 요약' })` regression coverage before the existing card assertions.
- `docs/plans/2026-03-07-scrum-185-home-summary-korean-translation-design.md`
  - Recorded the Playwright reused-server precondition for reproducible red/green verification.
- `docs/plans/2026-03-07-scrum-185-home-summary-korean-translation-implementation.md`
  - Added the same verification caveat to the execution steps.
- `docs/prompt_library/prompt_library_v1.md`
  - Bumped the library metadata to `v1.2.46` and added the Home copy/i18n evidence rule.
- `docs/prompt_history/20260307_SCRUM-185-home-summary-korean-translation.md`
  - Added the ticket-specific history record for this change.

## Commands Used
```bash
git fetch --all --prune
git switch dev
git pull --ff-only
git worktree add -b fix/SCRUM-185-home-summary-korean-translation ../SCRUM-185-home-summary-korean-translation dev
npm.cmd ci
npm.cmd run test:e2e -- e2e/home.spec.ts
npx.cmd playwright test e2e/home.spec.ts --config playwright.scrum-185.config.ts
npm.cmd run build
```

## Validation
```bash
# Red
npm.cmd run test:e2e -- e2e/home.spec.ts
# => FAIL: heading '홈 요약' not found while UI still rendered 'Home Summary'

# Green/isolated verification
npx.cmd playwright test e2e/home.spec.ts --config playwright.scrum-185.config.ts
# => 1 passed (8.7s)

# Build
npm.cmd run build
# => PASS
```

## Notes
- The temporary isolated Playwright config used port `4174` to avoid a pre-existing `127.0.0.1:4173` Vite server from the base `pangea-frontend` repo. The temporary file was deleted after verification and is not part of the final diff.
- An unrelated existing local test failure remains in `tests/asset-detail-modal.test.mjs` (`useNavigate()` outside router) and was not changed by this ticket.
- GitHub PR: `https://github.com/ProjectPrometheusFindrive/pangea-frontend/pull/81`
