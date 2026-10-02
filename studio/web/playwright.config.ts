import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  workers: 1,
  retries: 0,
  outputDir: '../.data/test-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:15178', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'sh ../scripts/test-api.sh',
      url: 'http://127.0.0.1:18088/api/health',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 15178',
      url: 'http://localhost:15178',
      env: { API_URL: 'http://127.0.0.1:18088' },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
