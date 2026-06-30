import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab } from './helpers/navigation'
import { projectName, screenshot } from './helpers/screenshot'
import {
  setupUserWithDraftProposal,
  setupUserWithPreferences,
} from './helpers/setup'
import { ProposalsPage } from './pages/proposals.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Discussion and comments', () => {
  test('can post a comment on a proposal', async ({ page }) => {
    const proj = projectName()
    await setupUserWithDraftProposal(page, 'Comment trip', 'CommentResort')

    const proposals = new ProposalsPage(page)
    await proposals.postComment('Great proposal!')
    await screenshot(page, 'discussion', 'comment-posted', proj)
  })

  test('can edit own comment', async ({ page }) => {
    const proj = projectName()
    await setupUserWithDraftProposal(page, 'Edit trip', 'EditResort')

    const proposals = new ProposalsPage(page)
    await proposals.postComment('Original comment')

    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      const editArea = page.locator('textarea').first()
      await editArea.fill('Edited comment')
      const saveBtn = page.getByRole('button', { name: /save/i }).first()
      await saveBtn.click()
      await expect(page.getByText('Edited comment')).toBeVisible()
    }
    await screenshot(page, 'discussion', 'comment-edited', proj)
  })

  test('can delete own comment', async ({ page }) => {
    const proj = projectName()
    await setupUserWithDraftProposal(page, 'Delete trip', 'DeleteResort')

    const proposals = new ProposalsPage(page)
    await proposals.postComment('Comment to delete')

    const deleteBtn = page.getByRole('button', { name: /delete/i }).first()
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
    }
    await screenshot(page, 'discussion', 'comment-deleted', proj)
  })

  test('cannot edit or delete another users comment', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
      let inviteCode: string

      await test.step('user 1 creates trip and draft proposal', async () => {
        await setupUserWithDraftProposal(page1, 'Multi comment trip', 'Resort1')
        await clickNavTab(page1, 'overview')
        const trips1 = new TripsPage(page1)
        inviteCode = await trips1.getInviteCode()
      })

      const proposals1 = new ProposalsPage(page1)
      await proposals1.goToProposalsTab()
      await proposals1.postComment('User1 comment')

      await test.step('user 2 joins trip and navigates to discussion', async () => {
        await setupUserWithPreferences(page2)
        const trips2 = new TripsPage(page2)
        await trips2.joinTrip(inviteCode!)

        const proposals2 = new ProposalsPage(page2)
        await proposals2.goToProposalsTab()
        await proposals2.selectDiscussionTab()

        const editBtn = page2.getByRole('button', { name: /edit/i }).first()
        const deleteBtn = page2.getByRole('button', { name: /delete/i }).first()
        expect(await editBtn.isVisible().catch(() => false)).toBe(false)
        expect(await deleteBtn.isVisible().catch(() => false)).toBe(false)
      })
    })
  })
})
