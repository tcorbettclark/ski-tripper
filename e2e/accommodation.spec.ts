import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { AuthPage, generateTestUser } from './pages/auth.page'
import { PreferencesPage } from './pages/preferences.page'
import { ProposalsPage } from './pages/proposals.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

async function signupVerifyAndLogin(page: import('@playwright/test').Page) {
  const auth = new AuthPage(page)
  const user = generateTestUser()
  await auth.signup(user)
  await auth.enterOtpCode(user.email)
  await auth.setPassword(user.password)
  return user
}

async function setupUserAndTrip(
  page: import('@playwright/test').Page,
  tripDescription: string
) {
  await signupVerifyAndLogin(page)
  const preferences = new PreferencesPage(page)
  await preferences.fillAndSave({
    sports: ['Ski'],
    levels: ['Red'],
    types: ['On-Piste'],
    accommodations: ['Chalet'],
  })

  const trips = new TripsPage(page)
  await trips.createAndNavigateTo(tripDescription)
}

test.describe('Accommodation flow', () => {
  test('add accommodation to a draft proposal', async ({ page }) => {
    await setupUserAndTrip(page, 'Accommodation test trip')

    const proposals = new ProposalsPage(page)
    await proposals.goToProposalsTab()
    await proposals.createDraftProposal('TestResort')
    await proposals.addAccommodation('Hotel Test')
    await proposals.proposalSubmitBtn.click()
    await expect(page.getByText(/submitted/i)).toBeVisible()
  })
})
