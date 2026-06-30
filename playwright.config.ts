import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: 'e2e/test-results',
  snapshotPathTemplate:
    'e2e/snapshots/{/projectName}/{testFilePath}/{arg}{ext}',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }],
  ],
  timeout: 30_000,
  expect: {
    // TODO: Remove once UI changes are stabilised and snapshots are updated
    // TODO: also remove e2e/snapshots from .gitignore (since once stable, we can commit)
    toHaveScreenshot: { maxDiffPixelRatio: 1 },
  },
  use: {
    baseURL: process.env.PUBLIC_EXTERNAL_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
  ],
})
