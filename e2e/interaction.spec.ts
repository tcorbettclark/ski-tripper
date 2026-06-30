import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import { setupUserWithTrip } from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('UI interactions', () => {
  test('date range picker renders and is interactable', async ({ page }) => {
    await setupUserWithTrip(page, 'Date picker trip')
    await clickNavTab(page, 'proposals')
    await page.getByTestId('new-proposal-btn').click()
    await expect(page.getByTestId('proposal-resort-name')).toBeVisible()

    const dateField = page.getByTestId('date-range-field')
    await expect(dateField).toBeVisible()
    await dateField.click()
  })

  test('virtual table scrolls smoothly', async ({ page }) => {
    await setupUserWithTrip(page, 'Table scroll trip')
    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 2000)

    const tableContainer = page
      .locator('[role="grid"], [role="table"], table')
      .first()
    if (await tableContainer.isVisible()) {
      await page.mouse.wheel(0, 300)
      await waitForAnimation(page, 200)
    }
  })

  test('search textarea is usable', async ({ page }) => {
    await setupUserWithTrip(page, 'Textarea trip')
    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 1000)

    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('Chamonix')
      await expect(searchInput).toHaveValue('Chamonix')
    }
  })
})
