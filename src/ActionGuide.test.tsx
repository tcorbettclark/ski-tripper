import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ActionGuide from './ActionGuide'
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
  myDraftCount: 0,
  submittedCount: 0,
  approvedCount: 0,
  closedPollCount: 0,
  activePoll: undefined,
  userVotedInActivePoll: false,
  isCoordinator: false,
  onNavigateToTab: mock((_tab: string, _statusFilter?: string) => {}),
}

function renderActionGuide(props = {}) {
  return render(<ActionGuide {...defaultProps} {...props} />)
}

describe('ActionGuide', () => {
  it('renders the section heading', async () => {
    await act(async () => {
      renderActionGuide()
    })
    await waitFor(() => {
      expect(screen.getByText("What's Next"))
    })
  })

  it('renders all five journey nodes', async () => {
    await act(async () => {
      renderActionGuide()
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
      expect(screen.getByText('Draft Proposals')).toBeTruthy()
      expect(screen.getByText('Submitted Proposals')).toBeTruthy()
      expect(screen.getByText('Poll')).toBeTruthy()
      expect(screen.getByText('Results')).toBeTruthy()
    })
  })

  it('shows resort count in Browse action button', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 42 })
    })
    await waitFor(() => {
      expect(screen.getByText('Browse 42 resorts')).toBeTruthy()
    })
  })

  it('shows draft count in Browse action button', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 2 })
    })
    await waitFor(() => {
      expect(screen.getByText('Browse 2 drafts')).toBeTruthy()
    })
  })

  it('shows submitted count in Comment action button', async () => {
    await act(async () => {
      renderActionGuide({ submittedCount: 3 })
    })
    await waitFor(() => {
      expect(screen.getByText('Comment on 3 submitted')).toBeTruthy()
    })
  })

  it('shows approved count in View action button', async () => {
    await act(async () => {
      renderActionGuide({ approvedCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('View 1 approved')).toBeTruthy()
    })
  })

  it('shows Vote now action when poll is active and user has not voted', async () => {
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: false,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Vote now')).toBeTruthy()
    })
  })

  it('shows closing date when poll is active', async () => {
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: false,
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/Closes/)).toBeTruthy()
    })
  })

  it('shows poll status when user has voted', async () => {
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: true,
      })
    })
    await waitFor(() => {
      expect(screen.getByText("You've voted")).toBeTruthy()
    })
  })

  it('shows Create poll action for coordinator with submitted proposals', async () => {
    await act(async () => {
      renderActionGuide({
        submittedCount: 2,
        isCoordinator: true,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Create poll')).toBeTruthy()
    })
  })

  it('does not show Create poll for non-coordinator', async () => {
    await act(async () => {
      renderActionGuide({
        submittedCount: 2,
        isCoordinator: false,
      })
    })
    await waitFor(() => {
      expect(screen.queryByText('Create poll')).toBeNull()
    })
  })

  it('shows closed poll count on Results node', async () => {
    await act(async () => {
      renderActionGuide({ closedPollCount: 2 })
    })
    await waitFor(() => {
      expect(screen.getByText('Review 2 past polls')).toBeTruthy()
    })
  })

  it('shows Manage accommodations action when user has drafts', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 1, myDraftCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Manage accommodations')).toBeTruthy()
    })
  })

  it('shows Discuss self-action when any drafts exist', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 1, myDraftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Discuss')).toBeTruthy()
    })
  })

  it('shows Submit action when user has drafts', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 1, myDraftCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeTruthy()
    })
  })

  it('does not show Submit when user has no drafts even if other drafts exist', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 2, myDraftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Browse 2 drafts')).toBeTruthy()
      expect(screen.queryByText('Submit')).toBeNull()
      expect(screen.queryByText('Manage accommodations')).toBeNull()
    })
  })

  it('does not show self-loop actions when no drafts at all', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 0, myDraftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Draft Proposals')).toBeTruthy()
      expect(screen.queryByText('Manage accommodations')).toBeNull()
      expect(screen.queryByText('Discuss')).toBeNull()
    })
  })

  it('navigates to resorts tab when Resorts node clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Resort Catalog'))
    expect(onNavigateToTab).toHaveBeenCalledWith('resorts', undefined)
  })

  it('navigates to poll tab when Vote now action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Vote now')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Vote now'))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })

  it('navigates to poll tab when Create poll action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        submittedCount: 2,
        isCoordinator: true,
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Create poll')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Create poll'))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })

  it('navigates to proposals with DRAFT filter when draft action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({ draftCount: 2, onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByText('Browse 2 drafts')).toBeTruthy()
    })
    const draftButtons = screen
      .getAllByText('Browse 2 drafts')
      .filter((el) => el.tagName === 'BUTTON')
    fireEvent.click(draftButtons[0])
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT')
  })

  it('applies active status to Resorts node when resorts exist', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 5 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const resortsNode = screen
      .getByText('Resort Catalog')
      .closest('[data-node]')
    expect(resortsNode?.getAttribute('data-status')).toBe('active')
  })

  it('applies completed status to Results node when proposals approved', async () => {
    await act(async () => {
      renderActionGuide({ approvedCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Results')).toBeTruthy()
    })
    const resultsNode = screen.getByText('Results').closest('[data-node]')
    expect(resultsNode?.getAttribute('data-status')).toBe('completed')
  })

  it('applies pending status to a node with no activity', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const resortsNode = screen
      .getByText('Resort Catalog')
      .closest('[data-node]')
    expect(resortsNode?.getAttribute('data-status')).toBe('pending')
  })

  it('renders SVG connectors between nodes', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 3, draftCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const container = document.querySelector('[data-node="resorts"]')!
      .parentElement!
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]')
    expect(svgs.length).toBeGreaterThanOrEqual(1)
  })
})
