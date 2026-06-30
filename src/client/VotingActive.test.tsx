import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Vote } from '../shared/types.d'
import { getToasts } from './toast'
import VotingActive from './VotingActive'

const poll = {
  id: 'poll-1',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  pollCreator: 'user-1',
  pollCreatorUserName: 'Test User',
  state: 'OPEN' as const,
  trip: 'trip-1',
  proposalIds: ['p-1', 'p-2', 'p-3'],
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-12-31T23:59:59Z',
  outcome: '',
}
const proposals = [
  {
    id: 'p-1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-2',
    proposerUserName: 'Proposer',
    trip: 'trip-1',
    state: 'SUBMITTED' as const,
    description: 'Great skiing',
    resortName: 'Chamonix',
    startDate: '2024-03-01',
    endDate: '2024-03-08',
    nearestAirport: 'Geneva Airport',
    transferTime: 60,
    country: 'France',
    region: 'Alps',
    summitAltitude: 3842,
    baseAltitude: 1000,
    pisteKm: 150,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 50,
    snowReliability: 'high' as const,
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://chamonix.com'],
    latitude: '45.9237',
    longitude: '6.8694',
    linkedResortsDescription: '',
    accommodationName: 'Hotel A',
    accommodationUrl: 'https://example.com',
    approximateCost: '£1000',
  },
  {
    id: 'p-2',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-2',
    proposerUserName: 'Proposer',
    trip: 'trip-1',
    state: 'SUBMITTED' as const,
    description: 'Great skiing',
    resortName: 'Verbier',
    startDate: '2024-03-01',
    endDate: '2024-03-08',
    nearestAirport: 'Geneva Airport',
    transferTime: 120,
    country: 'Switzerland',
    region: 'Alps',
    summitAltitude: 3330,
    baseAltitude: 1500,
    pisteKm: 400,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 60,
    snowReliability: 'medium' as const,
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://verbier.com'],
    latitude: '46.0964',
    longitude: '7.2212',
    linkedResortsDescription: '',
    accommodationName: 'Hotel B',
    accommodationUrl: 'https://example.com',
    approximateCost: '£1500',
  },
  {
    id: 'p-3',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-2',
    proposerUserName: 'Proposer',
    trip: 'trip-1',
    state: 'SUBMITTED' as const,
    description: 'Great skiing',
    resortName: 'Zermatt',
    startDate: '2024-03-01',
    endDate: '2024-03-08',
    nearestAirport: 'Zürich Airport',
    transferTime: 180,
    country: 'Switzerland',
    region: 'Alps',
    summitAltitude: 3883,
    baseAltitude: 1620,
    pisteKm: 360,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 55,
    snowReliability: 'high' as const,
    skiSeasonMonths: 'Nov-May',
    websites: ['https://zermatt.com'],
    latitude: '46.0207',
    longitude: '7.7491',
    linkedResortsDescription: '',
    accommodationName: 'Hotel C',
    accommodationUrl: 'https://example.com',
    approximateCost: '£2000',
  },
]

const defaultProps = {
  poll,
  proposals,
  myVote: null as Vote | null,
  userId: 'user-1',
  userName: 'Test User',
  onVoteSaved: mock(() => {}),
  upsertVote: mock(() => Promise.resolve({ id: 'v-new' })),
}

function renderVotingActive(props = {}) {
  return render(<VotingActive {...defaultProps} {...props} />)
}

