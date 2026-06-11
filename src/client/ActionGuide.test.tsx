import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Poll } from '../shared/types.d'
import type { ProposalDetail } from './ActionGuide'
import ActionGuide from './ActionGuide'

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
  myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
  submittedProposals: [] as Array<{ proposalId: string; resortName: string }>,
  draftsForDiscussion: [] as Array<{ proposalId: string; resortName: string }>,
  closedPollCount: 0,
  activePoll: undefined,
  userVotedInActivePoll: false,
  isCoordinator: false,
  onNavigateToTab: mock(
    (_tab: string, _statusFilter?: string, _detail?: ProposalDetail) => {}
  ),
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

  it('shows submitted count in Browse action button', async () => {
    await act(async () => {
      renderActionGuide({
        submittedProposals: [
          { proposalId: 'p3', resortName: 'Chamonix' },
          { proposalId: 'p4', resortName: 'Val Thorens' },
          { proposalId: 'p5', resortName: 'Zermatt' },
        ],
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Browse 3 submitted')).toBeTruthy()
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
        submittedProposals: [
          { proposalId: 'p3', resortName: 'Chamonix' },
          { proposalId: 'p4', resortName: 'Val Thorens' },
        ],
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
        submittedProposals: [
          { proposalId: 'p3', resortName: 'Chamonix' },
          { proposalId: 'p4', resortName: 'Val Thorens' },
        ],
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

  it('shows per-proposal Accommodations action when user has drafts', async () => {
    await act(async () => {
      renderActionGuide({
        draftCount: 1,
        myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Accommodation for: Chamonix/ })
      ).toBeTruthy()
    })
  })

  it('shows per-proposal Discuss action for drafts', async () => {
    await act(async () => {
      renderActionGuide({
        draftCount: 1,
        draftsForDiscussion: [{ proposalId: 'p1', resortName: 'Val Thorens' }],
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Comment on: Val Thorens/ })
      ).toBeTruthy()
    })
  })

  it('shows Submit action when user has drafts', async () => {
    await act(async () => {
      renderActionGuide({
        draftCount: 1,
        myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submit: Chamonix/ })
      ).toBeTruthy()
    })
  })

  it('does not show Submit or Accommodations when user has no drafts even if other drafts exist', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 2, myDrafts: [] })
    })
    await waitFor(() => {
      expect(screen.getByText('Browse 2 drafts')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
      expect(
        screen.queryByRole('button', { name: /Accommodation for:/ })
      ).toBeNull()
      expect(screen.queryByRole('button', { name: /Submit:/ })).toBeNull()
    })
  })

  it('does not show per-proposal actions when no drafts at all', async () => {
    await act(async () => {
      renderActionGuide({
        draftCount: 0,
        myDrafts: [],
        draftsForDiscussion: [],
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Draft Proposals')).toBeTruthy()
      expect(
        screen.queryByRole('button', { name: /Accommodation for:/ })
      ).toBeNull()
      expect(screen.queryByRole('button', { name: /Comment on:/ })).toBeNull()
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
    expect(onNavigateToTab).toHaveBeenCalledWith(
      'resorts',
      undefined,
      undefined
    )
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
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined, undefined)
  })

  it('navigates to poll tab when Create poll action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        submittedProposals: [
          { proposalId: 'p3', resortName: 'Chamonix' },
          { proposalId: 'p4', resortName: 'Val Thorens' },
        ],
        isCoordinator: true,
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Create poll')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Create poll'))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined, undefined)
  })

  it('navigates with detail when Accommodations action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        draftCount: 1,
        myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Accommodation for: Chamonix/ })
      ).toBeTruthy()
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Accommodation for: Chamonix/ })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT', {
      proposalId: 'p1',
      subTab: 'accommodations',
    })
  })

  it('navigates with detail when Discuss action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        draftCount: 1,
        draftsForDiscussion: [{ proposalId: 'p2', resortName: 'Val Thorens' }],
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Comment on: Val Thorens/ })
      ).toBeTruthy()
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Comment on: Val Thorens/ })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT', {
      proposalId: 'p2',
      subTab: 'discussion',
    })
  })

  it('navigates with detail for single draft Submit action', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        draftCount: 1,
        myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submit: Chamonix/ })
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit: Chamonix/ }))
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT', {
      proposalId: 'p1',
      subTab: 'proposal',
    })
  })

  it('does not include detail for Submit when user has multiple drafts', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        draftCount: 2,
        myDrafts: [
          { proposalId: 'p1', resortName: 'Chamonix' },
          { proposalId: 'p2', resortName: 'Val Thorens' },
        ],
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeTruthy()
    })
    const buttons = screen
      .getAllByText('Submit')
      .filter((el) => el.tagName === 'BUTTON')
    fireEvent.click(buttons[0])
    expect(onNavigateToTab).toHaveBeenCalledWith(
      'proposals',
      'DRAFT',
      undefined
    )
  })

  it('shows per-proposal Discuss action for submitted proposals', async () => {
    await act(async () => {
      renderActionGuide({
        submittedProposals: [
          { proposalId: 'p3', resortName: 'Chamonix' },
          { proposalId: 'p4', resortName: 'Val Thorens' },
        ],
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Discuss: Chamonix/ })
      ).toBeTruthy()
      expect(
        screen.getByRole('button', { name: /Discuss: Val Thorens/ })
      ).toBeTruthy()
    })
  })

  it('navigates with detail when submitted Discuss action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        submittedProposals: [{ proposalId: 'p3', resortName: 'Chamonix' }],
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Discuss: Chamonix/ })
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /Discuss: Chamonix/ }))
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'SUBMITTED', {
      proposalId: 'p3',
      subTab: 'discussion',
    })
  })

  it('does not show per-proposal Discuss actions when no submitted proposals', async () => {
    await act(async () => {
      renderActionGuide({
        submittedProposals: [],
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Submitted Proposals')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Discuss:/ })).toBeNull()
    })
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
    expect(onNavigateToTab).toHaveBeenCalledWith(
      'proposals',
      'DRAFT',
      undefined
    )
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
    const connectors = document.querySelectorAll('svg[data-connector]')
    expect(connectors.length).toBeGreaterThanOrEqual(1)
  })

  it('shows active connector between two active nodes', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 3, draftCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const resortsWrap = document.querySelector('[data-node="resorts"]')!
      .parentElement!
    const svg = resortsWrap.querySelector('svg[data-connector]')
    expect(svg).toBeTruthy()
    expect(svg!.getAttribute('data-active')).toBe('true')
  })

  it('shows dimmed connector when source node is pending', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 0, draftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const resortsWrap = document.querySelector('[data-node="resorts"]')!
      .parentElement!
    const svg = resortsWrap.querySelector('svg[data-connector]')
    expect(svg).toBeTruthy()
    expect(svg!.getAttribute('data-active')).toBeNull()
  })

  it('shows dimmed connector when target node is pending', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 3, draftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const resortsWrap = document.querySelector('[data-node="resorts"]')!
      .parentElement!
    const svg = resortsWrap.querySelector('svg[data-connector]')
    expect(svg).toBeTruthy()
    expect(svg!.getAttribute('data-active')).toBeNull()
  })

  it('shows dimmed connector between two pending nodes', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 0, draftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Catalog')).toBeTruthy()
    })
    const resortsWrap = document.querySelector('[data-node="resorts"]')!
      .parentElement!
    const svg = resortsWrap.querySelector('svg[data-connector]')
    expect(svg).toBeTruthy()
    expect(svg!.getAttribute('data-active')).toBeNull()
  })
})
