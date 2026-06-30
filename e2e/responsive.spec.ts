import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import {
  clickNavTab,
  navigateToMyTrips,
  waitForAnimation,
} from './helpers/navigation'
import { setupUserWithPreferences, setupUserWithTrip } from './helpers/setup'
import { snapshotOptions } from './helpers/snapshot'
import { ProposalsPage } from './pages/proposals.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Responsive layout and visual', () => {
  test('auth screens mobile layout', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 390)

    await page.goto('/')
    await expect(page.getByTestId('auth-email')).toBeVisible()

    await test.step('about button visible and not overlapping form', async () => {
      const aboutBtn = page.getByRole('button', { name: /about/i })
      await expect(aboutBtn).toBeVisible()
      await expect(page).toHaveScreenshot(
        'auth-about-button-mobile.png',
        snapshotOptions.auth(page)
      )
    })

    await test.step('login form fits viewport', async () => {
      const formBox = await page.getByTestId('auth-email').evaluate((el) => {
        const form = el.closest('form') ?? el.parentElement!
        const rect = form.getBoundingClientRect()
        return { width: rect.width, left: rect.left }
      })
      const viewport = page.viewportSize()!
      expect(formBox.width).toBeLessThanOrEqual(viewport.width)
    })
  })

  test('preferences form is navigable', async ({ page }) => {
    await setupUserWithPreferences(page)
    await expect(page).toHaveScreenshot(
      'preferences-saved.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('trips list renders correctly', async ({ page }) => {
    await setupUserWithTrip(page, 'My trip')
    await expect(page.getByTestId('invite-code')).toBeVisible()
    await navigateToMyTrips(page)
    await expect(page).toHaveScreenshot(
      'trips-list.png',
      snapshotOptions.loggedIn(page)
    )

    await test.step('create and join buttons accessible', async () => {
      await page.getByTestId('new-trip-btn').waitFor({ state: 'visible' })
      await page.getByTestId('join-trip-btn').waitFor({ state: 'visible' })
    })

    await test.step('invite code is readable and copyable on specific trip', async () => {
      await page.getByRole('cell', { name: 'My trip' }).click()
      const code = page.getByTestId('invite-code')
      await expect(code).toBeVisible()
      const text = await code.textContent()
      expect(text!.trim().length).toBeGreaterThan(0)
    })
  })

  test('overview tab renders without overflow', async ({ page }) => {
    await setupUserWithTrip(page, 'Overview trip')
    await expect(page.getByTestId('invite-code')).toBeVisible()
    await expect(page).toHaveScreenshot(
      'overview-tab.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('resorts tab renders without overflow', async ({ page }) => {
    await setupUserWithTrip(page, 'Resorts trip')
    await clickNavTab(page, 'resorts')
    await expect(page).toHaveScreenshot(
      'resorts-tab.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('proposals tab renders without overflow', async ({ page }) => {
    await setupUserWithTrip(page, 'Proposals trip')
    await clickNavTab(page, 'proposals')
    await expect(page.getByTestId('new-proposal-btn')).toBeVisible()
    await expect(page).toHaveScreenshot(
      'proposals-tab.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('voting tab renders without overflow', async ({ page }) => {
    await setupUserWithTrip(page, 'Voting trip')
    await clickNavTab(page, 'voting')
    await expect(page).toHaveScreenshot(
      'voting-tab.png',
      snapshotOptions.loggedIn(page)
    )
  })

  test('header mobile menu works correctly', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 390)

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
      await expect(page).toHaveScreenshot(
        'mobile-menu-open.png',
        snapshotOptions.loggedIn(page)
      )
    })
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 390)

    await setupUserWithTrip(page, 'Overflow trip')
    const pages = [
      { name: 'overview', action: () => Promise.resolve() },
      {
        name: 'resorts',
        action: async () => {
          await clickNavTab(page, 'resorts')
          await waitForAnimation(page, 1000)
        },
      },
      {
        name: 'proposals',
        action: async () => {
          await clickNavTab(page, 'proposals')
        },
      },
      {
        name: 'voting',
        action: async () => {
          await clickNavTab(page, 'voting')
        },
      },
    ]

    for (const { name, action } of pages) {
      await action()
      await waitForAnimation(page)
      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        )
      })
      expect(hasOverflow).toBe(false)
      await expect(page).toHaveScreenshot(
        `overflow-check-${name}.png`,
        snapshotOptions.loggedIn(page)
      )
    }
  })

  test('desktop tabs visible and navigable', async ({ page }) => {
    test.skip(page.viewportSize()?.width === 390)

    await setupUserWithTrip(page, 'Desktop tabs trip')

    await test.step('all tab buttons are visible', async () => {
      await expect(page.getByTestId('nav-tab-overview')).toBeVisible()
      await expect(page.getByTestId('nav-tab-resorts')).toBeVisible()
      await expect(page.getByTestId('nav-tab-proposals')).toBeVisible()
      await expect(page.getByTestId('nav-tab-voting')).toBeVisible()
    })

    await test.step('clicking each tab switches content', async () => {
      await clickNavTab(page, 'resorts')
      await waitForAnimation(page)
      await expect(page).toHaveScreenshot(
        'desktop-tabs-resorts.png',
        snapshotOptions.loggedIn(page)
      )

      await clickNavTab(page, 'proposals')
      await waitForAnimation(page)
      await expect(page).toHaveScreenshot(
        'desktop-tabs-proposals.png',
        snapshotOptions.loggedIn(page)
      )

      await clickNavTab(page, 'voting')
      await waitForAnimation(page)
      await expect(page).toHaveScreenshot(
        'desktop-tabs-voting.png',
        snapshotOptions.loggedIn(page)
      )
    })
  })

  test('desktop header shows user name button', async ({ page }) => {
    test.skip(page.viewportSize()?.width === 390)

    await setupUserWithTrip(page, 'Desktop header trip')

    await test.step('user menu trigger visible', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      await expect(menuTrigger).toBeVisible()
    })

    await test.step('user menu dropdown opens', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      await menuTrigger.click()
      await expect(page.getByTestId('sign-out')).toBeVisible()
      await expect(page).toHaveScreenshot(
        'desktop-header-menu-open.png',
        snapshotOptions.loggedIn(page)
      )
    })
  })

  test('proposal form slider controls are visible on mobile', async ({
    page,
  }) => {
    await setupUserWithTrip(page, 'Slider trip')
    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()
    await proposals.clickNewProposal()

    await expect(page.getByTestId('proposal-resort-name')).toBeVisible()
    await expect(page).toHaveScreenshot(
      'proposal-form-open.png',
      snapshotOptions.loggedIn(page)
    )

    if (page.viewportSize()?.width === 390) {
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
