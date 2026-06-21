import { expect, type Locator, type Page } from '@playwright/test'

export class ProposalsPage {
  readonly page: Page
  readonly resortNameInput: Locator
  readonly submitButton: Locator
  readonly cancelButton: Locator
  readonly proposalSubmitBtn: Locator
  readonly proposalDeleteBtn: Locator
  readonly newProposalBtn: Locator
  readonly proposalsTab: Locator

  constructor(page: Page) {
    this.page = page
    this.resortNameInput = page.getByTestId('proposal-resort-name')
    this.submitButton = page.getByTestId('proposal-submit')
    this.cancelButton = page.getByTestId('proposal-cancel')
    this.proposalSubmitBtn = page.getByTestId('proposal-submit-btn')
    this.proposalDeleteBtn = page.getByTestId('proposal-delete')
    this.newProposalBtn = page.getByTestId('new-proposal-btn')
    this.proposalsTab = page.getByTestId('nav-tab-proposals')
  }

  async goToProposalsTab() {
    await this.proposalsTab.click()
  }

  async clickNewProposal() {
    await this.newProposalBtn.click()
  }

  async selectFutureDates() {
    const now = new Date()
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 5
    )
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 8
    )

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    await this.page.locator(`[data-day="${startStr}"]`).click()
    await this.page.locator(`[data-day="${endStr}"]`).click()
  }

  async fillResortProposal(data: {
    resortName: string
    country?: string
    region?: string
    summitAltitude?: string
    baseAltitude?: string
    nearestAirport?: string
    transferTime?: string
    pisteKm?: string
    beginnerPct?: string
    intermediatePct?: string
    advancedPct?: string
    liftCount?: string
    snowReliability?: string
    skiSeasonMonths?: string
    websites?: string
    latitude?: string
    longitude?: string
    description?: string
  }) {
    await this.resortNameInput.fill(data.resortName)

    if (data.country) {
      await this.page.locator('select[name="country"]').selectOption({
        label: data.country,
      })
    }
    if (data.region) {
      await this.page.locator('input[name="region"]').fill(data.region)
    }
    if (data.summitAltitude) {
      await this.page
        .locator('input[name="summitAltitude"]')
        .fill(data.summitAltitude)
    }
    if (data.baseAltitude) {
      await this.page
        .locator('input[name="baseAltitude"]')
        .fill(data.baseAltitude)
    }
    if (data.nearestAirport) {
      await this.page
        .locator('input[name="nearestAirport"]')
        .fill(data.nearestAirport)
    }
    if (data.transferTime) {
      await this.page
        .locator('input[name="transferTime"]')
        .fill(data.transferTime)
    }
    if (data.pisteKm) {
      await this.page.locator('input[name="pisteKm"]').fill(data.pisteKm)
    }
    if (data.beginnerPct) {
      await this.page
        .locator('input[name="beginnerPct"]')
        .fill(data.beginnerPct)
    }
    if (data.intermediatePct) {
      await this.page
        .locator('input[name="intermediatePct"]')
        .fill(data.intermediatePct)
    }
    if (data.advancedPct) {
      await this.page
        .locator('input[name="advancedPct"]')
        .fill(data.advancedPct)
    }
    if (data.liftCount) {
      await this.page.locator('input[name="liftCount"]').fill(data.liftCount)
    }
    if (data.snowReliability) {
      await this.page
        .locator('select[name="snowReliability"]')
        .selectOption(data.snowReliability)
    }
    if (data.skiSeasonMonths) {
      await this.page
        .locator('input[name="skiSeasonMonths"]')
        .fill(data.skiSeasonMonths)
    }
    if (data.websites) {
      await this.page.locator('input[name="websites"]').fill(data.websites)
    }
    if (data.latitude) {
      await this.page.locator('input[name="latitude"]').fill(data.latitude)
    }
    if (data.longitude) {
      await this.page.locator('input[name="longitude"]').fill(data.longitude)
    }
    if (data.description) {
      await this.page
        .locator('textarea[name="description"]')
        .fill(data.description)
    }

    await this.selectFutureDates()
  }

  async createDraftProposal(resortName: string) {
    await this.clickNewProposal()
    await this.fillResortProposal({
      resortName,
      country: 'France',
      region: 'Alps',
      summitAltitude: '3330',
      baseAltitude: '1500',
      nearestAirport: 'GVA',
      transferTime: '90',
      pisteKm: '600',
      beginnerPct: '25',
      intermediatePct: '50',
      advancedPct: '25',
      liftCount: '50',
      snowReliability: 'medium',
      skiSeasonMonths: 'Dec-Apr',
      websites: 'https://chamonix.com',
      latitude: '45.97',
      longitude: '6.87',
      description: 'Great resort',
    })
    await this.submitButton.click()
    await expect(this.page.getByText(resortName).first()).toBeVisible()
  }

  async addAccommodation(name: string) {
    await this.page
      .getByRole('button', { name: /^accommodations/i })
      .first()
      .click()
    await this.page.getByTestId('add-accommodation-btn').click()
    await this.page.locator('#acc-name').fill(name)
    await this.page.getByTestId('acc-save-btn').click()
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 })
  }

  async dismissSubmitDialog() {
    await this.page.getByRole('button', { name: /^ok$/i }).click()
  }

  async submitProposal() {
    await this.proposalSubmitBtn.click()
    await expect(this.page.getByText(/submitted/i)).toBeVisible()
  }
}
