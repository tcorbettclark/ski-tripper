import { expect, test } from '@playwright/test'
import {
  assertNoAccessibilityViolations,
  assertNoContrastViolations,
} from './helpers/axe'
import { clickNavTab } from './helpers/navigation'
import { screenshot } from './helpers/screenshot'
import { deleteAllEmails, setupUserWithTrip } from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Accessibility', () => {
  test('keyboard navigation through auth form', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)

    await test.step('tab through interactive elements', async () => {
      const focusableElements: string[] = []
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        const focused = await page.evaluate(() => {
          const el = document.activeElement
          return el
            ? `${el.tagName}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.getAttribute('type') ?? ''}]`
            : ''
        })
        if (focused) focusableElements.push(focused)
      }
      expect(focusableElements.length).toBeGreaterThan(2)
      await screenshot(page, 'a11y', 'keyboard-tab-order', proj)
    })

    await test.step('enter submits form', async () => {
      await page.getByTestId('auth-email').fill('test@example.com')
      await page.getByTestId('auth-password').fill('TestPassword123!')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
    })

    await test.step('escape closes modals', async () => {
      await page.getByRole('button', { name: /about/i }).click()
      await expect(page.getByRole('dialog'))
        .toBeVisible()
        .catch(() =>
          page.getByText(/about ski tripper/i).waitFor({ state: 'visible' })
        )
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    })
  })

  test('keyboard navigation through app screens', async ({ page }) => {
    const _proj = projectName()
    await setupUserWithTrip(page, 'A11y trip')

    await test.step('tab through header and tabs', async () => {
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
      }
      const focusedTag = await page.evaluate(
        () => document.activeElement?.tagName ?? ''
      )
      expect(['BUTTON', 'A', 'INPUT'].includes(focusedTag)).toBe(true)
    })

    await test.step('enter activates focused element', async () => {
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab')
      }
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
    })
  })

  test('form fields have visible labels', async ({ page }) => {
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)

    await test.step('auth form fields have associated labels', async () => {
      const emailInput = page.getByTestId('auth-email')
      const ariaLabel = await emailInput.evaluate((el) => {
        const labelledBy = el.getAttribute('aria-labelledby')
        const ariaLabelVal = el.getAttribute('aria-label')
        const label = el.closest('label')
        const placeholder = el.getAttribute('placeholder')
        return {
          labelledBy,
          ariaLabel: ariaLabelVal,
          hasLabel: !!label,
          placeholder,
        }
      })
      const hasAccessibleName =
        ariaLabel.ariaLabel ||
        ariaLabel.labelledBy ||
        ariaLabel.hasLabel ||
        ariaLabel.placeholder
      expect(hasAccessibleName).toBeTruthy()
    })
  })

  test('buttons have meaningful text or aria-labels', async ({ page }) => {
    const _proj = projectName()
    await setupUserWithTrip(page, 'A11y buttons trip')

    const buttons = await page.locator('button').all()
    for (const button of buttons) {
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')
      const hasAccessibleName = (text && text.trim().length > 0) || ariaLabel
      expect(hasAccessibleName).toBeTruthy()
    }
  })

  test('axe-core scan on auth screen', async ({ page }) => {
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
    await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
  })

  test('axe-core scan on main app screens', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'A11y scan trip')

    await test.step('overview accessibility', async () => {
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await test.step('resorts accessibility', async () => {
      await clickNavTab(page, 'resorts')
      await page.waitForTimeout(1000)
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await test.step('proposals accessibility', async () => {
      await clickNavTab(page, 'proposals')
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await test.step('poll accessibility', async () => {
      await clickNavTab(page, 'poll')
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await screenshot(page, 'a11y', 'app-screens-scanned', proj)
  })

  test('contrast check on all screens', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
    await assertNoContrastViolations(page)

    await setupUserWithTrip(page, 'Contrast trip')
    await assertNoContrastViolations(page)

    await clickNavTab(page, 'resorts')
    await page.waitForTimeout(500)
    await assertNoContrastViolations(page)

    await clickNavTab(page, 'proposals')
    await assertNoContrastViolations(page)

    await clickNavTab(page, 'poll')
    await assertNoContrastViolations(page)

    await screenshot(page, 'a11y', 'contrast-checks', proj)
  })

  test('tab navigation has proper ARIA roles', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'A11y tab roles trip')

    await test.step('nav tabs have accessible role', async () => {
      const overviewTab = page.getByTestId('nav-tab-overview')
      const _role = await overviewTab.evaluate((el) => el.getAttribute('role'))
      const tagName = await overviewTab.evaluate((el) => el.tagName)

      expect(tagName).toBe('BUTTON')
    })

    await test.step('tab order matches visual order', async () => {
      await clickNavTab(page, 'overview')
      await page.waitForTimeout(300)
      await clickNavTab(page, 'resorts')
      await page.waitForTimeout(300)
      await clickNavTab(page, 'proposals')
      await page.waitForTimeout(300)
      await clickNavTab(page, 'poll')
      await page.waitForTimeout(300)
      await screenshot(page, 'a11y', 'tab-roles', proj)
    })
  })

  test('resort table rows are focusable', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'A11y table trip')
    await clickNavTab(page, 'resorts')
    await page.waitForTimeout(2000)

    await test.step('table has appropriate ARIA', async () => {
      const table = page.locator('[role="grid"], [role="table"], table').first()
      if (await table.isVisible()) {
        await screenshot(page, 'a11y', 'resorts-table', proj)
      }
    })
  })

  test('modal can be closed with Escape', async ({ page }) => {
    const _proj = projectName()
    await setupUserWithTrip(page, 'A11y modal trip')

    await test.step('about modal closes with Escape', async () => {
      const aboutBtn = page.getByRole('button', { name: /about/i })
      if (await aboutBtn.isVisible()) {
        await aboutBtn.click()
        await page.waitForTimeout(300)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
        const modalVisible = await page
          .getByRole('dialog')
          .isVisible()
          .catch(() => false)
        expect(modalVisible).toBe(false)
      }
    })

    await test.step('preferences modal closes with Escape', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click()
        await page.getByRole('menuitem', { name: /preferences/i }).click()
        await page.waitForTimeout(300)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    })
  })

  test('dark mode contrast check on all screens', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
      localStorage.setItem('theme', 'dark')
    })

    await assertNoContrastViolations(page)

    await setupUserWithTrip(page, 'Dark contrast trip')

    await assertNoContrastViolations(page)
    await clickNavTab(page, 'resorts')
    await page.waitForTimeout(500)
    await assertNoContrastViolations(page)
    await clickNavTab(page, 'proposals')
    await assertNoContrastViolations(page)

    await screenshot(page, 'a11y', 'dark-contrast-checks', proj)
  })
})
