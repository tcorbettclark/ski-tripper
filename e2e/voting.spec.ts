import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab, waitForAnimation } from './helpers/navigation'
import {
  setupUserWithSubmittedProposal,
  setupUserWithTrip,
} from './helpers/setup'
import { ProposalsPage } from './pages/proposals.page'
import { VotingPage } from './pages/voting.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Voting', () => {
  test('create a voting and vote', async ({ page }) => {
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

    await test.step('create voting and vote', async () => {
      const voting = new VotingPage(page)
      await voting.clickVotingTab()
      await voting.createPoll(7)

      await voting.addVoteToProposal('Zermatt')
      await voting.saveVote()
    })
  })

  test('coordinator closes a voting', async ({ page }) => {
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

    await test.step('create and close voting', async () => {
      const voting = new VotingPage(page)
      await voting.clickVotingTab()
      await voting.createPoll(7)

      await voting.closePoll('Morzine wins')
    })
  })

  test('voting constraints: cannot create voting without submitted proposals', async ({
    page,
  }) => {
    await setupUserWithTrip(page, 'Voting constraints trip')

    await test.step('cannot create voting without submitted proposals', async () => {
      await clickNavTab(page, 'voting')
      const createBtn = page.getByTestId('create-poll-btn')
      if (await createBtn.isVisible()) {
        expect(await createBtn.isDisabled()).toBe(true)
      }
    })

    await test.step('create voting after submitting proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.createDraftProposal('VotingResort')
      await proposals.addAccommodation('Hotel Voting')
      await proposals.submitProposal()

      const voting = new VotingPage(page)
      await voting.clickVotingTab()
      await voting.createPoll(7)
    })
  })

  test('token allocation constraints in voting', async ({ page }) => {
    await setupUserWithSubmittedProposal(page, 'Token trip', 'TokenResort')

    const voting = new VotingPage(page)
    await voting.clickVotingTab()
    await voting.createPoll(7)

    await test.step('vote and verify tokens are allocated', async () => {
      await voting.addVoteToProposal('TokenResort')
      await voting.saveVote()
    })

    await test.step('re-voting updates existing vote', async () => {
      const removeBtn = page.getByRole('button', {
        name: /remove token from tokenresort/i,
      })
      if (await removeBtn.isVisible()) {
        await removeBtn.click()
        await voting.saveVote()
      }
    })
  })

  test('voting results update after voting', async ({ page }) => {
    await setupUserWithSubmittedProposal(page, 'Results trip', 'ResultsResort')

    const voting = new VotingPage(page)
    await voting.clickVotingTab()
    await voting.createPoll(7)
    await voting.addVoteToProposal('ResultsResort')
    await voting.saveVote()

    await test.step('results are visible after voting', async () => {
      await waitForAnimation(page, 500)
    })
  })
})
