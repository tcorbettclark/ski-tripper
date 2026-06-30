import type { Page } from '@playwright/test'
import { AuthPage, generateTestUser } from '../pages/auth.page'
import { PreferencesPage } from '../pages/preferences.page'
import { ProposalsPage } from '../pages/proposals.page'
import { TripsPage } from '../pages/trips.page'

export interface TestUser {
  name: string
  email: string
  password: string
}

export async function signupVerifyAndLogin(page: Page): Promise<TestUser> {
  const auth = new AuthPage(page)
  const user = generateTestUser()
  await auth.signup(user)
  await auth.enterOtpCode(user.email)
  await auth.setPassword(user.password)
  return user
}

export async function setupUserWithPreferences(page: Page): Promise<TestUser> {
  const user = await signupVerifyAndLogin(page)
  const preferences = new PreferencesPage(page)
  await preferences.fillAndSave({
    sports: ['Ski'],
    levels: ['Red'],
    types: ['On-Piste'],
    accommodations: ['Chalet'],
  })
  return user
}

export async function setupUserWithTrip(
  page: Page,
  tripDescription = 'Test trip'
): Promise<{ user: TestUser; tripDescription: string }> {
  const user = await setupUserWithPreferences(page)
  const trips = new TripsPage(page)
  await trips.createAndNavigateTo(tripDescription)
  return { user, tripDescription }
}

export async function setupUserWithSubmittedProposal(
  page: Page,
  tripDescription = 'Proposal trip',
  resortName = 'TestResort'
): Promise<{
  user: TestUser
  tripDescription: string
  resortName: string
}> {
  const { user } = await setupUserWithTrip(page, tripDescription)
  const proposals = new ProposalsPage(page)
  await proposals.goToProposalsTab()
  await proposals.createDraftProposal(resortName)
  await proposals.addAccommodation('Hotel Test')
  await proposals.submitProposal()
  return { user, tripDescription, resortName }
}
