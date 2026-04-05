import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalsGrid from './ProposalsGrid'
import type { Proposal } from './types.d.ts'

const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))
const mockRejectProposal = mock(async () => ({}))

const proposals: Proposal[] = [
  {
    $id: 'proposal-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Alice',
    tripId: 'trip-1',
    state: 'DRAFT',
    title: 'Z Resort',
    description: 'Z description',
    resortName: 'Z Resort',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    nearestAirport: 'ZAI',
    transferTime: '1 hour',
    accommodationName: 'Z Hotel',
    accommodationUrl: '',
    altitudeRange: '1000m',
    country: 'Z Country',
    approximateCost: '$500',
  },
  {
    $id: 'proposal-2',
    $createdAt: '2024-01-02T00:00:00Z',
    $updatedAt: '2024-01-02T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Bob',
    tripId: 'trip-1',
    state: 'SUBMITTED',
    title: 'A Resort',
    description: 'A description',
    resortName: 'A Resort',
    startDate: '2024-02-01',
    endDate: '2024-02-07',
    nearestAirport: 'AIA',
    transferTime: '2 hours',
    accommodationName: 'A Hotel',
    accommodationUrl: '',
    altitudeRange: '2000m',
    country: 'A Country',
    approximateCost: '$1000',
  },
]

describe('ProposalsGrid', () => {
  it('renders all proposals', () => {
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByText('A Resort')).toBeDefined()
    expect(screen.getByText('Z Resort')).toBeDefined()
  })

  it('sorts proposals alphabetically by resort name', () => {
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBe(2)
  })

  it('filters by DRAFT status', async () => {
    const user = userEvent.setup()
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.getByText('Z Resort')).toBeDefined()
    expect(screen.queryByText('A Resort')).toBeNull()
  })

  it('filters by SUBMITTED status', async () => {
    const user = userEvent.setup()
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'SUBMITTED' }))
    expect(screen.getByText('A Resort')).toBeDefined()
    expect(screen.queryByText('Z Resort')).toBeNull()
  })

  it('shows empty message when no proposals', () => {
    render(
      <ProposalsGrid
        proposals={[]}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
        emptyMessage="No proposals yet."
      />
    )

    expect(screen.getByText('No proposals yet.')).toBeDefined()
  })

  it('shows search results empty state', async () => {
    const user = userEvent.setup()
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'nonexistent')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })

    expect(
      screen.getByText(
        'No proposals match your search. Try different criteria.'
      )
    ).toBeDefined()
  })
})
