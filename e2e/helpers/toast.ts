import { expect, type Page } from '@playwright/test'

export async function waitForToast(
  page: Page,
  text: RegExp | string,
  options?: { timeout?: number }
): Promise<void> {
  await expect(page.getByRole('alert')).toContainText(text, options)
}

export async function expectNoToast(page: Page): Promise<void> {
  await expect(page.getByRole('alert')).not.toBeVisible()
}
