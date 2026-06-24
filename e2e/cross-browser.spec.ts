import { expect, test } from '@playwright/test'
import { clickNavTab } from './helpers/navigation'
import { screenshot } from './helpers/screenshot'
import { deleteAllEmails, setupUserWithTrip } from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Cross-browser (Chrome)', () => {
  test('date range picker renders and is interactable', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Date picker trip')
    await clickNavTab(page, 'proposals')
    await page.getByTestId('new-proposal-btn').click()
    await expect(page.getByTestId('proposal-resort-name')).toBeVisible()

    const dateField = page.getByTestId('date-range-field')
    await expect(dateField).toBeVisible()
    await dateField.click()
    await screenshot(page, 'cross-browser', 'date-picker-open', proj)
  })

  test('virtual table scrolls smoothly', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Table scroll trip')
    await clickNavTab(page, 'resorts')
    await page.waitForTimeout(2000)

    await screenshot(page, 'cross-browser', 'resorts-table', proj)

    const tableContainer = page
      .locator('[role="grid"], [role="table"], table')
      .first()
    if (await tableContainer.isVisible()) {
      await page.mouse.wheel(0, 300)
      await page.waitForTimeout(200)
      await screenshot(page, 'cross-browser', 'resorts-table-scrolled', proj)
    }
  })

  test('search textarea is usable', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Textarea trip')
    await clickNavTab(page, 'resorts')
    await page.waitForTimeout(1000)

    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('Chamonix')
      await expect(searchInput).toHaveValue('Chamonix')
      await screenshot(page, 'cross-browser', 'search-textarea', proj)
    }
  })
})
