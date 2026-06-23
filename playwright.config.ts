import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: 'e2e/test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }],
  ],
  timeout: 10_000,
  use: {
    baseURL: process.env.PUBLIC_EXTERNAL_URL || 'https://ski-tripper.localhost',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
