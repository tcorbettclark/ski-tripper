import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiscussionSection from './DiscussionSection'
import type { Discussion } from './types.d'

const mockDiscussion: Discussion[] = [
  {
    $id: 'd-1',
    $createdAt: '2024-06-15T10:00:00Z',
    $updatedAt: '2024-06-15T10:00:00Z',
    proposalId: 'prop-1',
    authorUserId: '',
    authorUserName: 'System',
    body: 'Alice submitted this proposal',
    type: 'system',
  },
  {
    $id: 'd-2',
    $createdAt: '2024-06-15T11:00:00Z',
    $updatedAt: '2024-06-15T11:00:00Z',
    proposalId: 'prop-1',
    authorUserId: 'user-2',
    authorUserName: 'Bob',
    body: 'Looks great!',
    type: 'comment',
  },
  {
    $id: 'd-3',
    $createdAt: '2024-06-15T12:00:00Z',
    $updatedAt: '2024-06-15T12:00:00Z',
    proposalId: 'prop-1',
    authorUserId: 'user-3',
    authorUserName: 'AI Assistant',
    body: 'This resort has excellent slopes.',
    type: 'comment',
  },
]

const listDiscussionMock = mock(async () => mockDiscussion)
const createDiscussionCommentMock = mock(
  async (
    _proposalId: string,
    _authorUserId: string,
    _authorUserName: string,
    body: string
  ): Promise<Discussion> => ({
    $id: 'd-new',
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    proposalId: 'prop-1',
    authorUserId: 'user-1',
    authorUserName: 'Alice',
    body,
    type: 'comment',
  })
)
const updateDiscussionCommentMock = mock(
  async (
    _commentId: string,
    _authorUserId: string,
    body: string
  ): Promise<Discussion> => ({
    $id: 'd-2',
    $createdAt: '2024-06-15T11:00:00Z',
    $updatedAt: new Date().toISOString(),
    proposalId: 'prop-1',
    authorUserId: 'user-2',
    authorUserName: 'Bob',
    body,
    type: 'comment',
  })
)
const deleteDiscussionCommentMock = mock(async () => {})

describe('DiscussionSection', () => {
  it('renders discussion list with system messages and comments', async () => {
    await act(async () => {
      await render(
        <DiscussionSection
          proposalId="prop-1"
          userId="user-1"
          userName="Alice"
          listDiscussion={listDiscussionMock}
          createDiscussionComment={createDiscussionCommentMock}
        />
      )
    })

    expect(screen.getByText('Alice submitted this proposal')).toBeDefined()
    expect(screen.getByText('Looks great!')).toBeDefined()
    expect(screen.getByText('AI')).toBeDefined()
  })

  it('shows edit and delete buttons only for current user comments', async () => {
    await act(async () => {
      await render(
        <DiscussionSection
          proposalId="prop-1"
          userId="user-2"
          userName="Bob"
          listDiscussion={listDiscussionMock}
        />
      )
    })

    expect(screen.getByText('Looks great!')).toBeDefined()

    const allEditButtons = screen.queryAllByRole('button', { name: 'Edit' })
    const allDeleteButtons = screen.queryAllByRole('button', {
      name: 'Delete',
    })
    expect(allEditButtons).toHaveLength(1)
    expect(allDeleteButtons).toHaveLength(1)
  })

  it('shows empty state when no comments', async () => {
    const emptyListMock = mock(async () => [])
    await act(async () => {
      await render(
        <DiscussionSection
          proposalId="prop-1"
          userId="user-1"
          userName="Alice"
          listDiscussion={emptyListMock}
        />
      )
    })

    expect(screen.getByText('No comments yet.')).toBeDefined()
  })

  it('creates a new comment when posting', async () => {
    await act(async () => {
      await render(
        <DiscussionSection
          proposalId="prop-1"
          userId="user-1"
          userName="Alice"
          listDiscussion={listDiscussionMock}
          createDiscussionComment={createDiscussionCommentMock}
          updateDiscussionComment={updateDiscussionCommentMock}
          deleteDiscussionComment={deleteDiscussionCommentMock}
        />
      )
    })

    expect(screen.getByText('Looks great!')).toBeDefined()

    const input = screen.getByPlaceholderText('Write a comment…')
    await userEvent.type(input, 'New comment')
    const postButton = screen.getByRole('button', { name: 'Post' })
    await userEvent.click(postButton)
    expect(createDiscussionCommentMock).toHaveBeenCalledWith(
      'prop-1',
      'user-1',
      'Alice',
      'New comment'
    )
  })
})
