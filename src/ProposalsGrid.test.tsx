import { describe, expect, it, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'
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
    description: 'Z description',
    resortName: 'Z Resort',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    nearestAirport: 'ZAI',
    transferTime: '1 hour',
    country: 'Z Country',
    region: 'Alps',
    topAltitude: 3000,
    bottomAltitude: 1000,
    pisteKm: 400,
    difficulty: 'intermediate',
    liftCount: 40,
    snowReliability: 'medium',
    skiSeasonMonths: 'Dec-Apr',
    websiteUrl: 'https://z-resort.com',
    latitude: '46.0',
    longitude: '7.0',
  },
  {
    $id: 'proposal-2',
    $createdAt: '2024-01-02T00:00:00Z',
    $updatedAt: '2024-01-02T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Bob',
    tripId: 'trip-1',
    state: 'SUBMITTED',
    description: 'A description',
    resortName: 'A Resort',
    startDate: '2024-02-01',
    endDate: '2024-02-07',
    nearestAirport: 'AIA',
    transferTime: '2 hours',
    country: 'A Country',
    region: 'Dolomites',
    topAltitude: 2500,
    bottomAltitude: 1200,
    pisteKm: 300,
    difficulty: 'beginner',
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Mar',
    websiteUrl: 'https://a-resort.com',
    latitude: '46.5',
    longitude: '12.0',
  },
]

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    proposals,
    userId: 'user-1',
    onUpdated: () => {},
    onDeleted: () => {},
    onSubmitted: () => {},
    updateProposal: mockUpdateProposal,
    deleteProposal: mockDeleteProposal,
    submitProposal: mockSubmitProposal,
    rejectProposal: mockRejectProposal,
    debounceMs: 0,
    ...overrides,
  }
}

describe('ProposalsGrid', () => {
  it('renders proposals filtered by default status', () => {
    render(<ProposalsGrid {...defaultProps()} />)

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('sorts proposals alphabetically by resort name', () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    render(<ProposalsGrid {...defaultProps({ proposals: allDrafts })} />)

    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBe(2)
    expect(headings[0].textContent).toContain('A Resort')
    expect(headings[1].textContent).toContain('Z Resort')
  })

  it('filters by DRAFT status', async () => {
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /^DRAFT/ }))
    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('filters by SUBMITTED status', async () => {
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /^SUBMITTED/ }))
    expect(screen.getByText(/A Resort/)).toBeDefined()
    expect(screen.queryByText(/Z Resort/)).toBeNull()
  })

  it('shows empty message when no proposals', () => {
    render(
      <ProposalsGrid
        {...defaultProps({ proposals: [] })}
        emptyMessage="No proposals yet."
      />
    )

    expect(screen.getByText('No proposals yet.')).toBeDefined()
  })

  it('shows plain counts when not searching', () => {
    render(<ProposalsGrid {...defaultProps()} />)

    expect(screen.getByRole('button', { name: 'DRAFT (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'SUBMITTED (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'REJECTED (0)' })).toBeDefined()
  })

  it('shows filtered/total counts when searching', async () => {
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps()} />)

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'Z')

    expect(screen.getByRole('button', { name: 'DRAFT (1/1)' })).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'SUBMITTED (0/1)' })
    ).toBeDefined()
    expect(screen.getByRole('button', { name: 'REJECTED (0/0)' })).toBeDefined()
  })

  it('reverts to plain counts when search is cleared', async () => {
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps()} />)

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'Z')
    await user.clear(searchInput)

    expect(screen.getByRole('button', { name: 'DRAFT (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'SUBMITTED (1)' })).toBeDefined()
  })

  it('shows search results empty state', async () => {
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps()} />)

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'nonexistent')

    expect(
      screen.getByText(
        'No proposals match your search. Try different criteria.'
      )
    ).toBeDefined()
  })
})
