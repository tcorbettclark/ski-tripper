import type { Locator, Page } from '@playwright/test'

const infoBanner = (page: Page): Locator => page.getByTestId('info-banner')
const userMenu = (page: Page): Locator => page.getByTestId('user-menu-trigger')

const authMask = (page: Page): Locator[] => [infoBanner(page)]
const loggedInMask = (page: Page): Locator[] => [
  infoBanner(page),
  userMenu(page),
]

export const snapshotOptions = {
  auth: (page: Page) => ({
    fullPage: true,
    animations: 'disabled' as const,
    mask: authMask(page),
  }),
  loggedIn: (page: Page) => ({
    fullPage: true,
    animations: 'disabled' as const,
    mask: loggedInMask(page),
  }),
}
