import { expect, type Page } from '@playwright/test'

const BASE_URL = 'https://ski-tripper.localhost'

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE_URL)
  await expect(page.getByTestId('auth-email')).toBeVisible()
}
