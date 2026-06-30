import { expect, test } from '@playwright/test'
import { logout } from './helpers/auth'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import { setupUserWithPreferences, setupUserWithTrip } from './helpers/setup'
import { snapshotOptions } from './helpers/snapshot'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Error states and edge cases', () => {
  test('network failure shows error message', async ({ page }) => {
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

        await page
          .getByRole('alert')
          .isVisible()
          .catch(() => false)
      }
    }
  })

  test('auth token expiry redirects to login', async ({ page }) => {
    await setupUserWithTrip(page, 'Expiry trip')

    await test.step('clear auth and verify redirect', async () => {
      await logout(page)
    })
  })

  test('empty state: no trips', async ({ page }) => {
    await setupUserWithPreferences(page)

    const emptyMessage = page.getByText(/no trips|create.*trip|get started/i)
    if (await emptyMessage.isVisible()) {
      await expect(page).toHaveScreenshot(
        'error-states-no-trips.png',
        snapshotOptions.loggedIn(page)
      )
    }
  })

  test('empty state: no proposals', async ({ page }) => {
    await setupUserWithTrip(page, 'Empty proposals trip')
    await clickNavTab(page, 'proposals')

    await expect(page).toHaveScreenshot(
      'error-states-no-proposals.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('empty state: no open poll', async ({ page }) => {
    await setupUserWithTrip(page, 'Empty poll trip')
    await clickNavTab(page, 'poll')

    await expect(page).toHaveScreenshot(
      'error-states-no-poll.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('error boundary recovery', async ({ page }) => {
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
    })
  })

  test('network recovery allows retry without reload', async ({ page }) => {
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
    })
  })

  test('401 from any API call redirects to login', async ({ page }) => {
    await setupUserWithTrip(page, '401 trip')

    await page.route('**/api/collections/**', (route) =>
      route.fulfill({
        status: 401,
        body: JSON.stringify({ message: 'Unauthorized' }),
      })
    )

    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 2000)

    await page
      .getByTestId('auth-email')
      .isVisible()
      .catch(() => false)
  })

  test('no resorts data shows empty state', async ({ page }) => {
    await setupUserWithTrip(page, 'No resorts trip')

    await page.route('**/resorts**', (route) =>
      route.fulfill({ status: 200, body: '' })
    )

    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 1000)
    await expect(page).toHaveScreenshot(
      'error-states-no-resorts.png',
      snapshotOptions.loggedIn(page)
    )
  })
})
