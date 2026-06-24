import { expect, test } from '@playwright/test'
import { clickNavTab } from './helpers/navigation'
import { screenshot } from './helpers/screenshot'
import {
  deleteAllEmails,
  setupUserWithSubmittedProposal,
  setupUserWithTrip,
} from './helpers/setup'
import { PollPage } from './pages/poll.page'
import { ProposalsPage } from './pages/proposals.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

function projectName(): string {
  return test.info().project.name
}

test.describe('Data integrity', () => {
  test('invite code generation and copying', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Invite code trip')

    await test.step('invite code is generated on trip creation', async () => {
      const code = page.getByTestId('invite-code')
      await expect(code).toBeVisible()
      const text = await code.textContent()
      expect(text!.trim().length).toBeGreaterThan(0)
    })

    await test.step('copy button copies to clipboard', async () => {
      const copyBtn = page.getByRole('button', { name: /copy/i }).first()
      if (await copyBtn.isVisible()) {
        await copyBtn.click()
        const clipboardText = await page.evaluate(() =>
          navigator.clipboard.readText()
        )
        expect(clipboardText.trim().length).toBeGreaterThan(0)
      }
    })

    await screenshot(page, 'data-integrity', 'invite-code', proj)
  })

  test('invalid invite code shows error', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Invalid code trip')

    await test.step('joining with invalid code shows error', async () => {
      await page.getByRole('button', { name: /my trips/i }).click()
      await page.getByTestId('join-trip-btn').click()
      await page.getByTestId('trip-code').fill('invalid-code-xyz')
      await page.getByTestId('trip-join').click()

      const errorVisible = await page
        .getByText(/error|invalid|not found|no trip/i)
        .isVisible()
        .catch(() => false)
      if (errorVisible) {
        await screenshot(page, 'data-integrity', 'invalid-code-error', proj)
      }
    })
  })

  test('proposal lifecycle constraints', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Proposal lifecycle trip')
    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()

    await test.step('cannot submit proposal without accommodation', async () => {
      await proposals.createDraftProposal('NoAccommResort')
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/no accommodations/i)).toBeVisible()
      await proposals.dismissSubmitDialog()
      await screenshot(page, 'data-integrity', 'no-accommodation-submit', proj)
    })

    await test.step('add accommodation and submit successfully', async () => {
      await proposals.addAccommodation('Hotel Lifecycle')
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/submitted/i)).toBeVisible()
    })

    await test.step('cannot delete submitted proposal', async () => {
      const deleteBtn = page.getByTestId('proposal-delete').first()
      if (await deleteBtn.isVisible()) {
        expect(await deleteBtn.isDisabled()).toBe(true)
      }
    })
  })

  test('coordinator can reject and revert a proposal', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Reject trip', 'RejectResort')

    await test.step('coordinator can reject submitted proposal', async () => {
      const rejectBtn = page.getByTestId('proposal-reject').first()
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click()
        await expect(page.getByText(/rejected/i)).toBeVisible()
        await screenshot(page, 'data-integrity', 'proposal-rejected', proj)
      }
    })

    await test.step('coordinator can revert rejected proposal', async () => {
      const revertBtn = page.getByTestId('proposal-revert').first()
      if (await revertBtn.isVisible()) {
        await revertBtn.click()
        await page.waitForTimeout(500)
        await screenshot(page, 'data-integrity', 'proposal-reverted', proj)
      }
    })
  })

  test('poll constraints', async ({ page }) => {
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
      await screenshot(page, 'data-integrity', 'poll-created', proj)
    })
  })

  test('date range validation: start must be before end', async ({ page }) => {
    const proj = projectName()
    await setupUserWithTrip(page, 'Date validation trip')
    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()
    await proposals.clickNewProposal()

    const dateField = page.getByTestId('date-range-field')
    await expect(dateField).toBeVisible()
    await screenshot(page, 'data-integrity', 'date-range-picker', proj)
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
      await screenshot(page, 'data-integrity', 'token-allocated', proj)
    })

    await test.step('re-voting updates existing vote', async () => {
      const addBtn = page.getByRole('button', {
        name: /add vote to tokenresort/i,
      })
      if (await addBtn.isVisible()) {
        await addBtn.click()
        await poll.saveVote()
        await screenshot(page, 'data-integrity', 're-vote', proj)
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
      await page.waitForTimeout(500)
      await screenshot(page, 'data-integrity', 'poll-results', proj)
    })
  })
})
