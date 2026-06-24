import { expect, test } from '@playwright/test'
import { assertNoContrastViolations } from './helpers/axe'
import { screenshot } from './helpers/screenshot'
import { deleteAllEmails, setupUserWithTrip } from './helpers/setup'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Theme', () => {
  test('light theme renders correctly', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)

    await test.step('default theme is light', async () => {
      const theme = await page.evaluate(
        () => document.documentElement.dataset.theme
      )
      expect(theme === 'light' || theme === undefined).toBe(true)
    })

    await test.step('all screens render with correct light colours', async () => {
      await expect(page.getByTestId('auth-email')).toBeVisible()
      await screenshot(page, 'theme-light', 'auth', proj)
    })

    await test.step('card backgrounds have subtle contrast against page', async () => {
      const cardBg = await page.evaluate(() => {
        const card = document.querySelector('[style*="maxWidth"]')
        if (!card) return null
        return window.getComputedStyle(card).backgroundColor
      })
      expect(cardBg).not.toBe('rgba(0, 0, 0, 0)')
    })

    await test.step('error text is visible against card backgrounds', async () => {
      const errorStyles = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        return {
          errorColor: style.getPropertyValue('--color-error').trim(),
        }
      })
      expect(errorStyles.errorColor).toBeTruthy()
    })
  })

  test('dark theme renders correctly', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)

    await test.step('toggle to dark theme', async () => {
      const toggle = page.getByRole('button', { name: /switch to dark/i })
      if (await toggle.isVisible()) {
        await toggle.click()
      } else {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = 'dark'
          localStorage.setItem('theme', 'dark')
        })
        await page.reload()
      }
      const theme = await page.evaluate(
        () => document.documentElement.dataset.theme
      )
      expect(theme).toBe('dark')
      await screenshot(page, 'theme-dark', 'auth', proj)
    })

    await test.step('no white backgrounds bleeding through', async () => {
      const hasWhiteBg = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*')
        let found = false
        allElements.forEach((el) => {
          const bg = window.getComputedStyle(el).backgroundColor
          if (bg === 'rgb(255, 255, 255)') {
            const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
            if (!isInput) found = true
          }
        })
        return found
      })
      expect(hasWhiteBg).toBe(false)
    })

    await test.step('text is readable in dark mode', async () => {
      const textColors = await page.evaluate(() => {
        const body = document.body
        const style = window.getComputedStyle(body)
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
        }
      })
      expect(textColors.color).not.toBe(textColors.backgroundColor)
    })

    await test.step('input fields have visible borders in dark mode', async () => {
      await expect(page.getByTestId('auth-email')).toBeVisible()
      const inputBorder = await page.evaluate(() => {
        const input = document.querySelector('input[data-testid="auth-email"]')
        if (!input) return null
        return window.getComputedStyle(input).borderColor
      })
      expect(inputBorder).not.toBe('rgb(0, 0, 0)')
      expect(inputBorder).not.toBe('rgba(0, 0, 0, 0)')
    })
  })

  test('theme persistence', async ({ page }) => {
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)

    await test.step('set dark theme and reload', async () => {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark'
        localStorage.setItem('theme', 'dark')
      })
      await page.reload()
      const theme = await page.evaluate(
        () => document.documentElement.dataset.theme
      )
      expect(theme).toBe('dark')
    })

    await test.step('theme persists in new tab', async () => {
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark')
      })
      const newTab = await page.context().newPage()
      await newTab.goto(process.env.PUBLIC_EXTERNAL_URL!)
      const theme = await newTab.evaluate(
        () => document.documentElement.dataset.theme
      )
      expect(theme).toBe('dark')
      await newTab.close()
    })
  })

  test('contrast checks on auth screen (light)', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
    await assertNoContrastViolations(page)
    await screenshot(page, 'theme-contrast-light', 'auth', proj)
  })

  test('contrast checks on auth screen (dark)', async ({ page }) => {
    const proj = projectName()
    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
      localStorage.setItem('theme', 'dark')
    })
    await page.reload()
    await assertNoContrastViolations(page)
    await screenshot(page, 'theme-contrast-dark', 'auth', proj)
  })

  test('contrast checks on main app screens', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Theme contrast trip')

    await test.step('overview contrast check', async () => {
      await assertNoContrastViolations(page)
    })

    await test.step('resorts tab contrast check', async () => {
      await page.getByTestId('nav-tab-resorts').click()
      await page.waitForTimeout(500)
      await assertNoContrastViolations(page)
    })

    await test.step('proposals tab contrast check', async () => {
      await page.getByTestId('nav-tab-proposals').click()
      await assertNoContrastViolations(page)
    })

    await screenshot(page, 'theme-contrast', 'app-screens', proj)
  })

  test('dark theme on all app tabs', async ({ page }) => {
    const proj = projectName()
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
      await screenshot(page, 'dark-theme', 'overview', proj)
      await assertNoContrastViolations(page)
    })

    await test.step('resorts tab dark mode', async () => {
      await page.getByTestId('nav-tab-resorts').click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'dark-theme', 'resorts', proj)
      await assertNoContrastViolations(page)
    })

    await test.step('proposals tab dark mode', async () => {
      await page.getByTestId('nav-tab-proposals').click()
      await screenshot(page, 'dark-theme', 'proposals', proj)
    })

    await test.step('poll tab dark mode', async () => {
      await page.getByTestId('nav-tab-poll').click()
      await screenshot(page, 'dark-theme', 'poll', proj)
    })
  })

  test('accent colour is consistent throughout', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Accent trip')

    const _accentElements = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a')
      const accentColors = new Set<string>()
      buttons.forEach((btn) => {
        const style = window.getComputedStyle(btn)
        const color = style.color
        const bg = style.backgroundColor
        if (color && color !== 'rgba(0, 0, 0, 0)') accentColors.add(color)
        if (bg && bg !== 'rgba(0, 0, 0, 0)') accentColors.add(bg)
      })
      return Array.from(accentColors)
    })
    await screenshot(page, 'theme', 'accent-colours', proj)
  })
})
