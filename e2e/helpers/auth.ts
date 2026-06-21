import { expect, type Page } from '@playwright/test'
import { extractLink, waitForEmail } from './mailpit'

const BASE_URL = 'https://ski-tripper.localhost'

export function generateTestUser() {
  const id = crypto.randomUUID().slice(0, 8)
  return {
    name: `Test ${id}`,
    email: `test-${id}@ski-tripper.com`,
    password: 'TestPass123!',
  }
}

export async function signup(
  page: Page,
  user: { name: string; email: string; password: string }
): Promise<void> {
  await page.goto(BASE_URL)
  await page.getByRole('button', { name: /^sign up$/i }).click()
  await page.locator('input[name="name"]').fill(user.name)
  await page.locator('input[name="email"]').fill(user.email)
  await page.locator('input[name="password"]').fill(user.password)
  await page.getByRole('button', { name: /^sign up$/i }).click()
  await expect(
    page.getByRole('heading', { name: /verify your email/i })
  ).toBeVisible()
}

export async function login(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto(BASE_URL)
  await page.locator('input[name="email"]').fill(user.email)
  await page.locator('input[name="password"]').fill(user.password)
  await page
    .locator('form')
    .getByRole('button', { name: /^sign in$/i })
    .click()
}

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE_URL)
  await expect(page.locator('input[name="email"]')).toBeVisible()
}

export async function verifyEmail(page: Page, email: string): Promise<void> {
  const message = await waitForEmail(email, {
    subject: 'Verify',
  })
  const link = extractLink(message.HTML)
  const localLink = link.replace('https://ski-tripper.localhost', BASE_URL)
  await page.goto(localLink)
  await page.waitForURL(`${BASE_URL}/`)
}

export async function resetPassword(
  page: Page,
  email: string,
  newPassword: string
): Promise<void> {
  await page.goto(BASE_URL)
  await page.getByRole('button', { name: /forgot password/i }).click()
  await page.locator('input[name="email"]').fill(email)
  await page
    .locator('form')
    .getByRole('button', { name: /send reset link/i })
    .click()
  await expect(page.getByText(/sent a password reset link/i)).toBeVisible()

  const message = await waitForEmail(email, {
    subject: 'Reset',
  })
  const link = extractLink(message.HTML)
  const localLink = link.replace('https://ski-tripper.localhost', BASE_URL)

  await page.goto(localLink)
  await page.locator('input[name="password"]').first().fill(newPassword)
  await page.locator('input[name="confirmPassword"]').fill(newPassword)
  await page
    .locator('form')
    .getByRole('button', { name: /reset password/i })
    .click()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
}
