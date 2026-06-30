import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Poll } from '../shared/types.d'
import NextActions from './NextActions'

const sampleActivePoll: Poll = {
  id: 'poll-1',
  created: '2024-01-05T00:00:00Z',
  updated: '2024-01-05T00:00:00Z',
  pollCreator: 'user-1',
  pollCreatorUserName: 'Alice',
  state: 'OPEN',
  trip: 'trip-1',
  proposalIds: ['prop-2'],
  startDate: '2024-01-05T00:00:00Z',
  endDate: '2024-01-12T00:00:00Z',
  outcome: '',
}

const defaultProps = {
  resortCount: 3,
  draftCount: 0,
  submittedCount: 0,
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
    expect(screen.getByText(/Start voting from 2 proposals/i))
  })

  it('does not show create poll for non-coordinator', async () => {
    await act(async () => {
      renderNextActions({ submittedCount: 1, isCoordinator: false })
    })
    expect(screen.queryByText(/Start voting/i)).toBeNull()
  })

  it('shows vote in active poll when user has not voted', async () => {
    await act(async () => {
      renderNextActions({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: false,
      })
    })
    expect(screen.getByText(/Vote in the active voting/i))
  })

  it('shows view active poll when user has already voted', async () => {
    await act(async () => {
      renderNextActions({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: true,
      })
    })
    expect(screen.getByText(/View active voting/i))
    expect(screen.queryByText(/Vote in the active voting/i)).toBeNull()
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

  it('shows closed poll button', async () => {
    await act(async () => {
      renderNextActions({ closedPollCount: 1 })
    })
    expect(screen.getByText(/review 1 past voting rounds/i))
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

  it('navigates to voting tab on click', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderNextActions({ activePoll: sampleActivePoll, onNavigateToTab })
    })
    await eventUser.click(
      screen.getByRole('button', { name: /Vote in the active voting/i })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('voting', undefined)
  })
})
