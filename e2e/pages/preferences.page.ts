import { expect, type Locator, type Page } from '@playwright/test'

export class PreferencesPage {
  readonly page: Page
  readonly saveButton: Locator

  constructor(page: Page) {
    this.page = page
    this.saveButton = page.getByTestId('pref-save')
  }

  async checkOption(label: string) {
    await this.page.getByRole('checkbox', { name: label }).check()
  }

  async uncheckOption(label: string) {
    await this.page.getByRole('checkbox', { name: label }).uncheck()
  }

  async fillAndSave(preferences: {
    sports?: string[]
    levels?: string[]
    types?: string[]
    accommodations?: string[]
  }) {
    await expect(
      this.page.getByRole('heading', { name: /welcome/i })
    ).toBeVisible()

    for (const sport of preferences.sports ?? []) {
      await this.checkOption(sport)
    }
    for (const level of preferences.levels ?? []) {
      await this.checkOption(level)
    }
    for (const type of preferences.types ?? []) {
      await this.checkOption(type)
    }
    for (const acc of preferences.accommodations ?? []) {
      await this.checkOption(acc)
    }

    await this.saveButton.click()
    await expect(this.page.getByText(/my trips/i)).toBeVisible()
  }
}
