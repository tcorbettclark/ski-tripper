import { test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { setupUserWithTrip } from './helpers/setup'
import { ProposalsPage } from './pages/proposals.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Accommodation flow', () => {
  test('add accommodation to a draft proposal', async ({ page }) => {
    await setupUserWithTrip(page, 'Accommodation test trip')

    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()
    await proposals.createDraftProposal('TestResort')
    await proposals.addAccommodation('Hotel Test')
    await proposals.submitProposal()
  })
})
