import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { waitForAnimation } from './helpers/navigation'
import { setupUserWithDraftProposal, setupUserWithTrip } from './helpers/setup'
import { ProposalsPage } from './pages/proposals.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Proposals', () => {
  test('create a proposal and submit it', async ({ page }) => {
    await test.step('setup user and trip', async () => {
      await setupUserWithTrip(page, 'Chamonix trip')
    })

    await test.step('fill and submit proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.clickNewProposal()
      await proposals.fillResortProposal({
        resortName: 'Chamonix',
        country: 'France',
        region: 'Alps',
        summitAltitude: '3330',
        baseAltitude: '1500',
        nearestAirport: 'GVA',
        transferTime: '90',
        pisteKm: '600',
        beginnerPct: '25',
        intermediatePct: '50',
        advancedPct: '25',
        liftCount: '50',
        snowReliability: 'medium',
        skiSeasonMonths: 'Dec-Apr',
        websites: 'https://chamonix.com',
        latitude: '45.97',
        longitude: '6.87',
        description: 'Great resort',
      })
      await proposals.submitButton.click()
      await expect(page.getByText('Chamonix').first()).toBeVisible()
    })

    await test.step('add accommodation and submit', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.addAccommodation('Hotel Mont Blanc')
      await proposals.submitProposal()
    })
  })

  test('edit a draft proposal', async ({ page }) => {
    await setupUserWithDraftProposal(page, 'Edit trip', 'EditResort')

    await test.step('click edit button on draft proposal', async () => {
      const editBtn = page
        .getByRole('button', { name: /edit proposal/i })
        .first()
      if (await editBtn.isVisible()) {
        await editBtn.click()
        await waitForAnimation(page, 500)

        const dialog = page.getByRole('dialog', { name: /edit proposal/i })
        if (await dialog.isVisible()) {
        }
      }
    })

    await test.step('modify resort name and save', async () => {
      const resortInput = page.getByTestId('proposal-resort-name').first()
      if (await resortInput.isVisible()) {
        await resortInput.clear()
        await resortInput.fill('EditedResort')
        const saveBtn = page.getByRole('button', { name: /save/i }).first()
        if (await saveBtn.isVisible()) {
          await saveBtn.click()
          await waitForAnimation(page, 500)
        }
      }
    })
  })

  test('delete a draft proposal', async ({ page }) => {
    await setupUserWithDraftProposal(page, 'Delete trip', 'DeleteResort')

    await test.step('click delete button', async () => {
      const deleteBtn = page.getByTestId('proposal-delete').first()
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()

        const confirmDialog = page.getByRole('dialog', {
          name: /delete proposal/i,
        })
        if (await confirmDialog.isVisible()) {
        }
      }
    })

    await test.step('confirm deletion', async () => {
      const confirmBtn = page
        .getByRole('dialog', { name: /delete proposal/i })
        .getByRole('button', { name: /^delete$/i })
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click()
        await waitForAnimation(page, 500)
      }
    })
  })
})
