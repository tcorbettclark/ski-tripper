import { expect, test } from '@playwright/test'
import { deleteAllEmails } from './helpers/mailpit'
import { AuthPage, generateTestUser } from './pages/auth.page'
import { PreferencesPage } from './pages/preferences.page'
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

test.describe('Trip lifecycle', () => {
  test('create a trip and view overview', async ({ page }) => {
    await signupVerifyAndLogin(page)
    const preferences = new PreferencesPage(page)
    await preferences.fillAndSave({
      sports: ['Ski'],
      levels: ['Red'],
      types: ['On-Piste'],
      accommodations: ['Chalet'],
    })

    const trips = new TripsPage(page)
    await trips.createTrip('Weekend in Chamonix')
    await trips.navigateToTrip('Weekend in Chamonix')

    await expect(page.getByTestId('invite-code')).toBeVisible()
  })

  test('create a trip and join with code', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await signupVerifyAndLogin(page1)
    const preferences1 = new PreferencesPage(page1)
    await preferences1.fillAndSave({
      sports: ['Ski'],
      levels: ['Red'],
      types: ['On-Piste'],
      accommodations: ['Chalet'],
    })

    const trips1 = new TripsPage(page1)
    await trips1.createTrip('Zermatt 2026')
    await trips1.navigateToTrip('Zermatt 2026')

    const code = await trips1.getInviteCode()

    await signupVerifyAndLogin(page2)
    const preferences2 = new PreferencesPage(page2)
    await preferences2.fillAndSave({
      sports: ['Ski'],
      levels: ['Red'],
      types: ['On-Piste'],
      accommodations: ['Chalet'],
    })

    const trips2 = new TripsPage(page2)
    await trips2.joinTrip(code)

    await expect(page2.getByText('Zermatt 2026')).toBeVisible()

    await ctx1.close()
    await ctx2.close()
  })
})