describe('VotingActive', () => {
  it('renders proposal names', () => {
    renderVotingActive()
    expect(screen.getByText(/Chamonix/))
    expect(screen.getByText(/Verbier/))
    expect(screen.getByText(/Zermatt/))
  })

  it('initialises all counts to 0 with no myVote', () => {
    renderVotingActive()
    expect(screen.getByTestId('count-text-p-1').textContent).toBe('0')
    expect(screen.getByTestId('count-text-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-text-p-3').textContent).toBe('0')
  })

  it('initialises from myVote', () => {
    const myVote = { proposalIds: ['p-1', 'p-3'], tokenCounts: [2, 1] }
    renderVotingActive({ myVote })
    expect(screen.getByTestId('count-text-p-1').textContent).toBe('2')
    expect(screen.getByTestId('count-text-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-text-p-3').textContent).toBe('1')
  })

  it('+ increments count', async () => {
    const user = userEvent.setup()
    renderVotingActive()
    await user.click(
      screen.getByRole('button', { name: /add token to Chamonix/i })
    )
    expect(screen.getByTestId('count-text-p-1').textContent).toBe('1')
  })

  it('− decrements count', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderVotingActive({ myVote })
    await user.click(
      screen.getByRole('button', { name: /remove token from Chamonix/i })
    )
    expect(screen.getByTestId('count-text-p-1').textContent).toBe('0')
  })

  it('+ disabled when no tokens remaining', async () => {
    const user = userEvent.setup()
    renderVotingActive()
    await user.click(
      screen.getByRole('button', { name: /add token to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add token to Verbier/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add token to Zermatt/i })
    )
    expect(
      (
        screen.getByRole('button', {
          name: /add token to Chamonix/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /add token to Verbier/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /add token to Zermatt/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it('− disabled when count is zero', () => {
    renderVotingActive()
    expect(
      (
        screen.getByRole('button', {
          name: /remove token from Chamonix/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /remove token from Verbier/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /remove token from Zermatt/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it('save calls upsertVote with correct args and calls onVoteSaved', async () => {
    const user = userEvent.setup()
    const savedVote = { id: 'v-new' }
    const upsertVote = mock(() => Promise.resolve(savedVote))
    const onVoteSaved = mock(() => {})
    renderVotingActive({ upsertVote, onVoteSaved })
    await user.click(
      screen.getByRole('button', { name: /add token to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add token to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add token to Verbier/i })
    )
    await user.click(screen.getByRole('button', { name: /cast vote/i }))
    await waitFor(() => {
      expect(upsertVote).toHaveBeenCalledWith(
        'poll-1',
        'user-1',
        'Test User',
        ['p-1', 'p-2'],
        [2, 1]
      )
      expect(onVoteSaved).toHaveBeenCalledWith(savedVote)
    })
  })

  it('Save button enabled when current allocation differs from saved vote', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderVotingActive({ myVote })
    await user.click(
      screen.getByRole('button', { name: /add token to Verbier/i })
    )
    expect(screen.getByRole('button', { name: /cast vote/i })).not.toBe(true)
  })

  it('displays proposals in alphabetical order regardless of proposalIds order', () => {
    const pollOutOfOrder = {
      id: 'poll-1',
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-01T00:00:00Z',
      pollCreator: 'user-1',
      pollCreatorUserName: 'Test User',
      state: 'OPEN' as const,
      trip: 'trip-1',
      proposalIds: ['p-3', 'p-1', 'p-2'],
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
    }
    const proposalsOutOfOrder = [
      {
        id: 'p-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposer: 'user-2',
        proposerUserName: 'Proposer',
        trip: 'trip-1',
        state: 'SUBMITTED' as const,
        description: 'Great skiing',
        resortName: 'Chamonix',
        startDate: '2024-03-01',
        endDate: '2024-03-08',
        nearestAirport: 'Geneva Airport',
        transferTime: 60,
        country: 'France',
        region: 'Alps',
        summitAltitude: 3842,
        baseAltitude: 1000,
        pisteKm: 150,
        beginnerPct: 0,
        intermediatePct: 0,
        advancedPct: 0,
        liftCount: 50,
        snowReliability: 'high' as const,
        skiSeasonMonths: 'Dec-Apr',
        websites: ['https://chamonix.com'],
        latitude: '45.9237',
        longitude: '6.8694',
        linkedResortsDescription: '',
        accommodationName: 'Hotel A',
        accommodationUrl: 'https://example.com',
        approximateCost: '£1000',
      },
      {
        id: 'p-2',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposer: 'user-2',
        proposerUserName: 'Proposer',
        trip: 'trip-1',
        state: 'SUBMITTED' as const,
        description: 'Great skiing',
        resortName: 'Verbier',
        startDate: '2024-03-01',
        endDate: '2024-03-08',
        nearestAirport: 'Geneva Airport',
        transferTime: 120,
        country: 'Switzerland',
        region: 'Alps',
        summitAltitude: 3330,
        baseAltitude: 1500,
        pisteKm: 400,
        beginnerPct: 0,
        intermediatePct: 0,
        advancedPct: 0,
        liftCount: 60,
        snowReliability: 'medium' as const,
        skiSeasonMonths: 'Dec-Apr',
        websites: ['https://verbier.com'],
        latitude: '46.0964',
        longitude: '7.2212',
        linkedResortsDescription: '',
        accommodationName: 'Hotel B',
        accommodationUrl: 'https://example.com',
        approximateCost: '£1500',
      },
      {
        id: 'p-3',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposer: 'user-2',
        proposerUserName: 'Proposer',
        trip: 'trip-1',
        state: 'SUBMITTED' as const,
        description: 'Great skiing',
        resortName: 'Zermatt',
        startDate: '2024-03-01',
        endDate: '2024-03-08',
        nearestAirport: 'Zürich Airport',
        transferTime: 180,
        country: 'Switzerland',
        region: 'Alps',
        summitAltitude: 3883,
        baseAltitude: 1620,
        pisteKm: 360,
        beginnerPct: 0,
        intermediatePct: 0,
        advancedPct: 0,
        liftCount: 55,
        snowReliability: 'high' as const,
        skiSeasonMonths: 'Nov-May',
        websites: ['https://zermatt.com'],
        latitude: '46.0207',
        longitude: '7.7491',
        linkedResortsDescription: '',
        accommodationName: 'Hotel C',
        accommodationUrl: 'https://example.com',
        approximateCost: '£2000',
      },
    ]
    renderVotingActive({ poll: pollOutOfOrder, proposals: proposalsOutOfOrder })
    const resortNames = screen.getAllByText(/Chamonix|Verbier|Zermatt/)
    expect(resortNames[0].textContent).toBe('Chamonix')
    expect(resortNames[1].textContent).toBe('Verbier')
    expect(resortNames[2].textContent).toBe('Zermatt')
  })

  it('Save button disabled after incrementing then decrementing back to saved value', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderVotingActive({ myVote })
    await user.click(
      screen.getByRole('button', { name: /add token to Chamonix/i })
    )
    expect(screen.getByRole('button', { name: /cast vote/i })).not.toBe(true)
    await user.click(
      screen.getByRole('button', { name: /remove token from Chamonix/i })
    )
    expect(
      (screen.getByRole('button', { name: /cast vote/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it('shows error when upsertVote rejects', async () => {
    const user = userEvent.setup()
    const failingUpsert = mock(() => Promise.reject(new Error('Save failed')))
    const onVoteSaved = mock()
    renderVotingActive({ upsertVote: failingUpsert, onVoteSaved })
    await user.click(
      screen.getByRole('button', { name: /add token to Chamonix/i })
    )
    await user.click(screen.getByRole('button', { name: /cast vote/i }))
    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'Save failed' && t.type === 'error'
        )
      ).toBeTruthy()
    })
    expect(onVoteSaved).not.toHaveBeenCalled()
  })

  it('Save button disabled when myVote matches current allocations on initial render', () => {
    const myVote = { proposalIds: ['p-1', 'p-3'], tokenCounts: [2, 1] }
    renderVotingActive({ myVote })
    expect(
      (screen.getByRole('button', { name: /cast vote/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it('Save button disabled when myVote arrives after initial render', async () => {
    const { rerender } = renderVotingActive()
    expect(
      (screen.getByRole('button', { name: /cast vote/i }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
    const myVote: Vote = {
      id: 'v-1',
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-01T00:00:00Z',
      poll: 'poll-1',
      voter: 'user-1',
      voterUserName: 'Test User',
      proposalIds: ['p-1', 'p-3'],
      tokenCounts: [2, 1],
    }
    rerender(<VotingActive {...defaultProps} myVote={myVote} />)
    expect(screen.getByTestId('count-text-p-1').textContent).toBe('2')
    expect(screen.getByTestId('count-text-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-text-p-3').textContent).toBe('1')
    expect(
      (screen.getByRole('button', { name: /cast vote/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})
