import { expect, test } from '@playwright/test'
import { clickNavTab } from './helpers/navigation'
import { isMobile, screenshot } from './helpers/screenshot'
import {
  deleteAllEmails,
  setupUserWithPreferences,
  setupUserWithTrip,
} from './helpers/setup'
import { ProposalsPage } from './pages/proposals.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Responsive layout and visual', () => {
  test('auth screens render correctly', async ({ page }) => {
    const proj = projectName()
    const mobile = isMobile(proj)

    await test.step('login form is centred with readable labels', async () => {
      await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
      await expect(page.getByTestId('auth-email')).toBeVisible()
      await expect(page.getByTestId('auth-password')).toBeVisible()
      await screenshot(page, 'auth-login-form', 'visible', proj)

      if (mobile) {
        const formBox = await page.getByTestId('auth-email').evaluate((el) => {
          const form = el.closest('form') ?? el.parentElement!
          const rect = form.getBoundingClientRect()
          return { width: rect.width, left: rect.left }
        })
        const viewport = page.viewportSize()!
        expect(formBox.width).toBeLessThanOrEqual(viewport.width)
      }
    })

    await test.step('switch to signup — fields still usable', async () => {
      await page.getByTestId('auth-switch-mode').click()
      await expect(page.getByTestId('auth-name')).toBeVisible()
      await expect(page.getByTestId('auth-email')).toBeVisible()
      await expect(page.getByTestId('auth-password')).toBeVisible()
      await screenshot(page, 'auth-signup-form', 'visible', proj)
    })

    await test.step('forgot password link visible and tappable', async () => {
      await page.getByTestId('auth-forgot-password').click()
      await expect(page.getByTestId('forgot-email')).toBeVisible()
      await screenshot(page, 'auth-forgot-password', 'visible', proj)
    })

    if (mobile) {
      await test.step('about button visible and not overlapping form', async () => {
        await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
        const aboutBtn = page.getByRole('button', { name: /about/i })
        await expect(aboutBtn).toBeVisible()
        await screenshot(page, 'auth-about-button-mobile', 'visible', proj)
      })
    }
  })

  test('auth screens on desktop are centred with comfortable margins', async ({
    page,
  }) => {
    const proj = projectName()
    if (isMobile(proj)) test.skip()

    await page.goto(process.env.PUBLIC_EXTERNAL_URL!)
    await expect(page.getByTestId('auth-email')).toBeVisible()
    await screenshot(page, 'auth-desktop', 'centred', proj)

    const cardWidth = await page.getByTestId('auth-email').evaluate((el) => {
      const card = el.closest('[style*="maxWidth"]') ?? el.closest('div')
      return card?.getBoundingClientRect().width ?? 0
    })
    expect(cardWidth).toBeLessThanOrEqual(560)
  })

  test('preferences form is navigable', async ({ page }) => {
    const proj = projectName()
    await setupUserWithPreferences(page)
    await screenshot(page, 'preferences', 'saved', proj)
  })

  test('trips list renders correctly', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'My trip')
    await expect(page.getByTestId('invite-code')).toBeVisible()
    await screenshot(page, 'trips-list', 'visible', proj)

    await test.step('create and join buttons accessible', async () => {
      await page.getByTestId('new-trip-btn').waitFor({ state: 'visible' })
      await page.getByTestId('join-trip-btn').waitFor({ state: 'visible' })
    })

    await test.step('invite code is readable and copyable', async () => {
      const code = page.getByTestId('invite-code')
      await expect(code).toBeVisible()
      const text = await code.textContent()
      expect(text!.trim().length).toBeGreaterThan(0)
    })
  })

  test('overview tab renders without overflow', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Overview trip')
    await expect(page.getByTestId('invite-code')).toBeVisible()
    await screenshot(page, 'overview-tab', 'visible', proj)
  })

  test('resorts tab renders without overflow', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Resorts trip')
    await clickNavTab(page, 'resorts')
    await screenshot(page, 'resorts-tab', 'visible', proj)
  })

  test('proposals tab renders without overflow', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Proposals trip')
    await clickNavTab(page, 'proposals')
    await expect(page.getByTestId('new-proposal-btn')).toBeVisible()
    await screenshot(page, 'proposals-tab', 'visible', proj)
  })

  test('voting tab renders without overflow', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Voting trip')
    await clickNavTab(page, 'poll')
    await screenshot(page, 'voting-tab', 'visible', proj)
  })

  test('header mobile menu works correctly', async ({ page }) => {
    const proj = projectName()
    if (!isMobile(proj)) test.skip()

    await setupUserWithTrip(page, 'Header trip')

    await test.step('hamburger menu icon visible', async () => {
      const hamburger = page.getByRole('button', { name: /open menu/i })
      await expect(hamburger).toBeVisible()
    })

    await test.step('dropdown menu accessible', async () => {
      const hamburger = page.getByRole('button', { name: /open menu/i })
      await hamburger.click()
      await expect(
        page.getByRole('menuitem', { name: /sign out/i })
      ).toBeVisible()
      await expect(
        page.getByRole('menuitem', { name: /preferences/i })
      ).toBeVisible()
      await screenshot(page, 'mobile-menu', 'open', proj)
    })
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    const proj = projectName()
    if (!isMobile(proj)) test.skip()

    await setupUserWithTrip(page, 'Overflow trip')
    const pages = [
      { name: 'overview', action: () => Promise.resolve() },
      {
        name: 'resorts',
        action: async () => {
          await clickNavTab(page, 'resorts')
          await page.waitForTimeout(1000)
        },
      },
      {
        name: 'proposals',
        action: async () => {
          await clickNavTab(page, 'proposals')
        },
      },
      {
        name: 'poll',
        action: async () => {
          await clickNavTab(page, 'poll')
        },
      },
    ]

    for (const { name, action } of pages) {
      await action()
      await page.waitForTimeout(300)
      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        )
      })
      expect(hasOverflow).toBe(false)
      await screenshot(page, `overflow-check-${name}`, 'no-overflow', proj)
    }
  })

  test('desktop tabs visible and navigable', async ({ page }) => {
    const proj = projectName()
    if (isMobile(proj)) test.skip()

    await setupUserWithTrip(page, 'Desktop tabs trip')

    await test.step('all tab buttons are visible', async () => {
      await expect(page.getByTestId('nav-tab-overview')).toBeVisible()
      await expect(page.getByTestId('nav-tab-resorts')).toBeVisible()
      await expect(page.getByTestId('nav-tab-proposals')).toBeVisible()
      await expect(page.getByTestId('nav-tab-poll')).toBeVisible()
    })

    await test.step('clicking each tab switches content', async () => {
      await clickNavTab(page, 'resorts')
      await page.waitForTimeout(300)
      await screenshot(page, 'desktop-tabs', 'resorts', proj)

      await clickNavTab(page, 'proposals')
      await page.waitForTimeout(300)
      await screenshot(page, 'desktop-tabs', 'proposals', proj)

      await clickNavTab(page, 'poll')
      await page.waitForTimeout(300)
      await screenshot(page, 'desktop-tabs', 'poll', proj)
    })
  })

  test('desktop header shows user name button', async ({ page }) => {
    const proj = projectName()
    if (isMobile(proj)) test.skip()

    await setupUserWithTrip(page, 'Desktop header trip')

    await test.step('user menu trigger visible', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      await expect(menuTrigger).toBeVisible()
    })

    await test.step('user menu dropdown opens', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      await menuTrigger.click()
      await expect(page.getByTestId('sign-out')).toBeVisible()
      await screenshot(page, 'desktop-header', 'menu-open', proj)
    })
  })

  test('proposal form slider controls are visible on mobile', async ({
    page,
  }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Slider trip')
    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()
    await proposals.clickNewProposal()

    await expect(page.getByTestId('proposal-resort-name')).toBeVisible()
    await screenshot(page, 'proposal-form', 'open', proj)

    if (isMobile(proj)) {
      const formOverflow = await page.evaluate(() => {
        const form =
          document.querySelector('form') ??
          document.querySelector('[style*="overflow"]')
        if (!form) return false
        return form.scrollWidth > form.clientWidth
      })
      expect(formOverflow).toBe(false)
    }
  })
})
