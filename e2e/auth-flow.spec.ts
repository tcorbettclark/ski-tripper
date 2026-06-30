import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { screenshot } from './helpers/screenshot'
import { AuthPage, generateTestUser } from './pages/auth.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

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
      await page.evaluate(() => {
        localStorage.clear()
        const pb = (
          window as unknown as Record<
            string,
            { authStore: { clear: () => void } }
          >
        ).__pocketbase__
        if (pb) pb.authStore.clear()
      })
      await auth.goto()
      await expect(auth.emailInput).toBeVisible()
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
})
