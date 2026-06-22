import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { AuthPage, generateTestUser } from './pages/auth.page'
import { PollPage } from './pages/poll.page'
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
  await auth.verifyEmail(user.email)
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

test.describe('Proposals and voting', () => {
  test('create a proposal and submit it', async ({ page }) => {
    await test.step('setup user and trip', async () => {
      await setupUserAndTrip(page, 'Chamonix trip')
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
      await expect(proposals.submitButton).toBeEnabled()
      await expect(page.getByText('Chamonix').first()).toBeVisible()
    })

    await test.step('add accommodation and submit', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.addAccommodation('Hotel Mont Blanc')
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/submitted/i)).toBeVisible()
    })
  })

  test('create a poll and vote', async ({ page }) => {
    await test.step('setup user and trip', async () => {
      await setupUserAndTrip(page, 'Zermatt trip')
    })

    await test.step('create and submit proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.createDraftProposal('Zermatt')
      await proposals.addAccommodation('Hotel Zermatt')
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/submitted/i)).toBeVisible()
    })

    await test.step('create poll and vote', async () => {
      const poll = new PollPage(page)
      await poll.clickVotingTab()
      await poll.createPoll(7)

      await poll.addVoteToProposal('Zermatt')
      await poll.saveVote()

      await expect(page.getByText(/vote saved/i)).toBeVisible()
    })
  })

  test('coordinator closes a poll', async ({ page }) => {
    await test.step('setup user and trip', async () => {
      await setupUserAndTrip(page, 'Morzine trip')
    })

    await test.step('create and submit proposal', async () => {
      const proposals = new ProposalsPage(page)
      await proposals.goToProposalsTab()
      await proposals.createDraftProposal('Morzine')
      await proposals.addAccommodation('Hotel Morzine')
      await proposals.proposalSubmitBtn.click()
      await expect(page.getByText(/submitted/i)).toBeVisible()
    })

    await test.step('create and close poll', async () => {
      const poll = new PollPage(page)
      await poll.clickVotingTab()
      await poll.createPoll(7)

      await poll.closePoll('Morzine wins')
    })
  })
})
