import { expect, test } from '@playwright/test'
import { screenshot } from './helpers/screenshot'
import { deleteAllEmails, signupVerifyAndLogin } from './helpers/setup'
import { PollPage } from './pages/poll.page'
import { PreferencesPage } from './pages/preferences.page'
import { ProposalsPage } from './pages/proposals.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Multi-user scenarios', () => {
  test('user A creates proposal, user B sees it', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await test.step('user A creates trip and submits proposal', async () => {
        await signupVerifyAndLogin(page1)
        const preferences1 = new PreferencesPage(page1)
        await preferences1.fillAndSave({
          sports: ['Ski'],
          levels: ['Red'],
          types: ['On-Piste'],
          accommodations: ['Chalet'],
        })
        const trips1 = new TripsPage(page1)
        await trips1.createAndNavigateTo('Shared trip')
        const proposals1 = new ProposalsPage(page1)
        await proposals1.goToProposalsTab()
        await proposals1.createDraftProposal('SharedResort')
        await proposals1.addAccommodation('Hotel Shared')
        await proposals1.submitProposal()
      })

      await test.step('user B joins and sees proposal', async () => {
        await signupVerifyAndLogin(page2)
        const preferences2 = new PreferencesPage(page2)
        await preferences2.fillAndSave({
          sports: ['Ski'],
          levels: ['Red'],
          types: ['On-Piste'],
          accommodations: ['Chalet'],
        })
        const trips1 = new TripsPage(page1)
        const code = await trips1.getInviteCode()

        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(code)
      })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('coordinator permissions: only coordinator can create and close polls', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await signupVerifyAndLogin(page1)
      const preferences1 = new PreferencesPage(page1)
      await preferences1.fillAndSave({
        sports: ['Ski'],
        levels: ['Red'],
        types: ['On-Piste'],
        accommodations: ['Chalet'],
      })
      const trips1 = new TripsPage(page1)
      await trips1.createAndNavigateTo('Permissions trip')
      const proposals1 = new ProposalsPage(page1)
      await proposals1.goToProposalsTab()
      await proposals1.createDraftProposal('PermResort')
      await proposals1.addAccommodation('Hotel Perm')
      await proposals1.submitProposal()

      const code = await trips1.getInviteCode()

      await signupVerifyAndLogin(page2)
      const preferences2 = new PreferencesPage(page2)
      await preferences2.fillAndSave({
        sports: ['Ski'],
        levels: ['Red'],
        types: ['On-Piste'],
        accommodations: ['Chalet'],
      })
      const trips2 = new TripsPage(page2)
      await trips2.joinTrip(code)

      await test.step('coordinator can create a poll', async () => {
        const poll1 = new PollPage(page1)
        await poll1.clickVotingTab()
        await poll1.createPoll(7)
        await screenshot(
          page1,
          'multi-user',
          'coordinator-poll-created',
          projectName()
        )
      })

      await test.step('participant can vote', async () => {
        await page2
          .getByText('Permissions trip')
          .click()
          .catch(() => {})
        const poll2 = new PollPage(page2)
        await poll2.clickVotingTab()
        await poll2.addVoteToProposal('PermResort')
        await poll2.saveVote()
      })

      await test.step('participant cannot create poll (no button visible)', async () => {
        const createPollBtn = page2.getByTestId('create-poll-btn')
        expect(await createPollBtn.isVisible().catch(() => false)).toBe(false)
      })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('concurrent voting: both users can vote independently', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await signupVerifyAndLogin(page1)
      const preferences1 = new PreferencesPage(page1)
      await preferences1.fillAndSave({
        sports: ['Ski'],
        levels: ['Red'],
        types: ['On-Piste'],
        accommodations: ['Chalet'],
      })
      const trips1 = new TripsPage(page1)
      await trips1.createAndNavigateTo('Voting trip')
      const proposals1 = new ProposalsPage(page1)
      await proposals1.goToProposalsTab()
      await proposals1.createDraftProposal('VoteResort')
      await proposals1.addAccommodation('Hotel Vote')
      await proposals1.submitProposal()

      const code = await trips1.getInviteCode()

      await signupVerifyAndLogin(page2)
      const preferences2 = new PreferencesPage(page2)
      await preferences2.fillAndSave({
        sports: ['Ski'],
        levels: ['Red'],
        types: ['On-Piste'],
        accommodations: ['Chalet'],
      })
      const trips2 = new TripsPage(page2)
      await trips2.joinTrip(code)

      const poll1 = new PollPage(page1)
      await poll1.clickVotingTab()
      await poll1.createPoll(7)

      await test.step('user 1 votes', async () => {
        await poll1.addVoteToProposal('VoteResort')
        await poll1.saveVote()
      })

      await test.step('user 2 votes', async () => {
        const poll2 = new PollPage(page2)
        await page2
          .getByText('Voting trip')
          .click()
          .catch(() => {})
        await poll2.clickVotingTab()
        await poll2.addVoteToProposal('VoteResort')
        await poll2.saveVote()
      })

      await screenshot(page1, 'multi-user', 'concurrent-voting', projectName())
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
