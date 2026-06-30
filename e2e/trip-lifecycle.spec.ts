import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { setupUserWithPreferences, setupUserWithTrip } from './helpers/setup'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Trip lifecycle', () => {
  test('create a trip and view overview', async ({ page }) => {
    const { tripDescription } = await setupUserWithTrip(
      page,
      'Weekend in Chamonix'
    )

    await test.step('assert trip and invite code are visible', async () => {
      await expect(page.getByText(tripDescription)).toBeVisible()
      await expect(page.getByTestId('invite-code')).toBeVisible()
    })
  })

  test('create a trip and join with code', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
      let inviteCode: string

      await test.step('user 1 signs up and creates trip', async () => {
        await setupUserWithTrip(page1, 'Zermatt 2026')
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      await test.step('user 2 signs up and joins trip', async () => {
        await setupUserWithPreferences(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)
      })

      await test.step('assert user 2 sees the trip', async () => {
        await expect(page2.getByText('Zermatt 2026')).toBeVisible()
      })
    })
  })
})
