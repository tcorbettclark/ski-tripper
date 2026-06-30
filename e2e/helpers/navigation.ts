import { expect, type Page } from '@playwright/test'

export async function waitForAnimation(page: Page, ms = 300): Promise<void> {
  await page.waitForTimeout(ms)
}

export async function openMobileMenuIfNeeded(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: /open menu/i })
  if (await menuButton.isVisible()) {
    await menuButton.click()
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible(
      { timeout: 2000 }
    )
  }
}

export async function clickNavTab(
  page: Page,
  tab: 'overview' | 'resorts' | 'proposals' | 'voting'
): Promise<void> {
  await openMobileMenuIfNeeded(page)
  await page.getByTestId(`nav-tab-${tab}`).click()
}
