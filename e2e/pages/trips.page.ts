import { expect, type Locator, type Page } from '@playwright/test'

export class TripsPage {
  readonly page: Page
  readonly newTripButton: Locator
  readonly joinTripButton: Locator
  readonly tripDescriptionInput: Locator
  readonly saveTripButton: Locator
  readonly tripCodeInput: Locator
  readonly joinTripSubmitButton: Locator
  readonly inviteCode: Locator

  constructor(page: Page) {
    this.page = page
    this.newTripButton = page.getByTestId('new-trip-btn')
    this.joinTripButton = page.getByTestId('join-trip-btn')
    this.tripDescriptionInput = page.getByTestId('trip-description')
    this.saveTripButton = page.getByTestId('trip-save')
    this.tripCodeInput = page.getByTestId('trip-code')
    this.joinTripSubmitButton = page.getByTestId('trip-join')
    this.inviteCode = page.getByTestId('invite-code')
  }

  async createTrip(description: string) {
    await this.newTripButton.click()
    await this.tripDescriptionInput.fill(description)
    await this.saveTripButton.click()
    await expect(this.page.getByText(description)).toBeVisible()
  }

  async navigateToTrip(description: string) {
    await this.page.getByText(description).click()
    await expect(this.inviteCode).toBeVisible()
  }

  async createAndNavigateTo(description: string) {
    await this.createTrip(description)
    await this.navigateToTrip(description)
  }

  async joinTrip(code: string) {
    await this.joinTripButton.click()
    await this.tripCodeInput.fill(code)
    await this.joinTripSubmitButton.click()
  }

  async getInviteCode(): Promise<string> {
    await expect(this.inviteCode).not.toBeEmpty()
    const code = await this.inviteCode.textContent()
    return (code ?? '').trim()
  }
}
