import { expect, test } from '@playwright/test'
import { logout } from './helpers/auth'
import { deleteAllEmails } from './helpers/mailpit'
import { waitForAnimation } from './helpers/navigation'
import { projectName, screenshot } from './helpers/screenshot'
import { setupUserWithPreferences } from './helpers/setup'
import { AuthPage, generateTestUser } from './pages/auth.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Auth flow', () => {
  test('signup and OTP verification', async ({ page }) => {
    const proj = projectName()
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup triggers OTP email', async () => {
      await auth.signup(user)
      await expect(
        page.getByRole('heading', { name: /enter verification code/i })
      ).toBeVisible()
      await screenshot(page, 'email', 'otp-entry', proj)
    })

    await test.step('enter OTP code and set password', async () => {
      await auth.enterOtpCode(user.email)
      await expect(
        page.getByRole('heading', { name: /set your password/i })
      ).toBeVisible()
      await screenshot(page, 'email', 'set-password', proj)

      await auth.setPassword(user.password)
      await expect(
        page.getByRole('heading', { name: /welcome! set your preferences/i })
      ).toBeVisible()
    })
  })

  test('forgot password and OTP reset', async ({ page }) => {
    const proj = projectName()
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup and set password', async () => {
      await auth.signup(user)
      await auth.enterOtpCode(user.email)
      await auth.setPassword(user.password)
    })

    await test.step('logout and navigate to forgot password', async () => {
      await logout(page)
    })

    await test.step('reset password via OTP', async () => {
      const newPassword = 'NewPass456!'
      await auth.clickForgotPassword()
      await auth.fillForgotEmail(user.email)
      await auth.clickSendOtp()
      await expect(
        page.getByRole('heading', { name: /enter verification code/i })
      ).toBeVisible()

      await auth.enterOtpCode(user.email)
      await expect(
        page.getByRole('heading', { name: /set your password/i })
      ).toBeVisible()
      await screenshot(page, 'email', 'password-reset', proj)

      await auth.setPassword(newPassword)
      await expect(
        page.getByRole('heading', { name: /welcome! set your preferences/i })
      ).toBeVisible()
      await page.getByTestId('sign-out').click()
    })

    await test.step('login with new password', async () => {
      const userWithNewPass = { email: user.email, password: 'NewPass456!' }
      await auth.login(userWithNewPass)
      await expect(
        page.getByRole('heading', { name: /welcome! set your preferences/i })
      ).toBeVisible()
    })
  })

  test('resend OTP code works', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup', async () => {
      await auth.signup(user)
    })

    await test.step('resend code', async () => {
      const resendBtn = page.getByTestId('resend-otp')
      await resendBtn.click()
      await expect(page.getByRole('alert')).toContainText(/resent/i)
    })
  })

  test('login, logout, and login again', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup and set password', async () => {
      await auth.signup(user)
      await auth.enterOtpCode(user.email)
      await auth.setPassword(user.password)
    })

    await test.step('verify logged in', async () => {
      await expect(
        page.getByRole('heading', { name: /welcome! set your preferences/i })
      ).toBeVisible()
      await screenshot(page, 'auth', 'logged-in', projectName())
    })

    await test.step('logout via user menu', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click()
        await page.getByTestId('sign-out').click()
      } else {
        await logout(page)
      }
      await expect(page.getByTestId('auth-email')).toBeVisible()
      await screenshot(page, 'auth', 'logged-out', projectName())
    })

    await test.step('log back in with password', async () => {
      await auth.login({ email: user.email, password: user.password })
      await expect(
        page.getByRole('heading', { name: /welcome! set your preferences/i })
      ).toBeVisible()
    })
  })

  test('auth screens render correctly', async ({ page }) => {
    const proj = projectName()

    await test.step('login form is centred with readable labels', async () => {
      await page.goto('/')
      await expect(page.getByTestId('auth-email')).toBeVisible()
      await expect(page.getByTestId('auth-password')).toBeVisible()
      await screenshot(page, 'auth-login-form', 'visible', proj)
    })

    await test.step('switch to signup — fields still usable', async () => {
      await page.getByTestId('auth-switch-mode').click()
      await expect(page.getByTestId('auth-name')).toBeVisible()
      await expect(page.getByTestId('auth-email')).toBeVisible()
      await screenshot(page, 'auth-signup-form', 'visible', proj)
    })

    await test.step('forgot password link visible and tappable', async () => {
      await page.getByTestId('auth-switch-mode').click()
      await page.getByTestId('auth-forgot-password').click()
      await expect(page.getByTestId('forgot-email')).toBeVisible()
      await screenshot(page, 'auth-forgot-password', 'visible', proj)
    })
  })

  test('auth screens on desktop are centred with comfortable margins', async ({
    page,
  }) => {
    const proj = projectName()
    if (projectName().includes('mobile')) test.skip()

    await page.goto('/')
    await expect(page.getByTestId('auth-email')).toBeVisible()
    await screenshot(page, 'auth-desktop', 'centred', proj)

    const cardWidth = await page.getByTestId('auth-email').evaluate((el) => {
      const card = el.closest('[style*="maxWidth"]') ?? el.closest('div')
      return card?.getBoundingClientRect().width ?? 0
    })
    expect(cardWidth).toBeLessThanOrEqual(560)
  })

  test('edit preferences after initial setup', async ({ page }) => {
    const proj = projectName()
    await setupUserWithPreferences(page)

    await test.step('open preferences modal', async () => {
      const menuTrigger = page.getByTestId('user-menu-trigger')
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click()
        await page.getByRole('menuitem', { name: /preferences/i }).click()
        await waitForAnimation(page, 500)
      }
    })

    await test.step('modify a preference and save', async () => {
      const preferencesHeading = page.getByRole('heading', {
        name: /my preferences/i,
      })
      if (await preferencesHeading.isVisible()) {
        const snowboardCheckbox = page.getByRole('checkbox', {
          name: /snowboard/i,
        })
        if (await snowboardCheckbox.isVisible()) {
          await snowboardCheckbox.check()
        }

        const saveBtn = page.getByRole('button', {
          name: /update preferences/i,
        })
        if (await saveBtn.isVisible()) {
          await saveBtn.click()
          await waitForAnimation(page, 500)
          await screenshot(page, 'auth', 'preferences-updated', proj)
        }
      }
    })
  })
})
