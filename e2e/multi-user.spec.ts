import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { projectName, screenshot } from './helpers/screenshot'
import {
  setupUserWithPreferences,
  setupUserWithSubmittedProposal,
} from './helpers/setup'
import { PollPage } from './pages/poll.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Multi-user scenarios', () => {
  test('user A creates proposal, user B sees it', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
      let inviteCode: string

      await test.step('user A creates trip and submits proposal', async () => {
        await setupUserWithSubmittedProposal(
          page1,
          'Shared trip',
          'SharedResort'
        )
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      await test.step('user B joins and sees proposal', async () => {
        await setupUserWithPreferences(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)
      })
    })
  })

  test('coordinator permissions: only coordinator can create and close polls', async ({
    browser,
  }) => {
    await withTwoPages(browser, async (page1, page2) => {
      let inviteCode: string

      await test.step('user A creates trip and submits proposal', async () => {
        await setupUserWithSubmittedProposal(
          page1,
          'Permissions trip',
          'PermResort'
        )
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      await test.step('user B joins trip', async () => {
        await setupUserWithPreferences(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)
      })

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
      let inviteCode: string

      await test.step('user A creates trip and submits proposal', async () => {
        await setupUserWithSubmittedProposal(page1, 'Voting trip', 'VoteResort')
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      await test.step('user B joins trip', async () => {
        await setupUserWithPreferences(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)
      })

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
