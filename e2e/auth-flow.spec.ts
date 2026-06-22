import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { AuthPage, generateTestUser } from './pages/auth.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Auth flow', () => {
  test('signup, verify email, and login', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup', async () => {
      await auth.signup(user)
    })

    await test.step('verify email', async () => {
      await auth.verifyEmail(user.email)
    })

    await test.step('assert welcome screen after verification', async () => {
      await expect(
        page.getByRole('heading', { name: /welcome/i })
      ).toBeVisible()
    })

    await test.step('logout and assert auth form', async () => {
      await page.evaluate(() => localStorage.clear())
      await auth.goto()
      await expect(auth.emailInput).toBeVisible()
    })

    await test.step('login', async () => {
      await auth.login(user)
    })

    await test.step('assert welcome screen after login', async () => {
      await expect(
        page.getByRole('heading', { name: /welcome/i })
      ).toBeVisible()
    })
  })

  test('forgot password and reset', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()
    const newPassword = 'NewPass456!'

    await test.step('signup and verify', async () => {
      await auth.signup(user)
      await auth.verifyEmail(user.email)
    })

    await test.step('logout', async () => {
      await page.evaluate(() => localStorage.clear())
      await auth.goto()
      await expect(auth.emailInput).toBeVisible()
    })

    await test.step('reset password and login with new password', async () => {
      await auth.resetPassword(user.email, newPassword)
      await auth.login({ email: user.email, password: newPassword })
      await expect(
        page.getByRole('heading', { name: /welcome/i })
      ).toBeVisible()
    })
  })

  test('unverified user sees verification screen and can resend', async ({
    page,
  }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup', async () => {
      await auth.signup(user)
    })

    await test.step('resend verification', async () => {
      const resendBtn = page.getByTestId('resend-verification')
      await resendBtn.click()
      await expect(page.getByText(/verification email resent/i)).toBeVisible()
    })

    await test.step('verify email and assert screen gone', async () => {
      await auth.verifyEmail(user.email)
      await expect(
        page.getByRole('heading', { name: /verify your email/i })
      ).not.toBeVisible()
    })
  })
})
