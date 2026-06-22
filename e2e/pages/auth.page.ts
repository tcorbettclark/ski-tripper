import { expect, type Locator, type Page } from '@playwright/test'
import { extractLink, waitForEmail } from '../helpers/mailpit'

const BASE_URL = 'https://ski-tripper.localhost'

export class AuthPage {
  readonly page: Page
  readonly nameInput: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly switchModeButton: Locator
  readonly forgotPasswordButton: Locator

  constructor(page: Page) {
    this.page = page
    this.nameInput = page.getByTestId('auth-name')
    this.emailInput = page.getByTestId('auth-email')
    this.passwordInput = page.getByTestId('auth-password')
    this.submitButton = page.getByTestId('auth-submit')
    this.switchModeButton = page.getByTestId('auth-switch-mode')
    this.forgotPasswordButton = page.getByTestId('auth-forgot-password')
  }

  async goto() {
    await this.page.goto(BASE_URL)
    await expect(this.emailInput).toBeVisible()
  }

  async signup(user: { name: string; email: string; password: string }) {
    await this.goto()
    await this.switchModeButton.click()
    await this.nameInput.fill(user.name)
    await this.emailInput.fill(user.email)
    await this.passwordInput.fill(user.password)
    await this.submitButton.click()
    await expect(this.submitButton).toBeEnabled()
    await expect(
      this.page.getByRole('heading', { name: /verify your email/i })
    ).toBeVisible()
  }

  async login(user: { email: string; password: string }) {
    await this.goto()
    await this.emailInput.fill(user.email)
    await this.passwordInput.fill(user.password)
    await this.submitButton.click()
    await expect(this.submitButton).toBeEnabled()
  }

  async clickForgotPassword() {
    await this.forgotPasswordButton.click()
  }

  async fillForgotEmail(email: string) {
    await this.page.getByTestId('forgot-email').fill(email)
  }

  async clickSendResetLink() {
    await this.page.getByTestId('send-reset-link').click()
  }

  async fillResetPassword(password: string) {
    await this.page.getByTestId('reset-password').fill(password)
    await this.page.getByTestId('reset-confirm-password').fill(password)
  }

  async clickResetSubmit() {
    await this.page.getByTestId('reset-submit').click()
  }

  async verifyEmail(email: string) {
    const message = await waitForEmail(email, { subject: 'Verify' })
    const link = extractLink(message.HTML)
    const localLink = link.replace('https://ski-tripper.localhost', BASE_URL)
    await this.page.goto(localLink)
    await this.page.waitForURL(`${BASE_URL}/`)
  }

  async resetPassword(email: string, newPassword: string) {
    await this.goto()
    await this.clickForgotPassword()
    await this.fillForgotEmail(email)
    await this.clickSendResetLink()
    await expect(
      this.page.getByText(/sent a password reset link/i)
    ).toBeVisible()

    const message = await waitForEmail(email, { subject: 'Reset' })
    const link = extractLink(message.HTML)
    const localLink = link.replace('https://ski-tripper.localhost', BASE_URL)
    await this.page.goto(localLink)
    await expect(this.page.getByTestId('reset-password')).toBeVisible()

    await this.fillResetPassword(newPassword)
    await this.clickResetSubmit()
    await expect(
      this.page.getByRole('button', { name: /sign in/i })
    ).toBeVisible()
  }
}

export function generateTestUser() {
  const id = crypto.randomUUID().slice(0, 8)
  return {
    name: `Test ${id}`,
    email: `test-${id}@ski-tripper.com`,
    password: 'TestPass123!',
  }
}
