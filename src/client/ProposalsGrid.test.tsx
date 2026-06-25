import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Proposal } from '../shared/types.d'
import ProposalsGrid from './ProposalsGrid'

const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))
const mockRejectProposal = mock(async () => ({}))
const mockRevertProposalToDraft = mock(async () => ({}))
const mockListAccommodations = mock(async () => [])
const mockCreateAccommodation = mock(async () => ({}))
const mockUpdateAccommodation = mock(async () => ({}))
const mockDeleteAccommodation = mock(async () => {})
const mockListDiscussion = mock(async () => [])

const proposals: Proposal[] = [
  {
    id: 'proposal-1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-1',
    proposerUserName: 'Alice',
    trip: 'trip-1',
    state: 'DRAFT',
    description: 'Z description',
    resortName: 'Z Resort',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    nearestAirport: 'Zürich Airport',
    transferTime: 60,
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
    id: 'proposal-2',
    created: '2024-01-02T00:00:00Z',
    updated: '2024-01-02T00:00:00Z',
    proposer: 'user-2',
    proposerUserName: 'Bob',
    trip: 'trip-1',
    state: 'SUBMITTED',
    description: 'A description',
    resortName: 'A Resort',
    startDate: '2024-02-01',
    endDate: '2024-02-07',
    nearestAirport: 'Geneva Airport',
    transferTime: 120,
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
    revertProposalToDraft: mockRevertProposalToDraft,
    listAccommodations: mockListAccommodations,
    createAccommodation: mockCreateAccommodation,
    updateAccommodation: mockUpdateAccommodation,
    deleteAccommodation: mockDeleteAccommodation,
    listDiscussion: mockListDiscussion,
    debounceMs: 0,
    ...overrides,
  }
}

async function renderGrid(props: Record<string, unknown> = {}) {
  await act(async () => {
    render(<ProposalsGrid {...defaultProps(props)} />)
  })
}

describe('ProposalsGrid', () => {
  it('renders proposals filtered by default status', async () => {
    await renderGrid()

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('sorts proposals alphabetically by resort name', async () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    await renderGrid({ proposals: allDrafts })

    const resortNames = screen.getAllByText(/Resort/)
    expect(resortNames.length).toBe(2)
    expect(resortNames[0].textContent).toContain('A Resort')
    expect(resortNames[1].textContent).toContain('Z Resort')
  })

  it('filters by DRAFT status', async () => {
    const user = userEvent.setup()
    await renderGrid()

    await user.click(screen.getByRole('button', { name: /^DRAFT/ }))
    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('filters by SUBMITTED status', async () => {
    const user = userEvent.setup()
    await renderGrid()

    await user.click(screen.getByRole('button', { name: /^SUBMITTED/ }))
    expect(screen.getByText(/A Resort/)).toBeDefined()
    expect(screen.queryByText(/Z Resort/)).toBeNull()
  })

  it('shows empty message when no proposals', async () => {
    await renderGrid({ proposals: [], emptyMessage: 'No proposals yet.' })

    expect(screen.getByText('No proposals yet.')).toBeDefined()
  })

  it('shows plain counts when not searching', async () => {
    await renderGrid()

    expect(screen.getByRole('button', { name: 'DRAFT (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'SUBMITTED (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'REJECTED (0)' })).toBeDefined()
  })

  it('shows filtered/total counts when searching', async () => {
    const user = userEvent.setup()
    await renderGrid()

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
    await renderGrid()

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'Z')
    await user.clear(searchInput)

    expect(screen.getByRole('button', { name: 'DRAFT (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'SUBMITTED (1)' })).toBeDefined()
  })

  it('shows search results empty state', async () => {
    const user = userEvent.setup()
    await renderGrid()

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'nonexistent')

    expect(
      screen.getByText(
        'No proposals match your search. Try different criteria.'
      )
    ).toBeDefined()
  })

  it('uses controlled statusFilter prop when provided', async () => {
    await renderGrid({ statusFilter: 'SUBMITTED' })

    expect(screen.getByText(/A Resort/)).toBeDefined()
    expect(screen.queryByText(/Z Resort/)).toBeNull()
  })

  it('falls back to internal DRAFT default when statusFilter is not provided', async () => {
    await renderGrid()

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('renders the My proposals toggle', async () => {
    await renderGrid()

    expect(screen.getByRole('switch', { name: 'My proposals' })).toBeDefined()
  })

  it('filters to only my proposals when toggle is active', async () => {
    const allDrafts: Proposal[] = proposals.map((p) => ({
      ...p,
      state: 'DRAFT' as const,
    }))
    const user = userEvent.setup()
    await renderGrid({ proposals: allDrafts })

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
    await renderGrid({ proposals: allDrafts })

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
    await renderGrid({ proposals: allDrafts })

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'Z')

    expect(screen.getByText(/Z Resort/)).toBeDefined()
    expect(screen.queryByText(/A Resort/)).toBeNull()
  })

  it('combines My proposals filter with status tabs', async () => {
    const user = userEvent.setup()
    await renderGrid()

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
    await renderGrid({ proposals: allDrafts })

    expect(screen.getByRole('button', { name: 'DRAFT (2)' })).toBeDefined()

    await user.click(screen.getByRole('switch', { name: 'My proposals' }))

    expect(screen.getByRole('button', { name: 'DRAFT (1/2)' })).toBeDefined()
  })
})
