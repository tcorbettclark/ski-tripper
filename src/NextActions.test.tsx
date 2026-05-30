import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NextActions from './NextActions'
import type { Poll } from './types.d.ts'

const sampleActivePoll: Poll = {
  $id: 'poll-1',
  $createdAt: '2024-01-05T00:00:00Z',
  $updatedAt: '2024-01-05T00:00:00Z',
  pollCreatorUserId: 'user-1',
  pollCreatorUserName: 'Alice',
  state: 'OPEN',
  tripId: 'trip-1',
  proposalIds: ['prop-2'],
  startDate: '2024-01-05T00:00:00Z',
  endDate: '2024-01-12T00:00:00Z',
  outcome: '',
}

const defaultProps = {
  resortCount: 3,
  draftCount: 0,
  submittedCount: 0,
  approvedCount: 0,
  closedPollCount: 0,
  activePoll: undefined,
  userVotedInActivePoll: false,
  isCoordinator: false,
  onNavigateToTab: mock((_tab: string, _statusFilter?: string) => {}),
}

function renderNextActions(props = {}) {
  return render(<NextActions {...defaultProps} {...props} />)
}

describe('NextActions', () => {
  it('renders Next Steps heading', async () => {
    await act(async () => {
      renderNextActions()
    })
    expect(screen.getByText('Next Steps'))
  })

  it('shows browse resorts action', async () => {
    await act(async () => {
      renderNextActions()
    })
    expect(
      screen.getByRole('button', { name: /browse 3 resorts.*make a proposal/i })
    )
  })

  it('shows submit drafts action when drafts exist and no active poll', async () => {
    await act(async () => {
      renderNextActions({ draftCount: 2 })
    })
    expect(screen.getByText(/submit 2 draft proposals for voting/i))
  })

  it('does not show submit drafts when active poll exists', async () => {
    await act(async () => {
      renderNextActions({ draftCount: 1, activePoll: sampleActivePoll })
    })
    expect(screen.queryByText(/submit.*draft proposal/i)).toBeNull()
  })

  it('shows comment on submitted proposals when no active poll', async () => {
    await act(async () => {
      renderNextActions({ submittedCount: 1 })
    })
    expect(screen.getByText(/comment on 1 submitted proposal/i))
  })

  it('shows create poll action for coordinator with submitted proposals and no active poll', async () => {
    await act(async () => {
      renderNextActions({ submittedCount: 2, isCoordinator: true })
    })
    expect(screen.getByText(/create a poll from 2 proposals/i))
  })

  it('does not show create poll for non-coordinator', async () => {
    await act(async () => {
      renderNextActions({ submittedCount: 1, isCoordinator: false })
    })
    expect(screen.queryByText(/create a poll/i)).toBeNull()
  })

  it('shows vote in active poll when user has not voted', async () => {
    await act(async () => {
      renderNextActions({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: false,
      })
    })
    expect(screen.getByText(/vote in the active poll/i))
  })

  it('shows view active poll when user has already voted', async () => {
    await act(async () => {
      renderNextActions({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: true,
      })
    })
    expect(screen.getByText(/view active poll/i))
    expect(screen.queryByText(/vote in the active poll/i)).toBeNull()
  })

  it('navigates to proposals tab with SUBMITTED filter from comment action', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderNextActions({ submittedCount: 1, onNavigateToTab })
    })
    await eventUser.click(
      screen.getByRole('button', {
        name: /comment on 1 submitted proposal/i,
      })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'SUBMITTED')
  })

  it('shows approved proposals button', async () => {
    await act(async () => {
      renderNextActions({ approvedCount: 1 })
    })
    expect(screen.getByText(/view 1 approved proposal/i))
  })

  it('shows closed poll button', async () => {
    await act(async () => {
      renderNextActions({ closedPollCount: 1 })
    })
    expect(screen.getByText(/review 1 closed poll/i))
  })

  it('navigates to resorts tab on click', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderNextActions({ onNavigateToTab })
    })
    await eventUser.click(
      screen.getByRole('button', { name: /browse.*resorts/i })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('resorts', undefined)
  })

  it('navigates to proposals tab on click', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderNextActions({ draftCount: 1, onNavigateToTab })
    })
    await eventUser.click(
      screen.getByRole('button', {
        name: /submit 1 draft proposal for voting/i,
      })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT')
  })

  it('navigates to poll tab on click', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderNextActions({ activePoll: sampleActivePoll, onNavigateToTab })
    })
    await eventUser.click(
      screen.getByRole('button', { name: /vote in the active poll/i })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })
})
