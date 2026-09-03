# E2E Test Policy (BK-091)

## Scope

- `e2e/login.spec.ts`
- `e2e/assets.spec.ts`
- `e2e/reservations.spec.ts`
- `e2e/device-installation.spec.ts`

## Flaky Control

- Default local retry: `0`
- CI retry: `2` (`playwright.config.ts`)
- Action timeout: `15s`
- Test timeout: `90s`
- CI worker: `1` (stability first)

## Failure Artifacts

- `trace`: `on-first-retry`
- `screenshot`: `only-on-failure`
- `video`: `retain-on-failure`
- HTML report: `playwright-report/`
- JUnit + raw artifacts: `test-results/`

## Mobile Responsive Coverage

- Run the default mobile suite with `npm run test:e2e:mobile`.
- The default suite covers Pixel 5 and iPhone 13 viewport/touch profiles in Chromium.
- Run the optional Safari-engine suite with `npm run test:e2e:mobile:webkit`.
- On Linux, the WebKit suite may require a one-time system dependency install with
  `sudo npx playwright install-deps webkit`.
- Mobile scenarios live in `e2e/mobile-responsive.spec.ts` and cover login reachability,
  navigation, core routes, asset and contract dialogs, and installer landing-page overflow.
