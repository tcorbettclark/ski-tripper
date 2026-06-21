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

    await auth.signup(user)
    await auth.verifyEmail(user.email)

    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()

    await page.evaluate(() => localStorage.clear())
    await auth.goto()
    await expect(auth.emailInput).toBeVisible()

    await auth.login(user)
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
  })

  test('forgot password and reset', async ({ page }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()
    const newPassword = 'NewPass456!'

    await auth.signup(user)
    await auth.verifyEmail(user.email)

    await page.evaluate(() => localStorage.clear())
    await auth.goto()
    await expect(auth.emailInput).toBeVisible()

    await auth.resetPassword(user.email, newPassword)
    await auth.login({ email: user.email, password: newPassword })
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
  })

  test('unverified user sees verification screen and can resend', async ({
    page,
  }) => {
    const auth = new AuthPage(page)
    const user = generateTestUser()

    await auth.signup(user)

    await page.getByTestId('resend-verification').click()
    await expect(page.getByText(/verification email resent/i)).toBeVisible()

    await auth.verifyEmail(user.email)
    await expect(
      page.getByRole('heading', { name: /verify your email/i })
    ).not.toBeVisible()
  })
})
