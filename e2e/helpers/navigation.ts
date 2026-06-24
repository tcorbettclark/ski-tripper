import type { Page } from '@playwright/test'

export async function openMobileMenuIfNeeded(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: /open menu/i })
  if (await menuButton.isVisible()) {
    await menuButton.click()
    await page.waitForTimeout(300)
  }
}

export async function clickNavTab(
  page: Page,
  tab: 'overview' | 'resorts' | 'proposals' | 'poll'
): Promise<void> {
  await openMobileMenuIfNeeded(page)
  await page.getByTestId(`nav-tab-${tab}`).click()
}
