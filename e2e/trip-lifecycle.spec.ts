import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { setupUserWithTrip } from './helpers/setup'

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
})
