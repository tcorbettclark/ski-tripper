import { expect, test } from '@playwright/test'
import {
  generateTestUser,
  login,
  logout,
  resetPassword,
  signup,
  verifyEmail,
} from './helpers/auth'
import { deleteAllEmails } from './helpers/mailpit'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Auth flow', () => {
  test('signup, verify email, and login', async ({ page }) => {
    const user = generateTestUser()

    await signup(page, user)
    await verifyEmail(page, user.email)

    // After verification, user is already authenticated
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()

    // Log out and log back in to verify credentials work
    await logout(page)
    await login(page, user)
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
  })

  test('forgot password and reset', async ({ page }) => {
    const user = generateTestUser()
    const newPassword = 'NewPass456!'

    await signup(page, user)
    await verifyEmail(page, user.email)

    // Log out before resetting password
    await logout(page)
    await resetPassword(page, user.email, newPassword)

    await login(page, { email: user.email, password: newPassword })
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
  })

  test('unverified user sees verification screen and can resend', async ({
    page,
  }) => {
    const user = generateTestUser()

    await signup(page, user)

    await page.getByRole('button', { name: /resend/i }).click()
    await expect(page.getByText(/verification email resent/i)).toBeVisible()

    await verifyEmail(page, user.email)
    await expect(
      page.getByRole('heading', { name: /verify your email/i })
    ).not.toBeVisible()
  })
})
