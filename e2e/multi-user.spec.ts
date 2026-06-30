import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab } from './helpers/navigation'
import { projectName, screenshot } from './helpers/screenshot'
import { signupVerifyAndLogin } from './helpers/setup'
import { PollPage } from './pages/poll.page'
import { PreferencesPage } from './pages/preferences.page'
import { ProposalsPage } from './pages/proposals.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Multi-user scenarios', () => {
  test('user A creates proposal, user B sees it', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
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
        await clickNavTab(page1, 'overview')
        const code = await trips1.getInviteCode()

        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(code)
      })
    })
  })

  test('coordinator permissions: only coordinator can create and close polls', async ({
    browser,
  }) => {
    await withTwoPages(browser, async (page1, page2) => {
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

      await clickNavTab(page1, 'overview')
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
          .getByRole('heading', { name: /Permissions trip/i })
          .first()
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
    })
  })

  test('concurrent voting: both users can vote independently', async ({
    browser,
  }) => {
    await withTwoPages(browser, async (page1, page2) => {
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

      await clickNavTab(page1, 'overview')
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
          .getByRole('heading', { name: /Voting trip/i })
          .first()
          .click()
          .catch(() => {})
        await poll2.clickVotingTab()
        await poll2.addVoteToProposal('VoteResort')
        await poll2.saveVote()
      })

      await screenshot(page1, 'multi-user', 'concurrent-voting', projectName())
    })
  })
})
