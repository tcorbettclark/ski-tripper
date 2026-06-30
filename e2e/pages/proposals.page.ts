import { expect, type Locator, type Page } from '@playwright/test'
import { clickNavTab } from '../helpers/navigation'
import { waitForToast } from '../helpers/toast'

export class ProposalsPage {
  readonly page: Page
  readonly resortNameInput: Locator
  readonly submitButton: Locator
  readonly cancelButton: Locator
  readonly proposalSubmitBtn: Locator
  readonly proposalDeleteBtn: Locator
  readonly newProposalBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.resortNameInput = page.getByTestId('proposal-resort-name')
    this.submitButton = page.getByTestId('proposal-submit')
    this.cancelButton = page.getByTestId('proposal-cancel')
    this.proposalSubmitBtn = page.getByTestId('proposal-submit-btn')
    this.proposalDeleteBtn = page.getByTestId('proposal-delete')
    this.newProposalBtn = page.getByTestId('new-proposal-btn')
  }

  async goToProposalsTab() {
    await clickNavTab(this.page, 'proposals')
  }

  async selectProposalTab() {
    await this.page.getByRole('button', { name: /^proposal$/i }).click()
  }

  async selectAccommodationsTab() {
    await this.page
      .getByRole('button', { name: /^accommodations/i })
      .first()
      .click()
  }

  async selectDiscussionTab() {
    await this.page.getByRole('button', { name: /^discussion/i }).click()
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

    const dateField = this.page.getByTestId('date-range-field')
    await dateField
      .locator(`[data-day="${startStr}"]:not([data-hidden])`)
      .click()
    await dateField.locator(`[data-day="${endStr}"]:not([data-hidden])`).click()
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
      await this.page
        .getByTestId('proposal-country')
        .selectOption({ label: data.country })
    }
    if (data.region) {
      await this.page.getByTestId('proposal-region').fill(data.region)
    }
    if (data.summitAltitude) {
      await this.page
        .getByTestId('proposal-summit-altitude')
        .fill(data.summitAltitude)
    }
    if (data.baseAltitude) {
      await this.page
        .getByTestId('proposal-base-altitude')
        .fill(data.baseAltitude)
    }
    if (data.nearestAirport) {
      await this.page
        .getByTestId('proposal-nearest-airport')
        .fill(data.nearestAirport)
    }
    if (data.transferTime) {
      await this.page
        .getByTestId('proposal-transfer-time')
        .fill(data.transferTime)
    }
    if (data.pisteKm) {
      await this.page.getByTestId('proposal-piste-km').fill(data.pisteKm)
    }
    if (data.beginnerPct) {
      await this.page
        .getByTestId('proposal-beginner-pct')
        .fill(data.beginnerPct)
    }
    if (data.intermediatePct) {
      await this.page
        .getByTestId('proposal-intermediate-pct')
        .fill(data.intermediatePct)
    }
    if (data.advancedPct) {
      await this.page
        .getByTestId('proposal-advanced-pct')
        .fill(data.advancedPct)
    }
    if (data.liftCount) {
      await this.page.getByTestId('proposal-lift-count').fill(data.liftCount)
    }
    if (data.snowReliability) {
      await this.page
        .getByTestId('proposal-snow-reliability')
        .selectOption(data.snowReliability)
    }
    if (data.skiSeasonMonths) {
      await this.page
        .getByTestId('proposal-ski-season-months')
        .fill(data.skiSeasonMonths)
    }
    if (data.websites) {
      await this.page.getByTestId('proposal-websites').fill(data.websites)
    }
    if (data.latitude) {
      await this.page.getByTestId('proposal-latitude').fill(data.latitude)
    }
    if (data.longitude) {
      await this.page.getByTestId('proposal-longitude').fill(data.longitude)
    }
    if (data.description) {
      await this.page.getByTestId('proposal-description').fill(data.description)
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
    await expect(
      this.page.getByRole('button', { name: /^accommodations/i }).first()
    ).toBeVisible()
    const accTab = this.page
      .getByRole('button', { name: /^accommodations/i })
      .first()
    await accTab.click()
    const addBtn = this.page.getByTestId('add-accommodation-btn')
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    const nameInput = this.page.locator('#acc-name')
    await nameInput.waitFor({ state: 'visible' })
    await nameInput.click()
    await nameInput.pressSequentially(name)
    const urlInput = this.page.locator('#acc-url')
    await urlInput.waitFor({ state: 'visible' })
    await urlInput.click()
    await urlInput.pressSequentially('https://example.com')
    await this.page.getByTestId('acc-save-btn').click()
    await expect(this.page.getByText(name)).toBeVisible()
  }

  async dismissSubmitDialog() {
    await this.page.getByRole('button', { name: /^ok$/i }).click()
  }

  async submitProposal() {
    await this.selectProposalTab()
    await this.proposalSubmitBtn.click()
    await waitForToast(this.page, 'Submitted')
  }
}
