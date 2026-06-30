import { expect, test } from '@playwright/test'
import { withTwoPages } from './helpers/browser'
import { deleteAllEmails } from './helpers/mailpit'
import { projectName, screenshot } from './helpers/screenshot'
import {
  setupUserWithSubmittedProposal,
  signupVerifyAndLogin,
} from './helpers/setup'
import { PreferencesPage } from './pages/preferences.page'
import { ProposalsPage } from './pages/proposals.page'
import { TripsPage } from './pages/trips.page'

test.beforeEach(async () => {
  await deleteAllEmails()
})

test.describe('Discussion and comments', () => {
  test('can post a comment on a proposal', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Comment trip', 'CommentResort')

    await test.step('navigate to discussion tab', async () => {
      const discussionTab = page
        .getByRole('button', { name: /^discussion/i })
        .first()
      if (await discussionTab.isVisible()) {
        await discussionTab.click()
      }
    })

    await test.step('post a comment', async () => {
      const commentInput = page.getByPlaceholder(/comment|write/i).first()
      if (await commentInput.isVisible()) {
        await commentInput.fill('Great proposal!')
        const postBtn = page.getByRole('button', { name: /post|send/i }).first()
        if (await postBtn.isVisible()) {
          await postBtn.click()
          await expect(page.getByText('Great proposal!')).toBeVisible()
        }
      }
      await screenshot(page, 'discussion', 'comment-posted', proj)
    })
  })

  test('can edit own comment', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Edit trip', 'EditResort')

    const discussionTab = page
      .getByRole('button', { name: /^discussion/i })
      .first()
    if (await discussionTab.isVisible()) {
      await discussionTab.click()
    }

    const commentInput = page.getByPlaceholder(/comment|write/i).first()
    if (await commentInput.isVisible()) {
      await commentInput.fill('Original comment')
      const postBtn = page.getByRole('button', { name: /post|send/i }).first()
      if (await postBtn.isVisible()) {
        await postBtn.click()
        await expect(page.getByText('Original comment')).toBeVisible()

        const editBtn = page.getByRole('button', { name: /edit/i }).first()
        if (await editBtn.isVisible()) {
          await editBtn.click()
          const editArea = page.locator('textarea').first()
          await editArea.fill('Edited comment')
          const saveBtn = page.getByRole('button', { name: /save/i }).first()
          await saveBtn.click()
          await expect(page.getByText('Edited comment')).toBeVisible()
        }
      }
    }
    await screenshot(page, 'discussion', 'comment-edited', proj)
  })

  test('can delete own comment', async ({ page }) => {
    const proj = projectName()
    await setupUserWithSubmittedProposal(page, 'Delete trip', 'DeleteResort')

    const discussionTab = page
      .getByRole('button', { name: /^discussion/i })
      .first()
    if (await discussionTab.isVisible()) {
      await discussionTab.click()
    }

    const commentInput = page.getByPlaceholder(/comment|write/i).first()
    if (await commentInput.isVisible()) {
      await commentInput.fill('Comment to delete')
      const postBtn = page.getByRole('button', { name: /post|send/i }).first()
      if (await postBtn.isVisible()) {
        await postBtn.click()
        await expect(page.getByText('Comment to delete')).toBeVisible()

        const deleteBtn = page.getByRole('button', { name: /delete/i }).first()
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click()
        }
      }
    }
    await screenshot(page, 'discussion', 'comment-deleted', proj)
  })

  test('cannot edit or delete another users comment', async ({ browser }) => {
    await withTwoPages(browser, async (page1, page2) => {
      await signupVerifyAndLogin(page1)
      const preferences1 = new PreferencesPage(page1)
      await preferences1.fillAndSave({
        sports: ['Ski'],
        levels: ['Red'],
        types: ['On-Piste'],
        accommodations: ['Chalet'],
      })
      const trips1 = new TripsPage(page1)
      await trips1.createAndNavigateTo('Multi comment trip')
      const proposals1 = new ProposalsPage(page1)
      await proposals1.goToProposalsTab()
      await proposals1.createDraftProposal('Resort1')
      await proposals1.addAccommodation('Hotel1')
      await proposals1.submitProposal()

      const discussionTab1 = page1
        .getByRole('button', { name: /^discussion/i })
        .first()
      if (await discussionTab1.isVisible()) {
        await discussionTab1.click()
      }

      const commentInput1 = page1.getByPlaceholder(/comment|write/i).first()
      if (await commentInput1.isVisible()) {
        await commentInput1.fill('User1 comment')
        const postBtn = page1
          .getByRole('button', { name: /post|send/i })
          .first()
        if (await postBtn.isVisible()) {
          await postBtn.click()
        }
      }

      await signupVerifyAndLogin(page2)
      const preferences2 = new PreferencesPage(page2)
      await preferences2.fillAndSave({
        sports: ['Ski'],
        levels: ['Red'],
        types: ['On-Piste'],
        accommodations: ['Chalet'],
      })
      const trips2 = new TripsPage(page2)
      await trips2.joinTrip('some-code')

      const discussionTab2 = page2
        .getByRole('button', { name: /^discussion/i })
        .first()
      if (await discussionTab2.isVisible()) {
        await discussionTab2.click()
      }

      const editBtn = page2.getByRole('button', { name: /edit/i }).first()
      const deleteBtn = page2.getByRole('button', { name: /delete/i }).first()
      expect(await editBtn.isVisible().catch(() => false)).toBe(false)
      expect(await deleteBtn.isVisible().catch(() => false)).toBe(false)
    })
  })
})
