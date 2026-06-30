import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import VotingResults from './VotingResults'

const poll = {
  id: 'poll-1',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  pollCreator: 'user-1',
  pollCreatorUserName: 'Test User',
  state: 'OPEN' as const,
  trip: 'trip-1',
  proposalIds: ['p-1', 'p-2', 'p-3'],
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  outcome: '',
}
const proposals = [
  {
    id: 'p-1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-1',
    proposerUserName: 'Test User',
    trip: 'trip-1',
    state: 'SUBMITTED' as const,
    description: 'A great trip to Chamonix',
    resortName: 'Chamonix',
    startDate: '2024-02-01',
    endDate: '2024-02-08',
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
    approximateCost: '1000',
  },
  {
    id: 'p-2',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-1',
    proposerUserName: 'Test User',
    trip: 'trip-1',
    state: 'SUBMITTED' as const,
    description: 'A great trip to Verbier',
    resortName: 'Verbier',
    startDate: '2024-02-01',
    endDate: '2024-02-08',
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
    approximateCost: '1200',
  },
  {
    id: 'p-3',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-1',
    proposerUserName: 'Test User',
    trip: 'trip-1',
    state: 'SUBMITTED' as const,
    description: 'A great trip to Zermatt',
    resortName: 'Zermatt',
    startDate: '2024-02-01',
    endDate: '2024-02-08',
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
    approximateCost: '1500',
  },
]

describe('VotingResults', () => {
  it('renders all proposal names', () => {
    render(<VotingResults poll={poll} proposals={proposals} votes={[]} />)
    expect(screen.getByText(/Chamonix/))
    expect(screen.getByText(/Verbier/))
    expect(screen.getByText(/Zermatt/))
  })

  it('shows "0 voters" when there are no votes', () => {
    render(<VotingResults poll={poll} proposals={proposals} votes={[]} />)
    expect(screen.getByText('0 voters'))
  })

  it('shows "1 voter" singular', () => {
    const votes = [
      {
        id: 'v-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        poll: 'poll-1',
        trip: 'trip-1',
        voter: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1'],
        tokenCounts: [1],
      },
    ]
    render(<VotingResults poll={poll} proposals={proposals} votes={votes} />)
    expect(screen.getByText('1 voter'))
  })

  it('shows "2 voters" plural', () => {
    const votes = [
      {
        id: 'v-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        poll: 'poll-1',
        trip: 'trip-1',
        voter: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1'],
        tokenCounts: [2],
      },
      {
        id: 'v-2',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        poll: 'poll-1',
        trip: 'trip-1',
        voter: 'user-3',
        voterUserName: 'Voter 2',
        proposalIds: ['p-2'],
        tokenCounts: [1],
      },
    ]
    render(<VotingResults poll={poll} proposals={proposals} votes={votes} />)
    expect(screen.getByText('2 voters'))
  })

  it('sorts proposals alphabetically by resort name regardless of votes', () => {
    const pollAlpha = {
      id: 'poll-1',
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-01T00:00:00Z',
      pollCreator: 'user-1',
      pollCreatorUserName: 'Test User',
      state: 'OPEN' as const,
      trip: 'trip-1',
      proposalIds: ['p-3', 'p-1', 'p-2'],
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      outcome: '',
    }
    const votes = [
      {
        id: 'v-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        poll: 'poll-1',
        trip: 'trip-1',
        voter: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1'],
        tokenCounts: [100],
      },
      {
        id: 'v-2',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        poll: 'poll-1',
        trip: 'trip-1',
        voter: 'user-3',
        voterUserName: 'Voter 2',
        proposalIds: ['p-2'],
        tokenCounts: [200],
      },
      {
        id: 'v-3',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        poll: 'poll-1',
        trip: 'trip-1',
        voter: 'user-4',
        voterUserName: 'Voter 3',
        proposalIds: ['p-3'],
        tokenCounts: [50],
      },
    ]
    render(
      <VotingResults poll={pollAlpha} proposals={proposals} votes={votes} />
    )
    const resortNames = screen.getAllByText(/Chamonix|Verbier|Zermatt/)
    expect(resortNames[0].textContent).toMatch(/^Chamonix$/)
    expect(resortNames[1].textContent).toMatch(/^Verbier$/)
    expect(resortNames[2].textContent).toMatch(/^Zermatt$/)
  })
})
