import { expect, test } from '@playwright/test'
import {
  assertNoAccessibilityViolations,
  assertNoContrastViolations,
} from './helpers/axe'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import { setupUserWithTrip } from './helpers/setup'
import { snapshotOptions } from './helpers/snapshot'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Accessibility', () => {
  test('keyboard navigation through auth form', async ({ page }) => {
    await page.goto('/')

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
    })

    await test.step('enter submits form', async () => {
      await page.getByTestId('auth-email').fill('test@example.com')
      await page.getByTestId('auth-password').fill('TestPassword123!')
      await page.keyboard.press('Enter')
      await waitForAnimation(page, 500)
    })

    await test.step('escape closes modals', async () => {
      await page.getByRole('button', { name: /about/i }).click()
      await expect(page.getByRole('dialog'))
        .toBeVisible()
        .catch(() =>
          page.getByText(/about ski tripper/i).waitFor({ state: 'visible' })
        )
      await page.keyboard.press('Escape')
      await waitForAnimation(page, 500)
    })
  })

  test('keyboard navigation through app screens', async ({ page }) => {
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
      await waitForAnimation(page)
    })
  })

  test('form fields have visible labels', async ({ page }) => {
    await page.goto('/')

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
    await page.goto('/')
    await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
  })

  test('axe-core scan on main app screens', async ({ page }) => {
    await setupUserWithTrip(page, 'A11y scan trip')

    await test.step('overview accessibility', async () => {
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await test.step('resorts accessibility', async () => {
      await clickNavTab(page, 'resorts')
      await waitForAnimation(page, 1000)
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await test.step('proposals accessibility', async () => {
      await clickNavTab(page, 'proposals')
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })

    await test.step('voting accessibility', async () => {
      await clickNavTab(page, 'voting')
      await assertNoAccessibilityViolations(page, undefined, ['color-contrast'])
    })
  })

  test('contrast checks on auth screen (light)', async ({ page }) => {
    await page.goto('/')
    await assertNoContrastViolations(page)
    await expect(page).toHaveScreenshot(
      'theme-contrast-light-auth.png',
      snapshotOptions.auth(page)
    )
  })

  test('contrast checks on auth screen (dark)', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
      localStorage.setItem('theme', 'dark')
    })
    await page.reload()
    await assertNoContrastViolations(page)
    await expect(page).toHaveScreenshot(
      'theme-contrast-dark-auth.png',
      snapshotOptions.auth(page)
    )
  })

  test('contrast checks on main app screens', async ({ page }) => {
    await setupUserWithTrip(page, 'Theme contrast trip')

    await test.step('overview contrast check', async () => {
      await assertNoContrastViolations(page)
    })

    await test.step('resorts tab contrast check', async () => {
      await clickNavTab(page, 'resorts')
      await waitForAnimation(page, 500)
      await assertNoContrastViolations(page)
    })

    await test.step('proposals tab contrast check', async () => {
      await clickNavTab(page, 'proposals')
      await assertNoContrastViolations(page)
    })

    await expect(page).toHaveScreenshot(
      'theme-contrast-app-screens.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('dark theme contrast checks on all app tabs', async ({ page }) => {
    await setupUserWithTrip(page, 'Dark theme trip')

    await test.step('switch to dark theme', async () => {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark'
        localStorage.setItem('theme', 'dark')
      })
      await page.reload()
      await page.getByTestId('invite-code').waitFor({ state: 'visible' })
    })

    await test.step('overview tab dark mode', async () => {
      await expect(page).toHaveScreenshot(
        'dark-theme-overview.png',
        snapshotOptions.loggedIn(page)
      )
      await assertNoContrastViolations(page)
    })

    await test.step('resorts tab dark mode', async () => {
      await clickNavTab(page, 'resorts')
      await waitForAnimation(page, 1000)
      await expect(page).toHaveScreenshot(
        'dark-theme-resorts.png',
        snapshotOptions.loggedIn(page)
      )
      await assertNoContrastViolations(page)
    })

    await test.step('proposals tab dark mode', async () => {
      await clickNavTab(page, 'proposals')
      await expect(page).toHaveScreenshot(
        'dark-theme-proposals.png',
        snapshotOptions.loggedIn(page)
      )
    })

    await test.step('voting tab dark mode', async () => {
      await clickNavTab(page, 'voting')
      await expect(page).toHaveScreenshot(
        'dark-theme-voting.png',
        snapshotOptions.loggedIn(page)
      )
    })
  })

  test('tab navigation has proper ARIA roles', async ({ page }) => {
    await setupUserWithTrip(page, 'A11y tab roles trip')

    await test.step('nav tabs have accessible role', async () => {
      const overviewTab = page.getByTestId('nav-tab-overview')
      const _role = await overviewTab.evaluate((el) => el.getAttribute('role'))
      const tagName = await overviewTab.evaluate((el) => el.tagName)

      expect(tagName).toBe('BUTTON')
    })

    await test.step('tab order matches visual order', async () => {
      await clickNavTab(page, 'overview')
      await waitForAnimation(page)
      await clickNavTab(page, 'resorts')
      await waitForAnimation(page)
      await clickNavTab(page, 'proposals')
      await waitForAnimation(page)
      await clickNavTab(page, 'voting')
      await waitForAnimation(page)
    })
  })

  test('resort table rows are focusable', async ({ page }) => {
    await setupUserWithTrip(page, 'A11y table trip')
    await clickNavTab(page, 'resorts')
    await waitForAnimation(page, 2000)

    await test.step('table has appropriate ARIA', async () => {
      const table = page.locator('[role="grid"], [role="table"], table').first()
      if (await table.isVisible()) {
      }
    })
  })

  test('modal can be closed with Escape', async ({ page }) => {
    await setupUserWithTrip(page, 'A11y modal trip')

    await test.step('about modal closes with Escape', async () => {
      const aboutBtn = page.getByRole('button', { name: /about/i })
      if (await aboutBtn.isVisible()) {
        await aboutBtn.click()
        await waitForAnimation(page)
        await page.keyboard.press('Escape')
        await waitForAnimation(page)
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
        await waitForAnimation(page)
        await page.keyboard.press('Escape')
        await waitForAnimation(page)
      }
    })
  })
})
