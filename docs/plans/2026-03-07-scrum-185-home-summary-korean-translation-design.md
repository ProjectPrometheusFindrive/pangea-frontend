# SCRUM-185 Home Summary Korean Translation Design

## Goal

Replace the English home dashboard section heading `Home Summary` with the Korean label `홈 요약` so the page matches the rest of the Korean UI.

## Why This Design

- The page already uses `홈 요약` in related error and loading copy.
- The issue scope is a single hardcoded heading in the home page.
- A one-line text replacement avoids unnecessary abstraction for a single-use label.

## Chosen Approach

- Update the heading text in `src/app/pages/Home.tsx` from `Home Summary` to `홈 요약`.
- Add a UI regression assertion in `e2e/home.spec.ts` that checks the heading is rendered in Korean.

## Scope

- `src/app/pages/Home.tsx`
- `e2e/home.spec.ts`

## Testing Strategy

- Red: run `npm.cmd run test:e2e -- e2e/home.spec.ts` after adding the new heading assertion and confirm it fails while the UI still shows English.
- If another repo already has a Vite dev server bound to `127.0.0.1:4173`, do not trust the default reused-server Playwright path. Stop that server first or use an isolated port/config for this worktree.
- Green: update the heading text and re-run the same Playwright spec against the correct worktree server.
- Final verification: run `npm.cmd run build`.

## Constraints

- Keep the change minimal and avoid unrelated refactors.
- Skip any commit step because `git commit` is forbidden by the user instruction.
