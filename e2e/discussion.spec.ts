import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { clickNavTab } from './helpers/navigation'
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
    await setupUserWithDraftProposal(page, 'Comment trip', 'CommentResort')

    const proposals = new ProposalsPage(page)
    await proposals.postComment('Great proposal!')
  })

  test('can edit own comment', async ({ page }) => {
    await setupUserWithDraftProposal(page, 'Edit trip', 'EditResort')

    const proposals = new ProposalsPage(page)
    await proposals.postComment('Original comment')

    const notesDialog = page.getByRole('dialog', { name: 'Notes' })
    await notesDialog.getByRole('button', { name: 'Edit' }).click()
    await notesDialog.locator('textarea').first().fill('Edited comment')
    await notesDialog.getByRole('button', { name: 'Save' }).click()
    await expect(notesDialog.getByText('Edited comment')).toBeVisible()
  })

  test('can delete own comment', async ({ page }) => {
    await setupUserWithDraftProposal(page, 'Delete trip', 'DeleteResort')

    const proposals = new ProposalsPage(page)
    await proposals.postComment('Comment to delete')

    const notesDialog = page.getByRole('dialog', { name: 'Notes' })
    await notesDialog.getByRole('button', { name: 'Delete' }).click()
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
        await proposals2.openNotes()

        const notesDialog = page2.getByRole('dialog', { name: 'Notes' })
        expect(
          await notesDialog
            .getByRole('button', { name: 'Edit' })
            .isVisible()
            .catch(() => false)
        ).toBe(false)
        expect(
          await notesDialog
            .getByRole('button', { name: 'Delete' })
            .isVisible()
            .catch(() => false)
        ).toBe(false)
      })
    })
  })
})
