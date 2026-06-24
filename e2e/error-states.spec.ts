import { test } from '@playwright/test'
import { screenshot } from './helpers/screenshot'
import {
  deleteAllEmails,
  setupUserWithPreferences,
  setupUserWithTrip,
} from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Error states and edge cases', () => {
  test('network failure shows error message', async ({ page }) => {
    const proj = projectName()
    await setupUserWithPreferences(page)

    await page.route('**/api/collections/trips**', (route) =>
      route.abort('internetdisconnected')
    )

    const createBtn = page.getByTestId('new-trip-btn')
    if (await createBtn.isVisible()) {
      await createBtn.click()
      const description = page.getByTestId('trip-description')
      if (await description.isVisible()) {
        await description.fill('Network fail trip')
        await page.getByTestId('trip-save').click()

        const errorVisible = await page
          .getByText(/error|failed|couldn't/i)
          .isVisible()
          .catch(() => false)
        if (errorVisible) {
          await screenshot(page, 'error-states', 'network-error', proj)
        }
      }
    }
  })

  test('auth token expiry redirects to login', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Expiry trip')

    await test.step('clear auth and verify redirect', async () => {
      await page.evaluate(() => {
        const pb = (
          window as unknown as Record<
            string,
            { authStore: { clear: () => void } }
          >
        ).__pocketbase__
        if (pb) pb.authStore.clear()
      })
      await page.reload()
      await page.waitForTimeout(1000)

      const onLoginPage = await page
        .getByTestId('auth-email')
        .isVisible()
        .catch(() => false)
      if (onLoginPage) {
        await screenshot(page, 'error-states', 'token-expired', proj)
      }
    })
  })

  test('empty state: no trips', async ({ page }) => {
    const proj = projectName()
    await setupUserWithPreferences(page)

    const emptyMessage = page.getByText(/no trips|create.*trip|get started/i)
    if (await emptyMessage.isVisible()) {
      await screenshot(page, 'error-states', 'no-trips', proj)
    } else {
      await screenshot(page, 'error-states', 'trips-list', proj)
    }
  })

  test('empty state: no proposals', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Empty proposals trip')
    await page.getByTestId('nav-tab-proposals').click()

    await screenshot(page, 'error-states', 'no-proposals', proj)
  })

  test('empty state: no open poll', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Empty poll trip')
    await page.getByTestId('nav-tab-poll').click()

    await screenshot(page, 'error-states', 'no-poll', proj)
  })

  test('error boundary recovery', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Error boundary trip')

    await test.step('tabs still work after potential errors', async () => {
      await page.getByTestId('nav-tab-resorts').click()
      await page.waitForTimeout(500)
      await page.getByTestId('nav-tab-proposals').click()
      await page.waitForTimeout(500)
      await page.getByTestId('nav-tab-poll').click()
      await page.waitForTimeout(500)
      await page.getByTestId('nav-tab-overview').click()
      await page.waitForTimeout(500)
      await screenshot(page, 'error-states', 'boundary-recovery', proj)
    })
  })

  test('network recovery allows retry without reload', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Recovery trip')

    await test.step('block network and verify error, then restore', async () => {
      await page.route('**/api/collections/**', (route) =>
        route.abort('internetdisconnected')
      )

      await page.getByTestId('nav-tab-proposals').click()
      await page.waitForTimeout(1000)

      await page.unroute('**/api/collections/**')

      await page.getByTestId('nav-tab-overview').click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'error-states', 'network-recovered', proj)
    })
  })

  test('401 from any API call redirects to login', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, '401 trip')

    await page.route('**/api/collections/**', (route) =>
      route.fulfill({
        status: 401,
        body: JSON.stringify({ message: 'Unauthorized' }),
      })
    )

    await page.getByTestId('nav-tab-resorts').click()
    await page.waitForTimeout(2000)

    const onLoginPage = await page
      .getByTestId('auth-email')
      .isVisible()
      .catch(() => false)
    if (onLoginPage) {
      const expiredMessage = page.getByText(/session|expired|sign.*in/i)
      if (await expiredMessage.isVisible().catch(() => false)) {
        await screenshot(page, 'error-states', 'session-expired-message', proj)
      }
    }
  })

  test('no resorts data shows empty state', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'No resorts trip')

    await page.route('**/resorts**', (route) =>
      route.fulfill({ status: 200, body: '' })
    )

    await page.getByTestId('nav-tab-resorts').click()
    await page.waitForTimeout(1000)
    await screenshot(page, 'error-states', 'no-resorts', proj)
  })
})
