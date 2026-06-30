import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Discussion } from '../shared/types.d'
import DiscussionSection from './DiscussionSection'

const mockDiscussion: Discussion[] = [
  {
    id: 'd-1',
    created: '2024-06-15T10:00:00Z',
    updated: '2024-06-15T10:00:00Z',
    proposal: 'prop-1',
    author: '',
    authorUserName: 'System',
    body: 'Alice submitted this proposal',
    type: 'system',
  },
  {
    id: 'd-2',
    created: '2024-06-15T11:00:00Z',
    updated: '2024-06-15T11:00:00Z',
    proposal: 'prop-1',
    author: 'user-2',
    authorUserName: 'Bob',
    body: 'Looks great!',
    type: 'comment',
  },
  {
    id: 'd-3',
    created: '2024-06-15T12:00:00Z',
    updated: '2024-06-15T12:00:00Z',
    proposal: 'prop-1',
    author: 'user-3',
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
    id: 'd-new',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    proposal: 'prop-1',
    author: 'user-1',
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
    id: 'd-2',
    created: '2024-06-15T11:00:00Z',
    updated: new Date().toISOString(),
    proposal: 'prop-1',
    author: 'user-2',
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
    expect(screen.getByTestId('comment-d-2')).toBeDefined()
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

    expect(screen.getByTestId('comment-d-2')).toBeDefined()

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

    expect(screen.getByTestId('comment-d-2')).toBeDefined()

    const input = screen.getByTestId('comment-input')
    await userEvent.type(input, 'New comment')
    const postButton = screen.getByTestId('comment-post-btn')
    await userEvent.click(postButton)
    expect(createDiscussionCommentMock).toHaveBeenCalledWith(
      'prop-1',
      'user-1',
      'Alice',
      'New comment'
    )
  })
})
