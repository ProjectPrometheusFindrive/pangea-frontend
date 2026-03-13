# Home GT Visibility Alignment Design

**Topic:** Match the visible home screen in `pangea-frontend` to `Pangea_v2_v127` while keeping the current production data sources.

## Goal

Make the deployed home page visually match the GT baseline for all user-visible elements on desktop, starting with home. The implementation must preserve the current service layer and summary APIs where possible.

## Scope

- Match visible section order, headings, labels, button copy, card grouping, and premium CTA layout to the GT home.
- Remove the home-only company selector row from the rendered UI, including for `super_admin`.
- Keep current home summary and action-item API calls when possible.
- Keep existing navigation behavior behind the visible GT-aligned cards.

## Non-goals

- Rebuild backend APIs to mimic GT data exactly.
- Force numeric counts to match GT mock numbers.
- Remove global features outside the home screen unless required for home parity.

## Chosen approach

Use the existing home data model and interactions, but refactor the rendered home layout so the visible output matches `Pangea_v2_v127`.

This means:

- The top priority area returns to a single `오늘 할 일` section with GT-style left task column and right issue-card grid.
- The dashboard area uses GT section titles: `자산 현황`, `계약 현황`, `운영 점수`.
- The extra `최근 변경` card and helper/placeholder copy that do not exist in GT are removed from the visible layout.
- `super_admin` keeps aggregate behavior but does not see a company selector on home.

## Testing strategy

- Update source-based tests to assert GT-visible structure instead of the current home-specific deviations.
- Add a failing test that forbids the home company selector UI and related home page wiring.
- Run targeted node tests first, then build, then compare the rendered home against GT in Chrome.
