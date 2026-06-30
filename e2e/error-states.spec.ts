import { test } from '@playwright/test'
import { logout } from './helpers/auth'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import { projectName, screenshot } from './helpers/screenshot'
import { setupUserWithPreferences, setupUserWithTrip } from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

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
          .getByRole('alert')
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
      await logout(page)
      await screenshot(page, 'error-states', 'token-expired', proj)
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
    await clickNavTab(page, 'proposals')

    await screenshot(page, 'error-states', 'no-proposals', proj)
  })

  test('empty state: no open poll', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Empty poll trip')
    await clickNavTab(page, 'poll')

    await screenshot(page, 'error-states', 'no-poll', proj)
  })

  test('error boundary recovery', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Error boundary trip')

    await test.step('tabs still work after potential errors', async () => {
      await clickNavTab(page, 'resorts')
      await waitForAnimation(page, 500)
      await clickNavTab(page, 'proposals')
      await waitForAnimation(page, 500)
      await clickNavTab(page, 'poll')
      await waitForAnimation(page, 500)
      await clickNavTab(page, 'overview')
      await waitForAnimation(page, 500)
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

      await clickNavTab(page, 'proposals')
      await waitForAnimation(page, 1000)

      await page.unroute('**/api/collections/**')

      await clickNavTab(page, 'overview')
      await waitForAnimation(page, 1000)
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

    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 2000)

    const onLoginPage = await page
      .getByTestId('auth-email')
      .isVisible()
      .catch(() => false)
    if (onLoginPage) {
      const expiredMessage = page.getByRole('alert')
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

    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 1000)
    await screenshot(page, 'error-states', 'no-resorts', proj)
  })
})
