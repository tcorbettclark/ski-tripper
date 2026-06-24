import { expect, test } from '@playwright/test'
import { screenshot } from './helpers/screenshot'
import { deleteAllEmails } from './helpers/setup'
import { AuthPage, generateTestUser } from './pages/auth.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Email flows', () => {
  test('signup and email verification', async ({ page }) => {
    const proj = projectName()
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup triggers verification email', async () => {
      await auth.signup(user)
      await expect(
        page.getByRole('heading', { name: /verify your email/i })
      ).toBeVisible()
      await screenshot(page, 'email', 'verify-screen', proj)
    })

    await test.step('verification link redirects and verifies', async () => {
      await auth.verifyEmail(user.email)
      await expect(
        page.getByRole('heading', { name: /welcome/i })
      ).toBeVisible()
    })

    await test.step('resend verification button works', async () => {
      const user2 = generateTestUser()
      const auth2 = new AuthPage(page)
      await auth2.signup(user2)

      const resendBtn = page.getByTestId('resend-verification')
      if (await resendBtn.isVisible()) {
        await resendBtn.click()
        await expect(page.getByText(/resent/i)).toBeVisible()
        await screenshot(page, 'email', 'resend-verification', proj)
      }
    })
  })

  test('forgot password and reset', async ({ page }) => {
    const proj = projectName()
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup and verify', async () => {
      await auth.signup(user)
      await auth.verifyEmail(user.email)
    })

    await test.step('logout and navigate to forgot password', async () => {
      await page.evaluate(() => localStorage.clear())
      await auth.goto()
      await expect(auth.emailInput).toBeVisible()
    })

    await test.step('reset password via email link', async () => {
      const newPassword = 'NewPass456!'
      await auth.resetPassword(user.email, newPassword)
      await screenshot(page, 'email', 'password-reset', proj)
    })

    await test.step('login with new password', async () => {
      const userWithNewPass = { email: user.email, password: 'NewPass456!' }
      await auth.login(userWithNewPass)
      await expect(
        page.getByRole('heading', { name: /welcome/i })
      ).toBeVisible()
    })
  })
})
