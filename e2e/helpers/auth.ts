import { expect, type Page } from '@playwright/test'

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear()
    const pb = (
      window as unknown as Record<string, { authStore: { clear: () => void } }>
    ).__pocketbase__
    if (pb) pb.authStore.clear()
  })
  await page.goto('/')
  await expect(page.getByTestId('auth-email')).toBeVisible()
}
