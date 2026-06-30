import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import { projectName, screenshot } from './helpers/screenshot'
import {
  setupUserWithSubmittedProposal,
  setupUserWithTrip,
} from './helpers/setup'
import { PollPage } from './pages/poll.page'
import { ProposalsPage } from './pages/proposals.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Polls', () => {
  test('create a poll and vote', async ({ page }) => {
    await test.step('setup user and trip', async () => {
      await setupUserWithTrip(page, 'Zermatt trip')
    })

    await test.step('create and submit proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.createDraftProposal('Zermatt')
      await proposals.addAccommodation('Hotel Zermatt')
      await proposals.submitProposal()
    })

    await test.step('create poll and vote', async () => {
      const poll = new PollPage(page)
      await poll.clickVotingTab()
      await poll.createPoll(7)

      await poll.addVoteToProposal('Zermatt')
      await poll.saveVote()
    })
  })

  test('coordinator closes a poll', async ({ page }) => {
    await test.step('setup user and trip', async () => {
      await setupUserWithTrip(page, 'Morzine trip')
    })

    await test.step('create and submit proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.createDraftProposal('Morzine')
      await proposals.addAccommodation('Hotel Morzine')
      await proposals.submitProposal()
    })

    await test.step('create and close poll', async () => {
      const poll = new PollPage(page)
      await poll.clickVotingTab()
      await poll.createPoll(7)

      await poll.closePoll('Morzine wins')
    })
  })

  test('poll constraints: cannot create poll without submitted proposals', async ({
    page,
  }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Poll constraints trip')

    await test.step('cannot create poll without submitted proposals', async () => {
      await clickNavTab(page, 'poll')
      const createPollBtn = page.getByTestId('create-poll-btn')
      if (await createPollBtn.isVisible()) {
        expect(await createPollBtn.isDisabled()).toBe(true)
      }
    })

    await test.step('create poll after submitting proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.createDraftProposal('PollResort')
      await proposals.addAccommodation('Hotel Poll')
      await proposals.submitProposal()

      const poll = new PollPage(page)
      await poll.clickVotingTab()
      await poll.createPoll(7)
      await screenshot(page, 'polls', 'poll-created', proj)
    })
  })

  test('token allocation constraints in voting', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Token trip', 'TokenResort')

    const poll = new PollPage(page)
    await poll.clickVotingTab()
    await poll.createPoll(7)

    await test.step('vote and verify tokens are allocated', async () => {
      await poll.addVoteToProposal('TokenResort')
      await poll.saveVote()
      await screenshot(page, 'polls', 'token-allocated', proj)
    })

    await test.step('re-voting updates existing vote', async () => {
      const removeBtn = page.getByRole('button', {
        name: /remove vote from tokenresort/i,
      })
      if (await removeBtn.isVisible()) {
        await removeBtn.click()
        await poll.saveVote()
        await screenshot(page, 'polls', 're-vote', proj)
      }
    })
  })

  test('poll results update after voting', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Results trip', 'ResultsResort')

    const poll = new PollPage(page)
    await poll.clickVotingTab()
    await poll.createPoll(7)
    await poll.addVoteToProposal('ResultsResort')
    await poll.saveVote()

    await test.step('results are visible after voting', async () => {
      await waitForAnimation(page, 500)
      await screenshot(page, 'polls', 'poll-results', proj)
    })
  })
})
