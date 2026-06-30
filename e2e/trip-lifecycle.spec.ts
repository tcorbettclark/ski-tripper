import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { setupUserWithTrip, signupVerifyAndLogin } from './helpers/setup'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Trip lifecycle', () => {
  test('create a trip and view overview', async ({ page }) => {
    await test.step('signup, verify, and login', async () => {
      await signupVerifyAndLogin(page)
    })

    await test.step('fill preferences and create trip', async () => {
      const { tripDescription } = await setupUserWithTrip(
        page,
        'Weekend in Chamonix'
      )
      await expect(page.getByText(tripDescription)).toBeVisible()
    })

    await test.step('assert invite code is visible', async () => {
      await expect(page.getByTestId('invite-code')).toBeVisible()
    })
  })

  test('create a trip and join with code', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
      let inviteCode: string

      await test.step('user 1 signs up and creates trip', async () => {
        const { tripDescription: _tripDescription } = await setupUserWithTrip(
          page1,
          'Zermatt 2026'
        )
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      await test.step('user 2 signs up and joins trip', async () => {
        await signupVerifyAndLogin(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)
      })

      await test.step('assert user 2 sees the trip', async () => {
        await expect(page2.getByText('Zermatt 2026')).toBeVisible()
      })
    })
  })
})
