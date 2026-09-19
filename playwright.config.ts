import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: (process.env.E2E_BASE_URL as string | undefined) ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    // Playwright's default actionTimeout is 0 — meaning NO cap — so a click on
    // a control that never becomes actionable waits out the whole TEST timeout.
    // With a 240s test that is four minutes of a job budget spent on one dead
    // click, and the job is killed by its step cap before the reporter can say
    // which click it was: the run produces a red square and no information.
    //
    // A bounded action timeout turns that into a named failure with the
    // locator in it, seconds after the control fails to appear. It cannot
    // cause a false failure on a slow machine — 15s is longer than any real
    // interaction in this app, and the expect() timeout beside it is the same.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
