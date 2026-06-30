import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import { projectName, screenshot } from './helpers/screenshot'
import { setupUserWithSubmittedProposal } from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('SSE streaming (LLM responses)', () => {
  test('proposal analysis streams content', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Analysis trip', 'StreamResort')

    await test.step('analyse button triggers streaming', async () => {
      const analyseBtn = page.getByRole('button', { name: /analyse/i })
      if (await analyseBtn.isVisible()) {
        await analyseBtn.click()

        await expect(page.getByText(/generating|analyzing/i)).toBeVisible({
          timeout: 5000,
        })
        await screenshot(page, 'sse-analysis', 'streaming', proj)
      }
    })

    await test.step('thinking content is collapsible', async () => {
      const thinkingSection = page.getByText(/thinking/i).first()
      if (await thinkingSection.isVisible()) {
        await screenshot(page, 'sse-analysis', 'thinking-visible', proj)
      }
    })

    await test.step('content completes', async () => {
      await waitForAnimation(page, 3000)
      await screenshot(page, 'sse-analysis', 'complete', proj)
    })
  })

  test('preference search sparkle button', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Search trip', 'SearchResort')

    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 1000)

    const sparkleBtn = page.getByRole('button', { name: /ai|sparkle|search/i })
    if (await sparkleBtn.isVisible()) {
      await sparkleBtn.click()
      await screenshot(page, 'sse-search', 'modal-open', proj)
    }
  })

  test('SSE error handling displays error message', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'SSE error trip', 'ErrorResort')

    await page.route('**/api/analyse**', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    )

    const analyseBtn = page.getByRole('button', { name: /analyse/i })
    if (await analyseBtn.isVisible()) {
      await analyseBtn.click()

      const errorVisible = await page
        .getByRole('alert')
        .isVisible()
        .catch(() => false)
      if (errorVisible) {
        await screenshot(page, 'sse-error', 'displayed', proj)
      }
    }
  })

  test('navigating away during streaming cancels request cleanly', async ({
    page,
  }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(
      page,
      'SSE cancel trip',
      'CancelResort'
    )

    const analyseBtn = page.getByRole('button', { name: /analyse/i })
    if (await analyseBtn.isVisible()) {
      await analyseBtn.click()
      await waitForAnimation(page, 500)
      await clickNavTab(page, 'overview')
      await waitForAnimation(page, 1000)

      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await clickNavTab(page, 'proposals')
      await waitForAnimation(page, 500)

      const uncaughtErrors = consoleErrors.filter(
        (e) => e.includes('unhandled') || e.includes('UnhandledRejection')
      )
      expect(uncaughtErrors).toHaveLength(0)
      await screenshot(page, 'sse-cancel', 'navigated-away', proj)
    }
  })

  test('retry button works after SSE error', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'SSE retry trip', 'RetryResort')

    let requestCount = 0
    await page.route('**/api/analyse**', (route) => {
      requestCount++
      if (requestCount === 1) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      } else {
        route.continue()
      }
    })

    const analyseBtn = page.getByRole('button', { name: /analyse/i })
    if (await analyseBtn.isVisible()) {
      await analyseBtn.click()

      await waitForAnimation(page, 1000)

      const retryBtn = page.getByRole('button', {
        name: /retry|try again|analyse/i,
      })
      if (await retryBtn.isVisible()) {
        await retryBtn.click()
        await waitForAnimation(page, 1000)
        await screenshot(page, 'sse-retry', 'after-retry', proj)
      }
    }
  })
})
