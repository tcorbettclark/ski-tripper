import { expect, type Locator, type Page } from '@playwright/test'
import { extractOtp, waitForEmail } from '../helpers/mailpit'

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
    await this.page.goto('/')
  }

  async waitForLoginForm() {
    await expect(this.emailInput).toBeVisible()
  }

  async signup(user: { name: string; email: string }) {
    await this.goto()
    await this.waitForLoginForm()
    await this.switchModeButton.click()
    await this.nameInput.fill(user.name)
    await this.emailInput.fill(user.email)
    await this.submitButton.click()
    await expect(
      this.page.getByRole('heading', { name: /enter verification code/i })
    ).toBeVisible()
  }

  async enterOtpCode(email: string) {
    const message = await waitForEmail(email, { subject: 'verification code' })
    const code = extractOtp(message.HTML)
    await this.page.getByTestId('otp-code').fill(code)
    await this.page.getByRole('button', { name: /verify/i }).click()
  }

  async setPassword(password: string) {
    await this.page.getByTestId('set-password').fill(password)
    await this.page.getByTestId('set-confirm-password').fill(password)
    await this.page.getByTestId('set-password-submit').click()
  }

  async login(user: { email: string; password: string }) {
    await this.goto()
    await this.waitForLoginForm()
    await this.emailInput.fill(user.email)
    await this.passwordInput.fill(user.password)
    await this.submitButton.click()
  }

  async clickForgotPassword() {
    await this.forgotPasswordButton.click()
  }

  async fillForgotEmail(email: string) {
    await this.page.getByTestId('forgot-email').fill(email)
  }

  async clickSendOtp() {
    await this.page.getByTestId('send-otp').click()
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
