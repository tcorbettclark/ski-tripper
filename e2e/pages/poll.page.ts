import { expect, type Locator, type Page } from '@playwright/test'

export class PollPage {
  readonly page: Page
  readonly pollDurationInput: Locator
  readonly createPollButton: Locator
  readonly closePollButton: Locator
  readonly saveVoteButton: Locator
  readonly votingTab: Locator

  constructor(page: Page) {
    this.page = page
    this.pollDurationInput = page.getByTestId('poll-duration')
    this.createPollButton = page.getByTestId('create-poll-btn')
    this.closePollButton = page.getByTestId('close-poll-btn')
    this.saveVoteButton = page.getByTestId('save-vote-btn')
    this.votingTab = page.getByTestId('nav-tab-poll')
  }

  async clickVotingTab() {
    await this.votingTab.click()
  }

  async createPoll(durationDays = 7) {
    await this.pollDurationInput.fill(String(durationDays))
    await this.createPollButton.click()
    await expect(this.page.getByText(/active poll/i)).toBeVisible()
  }

  async addVoteToProposal(resortName: string) {
    await this.page
      .getByRole('button', { name: `Add vote to ${resortName}` })
      .click()
  }

  async saveVote() {
    await this.saveVoteButton.click()
    await expect(this.page.getByText(/vote saved/i)).toBeVisible()
  }

  async closePoll(outcome: string) {
    await this.closePollButton.click()
    await this.page.locator('textarea[id="outcome"]').fill(outcome)
    await this.page.getByRole('button', { name: /confirm close/i }).click()
    await expect(this.page.getByText(/past polls/i)).toBeVisible()
  }
}
