import path from 'node:path'
import type { Page } from '@playwright/test'

const SCREENSHOT_DIR = 'e2e/test-results/screenshots'

export async function screenshot(
  page: Page,
  testName: string,
  step: string,
  project: string
): Promise<void> {
  const filename = `${project}-${testName}-${step}.png`
  const filepath = path.join(SCREENSHOT_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: true })
}

export function isMobile(projectName: string): boolean {
  return projectName === 'mobile'
}
