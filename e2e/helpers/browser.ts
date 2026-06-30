import type { Browser, Page } from '@playwright/test'

export async function withTwoPages(
  browser: Browser,
  fn: (page1: Page, page2: Page) => Promise<void>
): Promise<void> {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()
  try {
    await fn(page1, page2)
  } finally {
    await ctx1.close()
    await ctx2.close()
  }
}
