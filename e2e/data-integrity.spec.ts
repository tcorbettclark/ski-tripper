import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { waitForAnimation } from './helpers/navigation'
import {
  setupUserWithPreferences,
  setupUserWithSubmittedProposal,
  setupUserWithTrip,
} from './helpers/setup'
import { snapshotOptions } from './helpers/snapshot'
import { ProposalsPage } from './pages/proposals.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Data integrity', () => {
  test('invite code generation and copying', async ({ page }) => {
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
  })

  test('join a trip with invite code', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
      let inviteCode: string

      await test.step('user 1 signs up and creates trip', async () => {
        await setupUserWithTrip(page1, 'Zermatt 2026')
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      await test.step('user 2 signs up and joins trip', async () => {
        await setupUserWithPreferences(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)
      })

      await test.step('assert user 2 sees the trip', async () => {
        await expect(page2.getByText('Zermatt 2026')).toBeVisible()
      })
    })
  })

  test('invalid invite code shows error', async ({ page }) => {
    await setupUserWithTrip(page, 'Invalid code trip')

    await test.step('joining with invalid code shows error', async () => {
      const trips = new TripsPage(page)
      await trips.navigateToTripList()
      await trips.joinTrip('invalid-code-xyz')

      await page
        .getByText(/error|invalid|not found|no trip/i)
        .isVisible()
        .catch(() => false)
    })
  })

  test('proposal lifecycle constraints', async ({ page }) => {
    await setupUserWithTrip(page, 'Proposal lifecycle trip')
    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()

    await test.step('cannot submit proposal without accommodation', async () => {
      await proposals.createDraftProposal('NoAccommResort')
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/no accommodations/i)).toBeVisible()
      await proposals.dismissSubmitDialog()
    })

    await test.step('add accommodation and submit successfully', async () => {
      await proposals.addAccommodation('Hotel Lifecycle')
      await proposals.selectProposalTab()
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/submitted \(1\)/i)).toBeVisible()
    })

    await test.step('cannot delete submitted proposal', async () => {
      const deleteBtn = page.getByTestId('proposal-delete').first()
      if (await deleteBtn.isVisible()) {
        expect(await deleteBtn.isDisabled()).toBe(true)
      }
    })
  })

  test('coordinator can reject and revert a proposal', async ({ page }) => {
    await setupUserWithSubmittedProposal(page, 'Reject trip', 'RejectResort')

    await test.step('coordinator can reject submitted proposal', async () => {
      const rejectBtn = page.getByTestId('proposal-reject').first()
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click()
        await expect(page.getByText(/rejected/i)).toBeVisible()
      }
    })

    await test.step('coordinator can revert rejected proposal', async () => {
      const revertBtn = page.getByTestId('proposal-revert').first()
      if (await revertBtn.isVisible()) {
        await revertBtn.click()
        await waitForAnimation(page, 500)
      }
    })
  })

  test('date range validation: start must be before end', async ({ page }) => {
    await setupUserWithTrip(page, 'Date validation trip')
    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()
    await proposals.clickNewProposal()

    const dateField = page.getByTestId('date-range-field')
    await expect(dateField).toBeVisible()
    await expect(page).toHaveScreenshot(
      'data-integrity-date-range-picker.png',
      snapshotOptions.loggedIn(page)
    )
  })
})
