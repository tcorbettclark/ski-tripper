import { expect, type Locator, type Page } from '@playwright/test'
import { clickNavTab } from '../helpers/navigation'

export class PollPage {
  readonly page: Page
  readonly pollDurationInput: Locator
  readonly createPollButton: Locator
  readonly closePollButton: Locator
  readonly saveVoteButton: Locator

  constructor(page: Page) {
    this.page = page
    this.pollDurationInput = page.getByTestId('poll-duration')
    this.createPollButton = page.getByTestId('create-poll-btn')
    this.closePollButton = page.getByTestId('close-poll-btn')
    this.saveVoteButton = page.getByTestId('save-vote-btn')
  }

  async clickVotingTab() {
    await clickNavTab(this.page, 'poll')
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
    await expect(this.saveVoteButton).toHaveText('Save Vote')
  }

  async closePoll(outcome: string) {
    await this.closePollButton.click()
    await this.page.getByLabel(/outcome/i).fill(outcome)
    const confirmBtn = this.page.getByTestId('confirm-close-poll-btn')
    await confirmBtn.click()
    await expect(this.page.getByText(/past polls/i)).toBeVisible()
  }
}
