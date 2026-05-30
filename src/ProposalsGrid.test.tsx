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
    summitAltitude: 3000,
    baseAltitude: 1000,
    pisteKm: 400,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 40,
    snowReliability: 'medium',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://z-resort.com'],
    latitude: '46.0',
    longitude: '7.0',
    linkedResortsDescription: '',
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
    summitAltitude: 2500,
    baseAltitude: 1200,
    pisteKm: 300,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Mar',
    websites: ['https://a-resort.com'],
    latitude: '46.5',
    longitude: '12.0',
    linkedResortsDescription: '',
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

    const resortNames = screen.getAllByText(/Resort/)
    expect(resortNames.length).toBe(2)
    expect(resortNames[0].textContent).toContain('A Resort')
    expect(resortNames[1].textContent).toContain('Z Resort')
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

  it('uses controlled statusFilter prop when provided', () => {
    render(<ProposalsGrid {...defaultProps({ statusFilter: 'SUBMITTED' })} />)

    expect(screen.getByText(/A Resort/)).toBeDefined()
    expect(screen.queryByText(/Z Resort/)).toBeNull()
  })

  it('falls back to internal DRAFT default when statusFilter is not provided', () => {
    render(<ProposalsGrid {...defaultProps()} />)

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('renders the My proposals toggle', () => {
    render(<ProposalsGrid {...defaultProps()} />)

    expect(screen.getByRole('switch', { name: 'My proposals' })).toBeDefined()
  })

  it('filters to only my proposals when toggle is active', async () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps({ proposals: allDrafts })} />)

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.getByText(/A Resort/)).toBeDefined()

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('shows all proposals again when My proposals toggle is deactivated', async () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps({ proposals: allDrafts })} />)

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))
    expect(screen.queryByText(/A Resort/)).toBeNull()

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))
    expect(screen.getByText(/A Resort/)).toBeDefined()
  })

  it('combines My proposals filter with search', async () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps({ proposals: allDrafts })} />)

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'Z')

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('combines My proposals filter with status tabs', async () => {
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps()} />)

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))
    expect(screen.getByText(/Z Resort/)).toBeDefined()

    await user.click(screen.getByRole('button', { name: /^SUBMITTED/ }))
    expect(screen.queryByText(/A Resort/)).toBeNull()
    expect(screen.queryByText(/Z Resort/)).toBeNull()
  })

  it('shows filtered/total counts when My proposals toggle is active', async () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    const user = userEvent.setup()
    render(<ProposalsGrid {...defaultProps({ proposals: allDrafts })} />)

    expect(screen.getByRole('button', { name: 'DRAFT (2)' })).toBeDefined()

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))

    expect(screen.getByRole('button', { name: 'DRAFT (1/2)' })).toBeDefined()
  })
})
