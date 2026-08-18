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
  },
});
