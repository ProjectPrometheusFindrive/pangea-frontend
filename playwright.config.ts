import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const E2E_WEB_SERVER_COMMAND = process.env.E2E_WEB_SERVER_COMMAND ?? 'npm run dev -- --port 5173';
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: E2E_BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: E2E_WEB_SERVER_COMMAND,
    url: E2E_BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
  },
});
