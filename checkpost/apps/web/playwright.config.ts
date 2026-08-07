import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a stack that is already up, because the point of these tests is
 * the seam between the browser, the API and Postgres. Starting a fake would
 * only test the fake, and the two bugs these caught (a Content Security Policy
 * that blocked the API, and two tabs sharing one client id) were both invisible
 * without the real thing.
 *
 * ```
 * pnpm db:up && pnpm dev          # in one terminal
 * pnpm --filter @checkpost/web test:e2e
 * ```
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // A phone is the design target, so it is what the tests run on.
      name: 'phone',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
