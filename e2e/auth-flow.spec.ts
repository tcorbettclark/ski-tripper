import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { AuthPage, generateTestUser } from './pages/auth.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Auth flow', () => {
  test('signup with OTP and set password', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup', async () => {
      await auth.signup(user)
    })

    await test.step('enter OTP code', async () => {
      await auth.enterOtpCode(user.email)
      await expect(
        page.getByRole('heading', { name: /set your password/i })
      ).toBeVisible()
    })

    await test.step('set password', async () => {
      await auth.setPassword(user.password)
      await expect(
        page.getByRole('heading', { name: /sign in/i })
      ).toBeVisible()
    })

    await test.step('login with new password', async () => {
      await auth.login({ email: user.email, password: user.password })
      await expect(
        page.getByRole('heading', { name: /welcome/i })
      ).toBeVisible()
    })
  })

  test('forgot password with OTP', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await test.step('signup and set password', async () => {
      await auth.signup(user)
      await auth.enterOtpCode(user.email)
      await auth.setPassword(user.password)
    })

    await test.step('logout', async () => {
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
        page.getByRole('heading', { name: /set new password/i })
      ).toBeVisible()

      await auth.setPassword(newPassword)
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
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
      await expect(page.getByText(/verification code resent/i)).toBeVisible()
    })
  })
})
