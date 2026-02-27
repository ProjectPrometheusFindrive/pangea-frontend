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
