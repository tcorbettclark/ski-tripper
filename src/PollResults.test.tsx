import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import PollResults from './PollResults'

const poll = {
  $id: 'poll-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  pollCreatorUserId: 'user-1',
  pollCreatorUserName: 'Test User',
  state: 'OPEN' as const,
  tripId: 'trip-1',
  proposalIds: ['p-1', 'p-2', 'p-3'],
  startDate: '2024-01-01',
  endDate: '2024-01-07',
}
const proposals = [
  {
    $id: 'p-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Test User',
    tripId: 'trip-1',
    state: 'SUBMITTED' as const,
    title: 'Chamonix Trip',
    description: 'A great trip to Chamonix',
    resortName: 'Chamonix',
    departureDate: '2024-02-01',
    returnDate: '2024-02-08',
    nearestAirport: 'GVA',
    transferTime: '1 hour',
    accommodationName: 'Hotel A',
    accommodationUrl: 'https://example.com',
    altitudeRange: '1000-2000m',
    country: 'France',
    approximateCost: '1000',
  },
  {
    $id: 'p-2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Test User',
    tripId: 'trip-1',
    state: 'SUBMITTED' as const,
    title: 'Verbier Trip',
    description: 'A great trip to Verbier',
    resortName: 'Verbier',
    departureDate: '2024-02-01',
    returnDate: '2024-02-08',
    nearestAirport: 'GVA',
    transferTime: '2 hours',
    accommodationName: 'Hotel B',
    accommodationUrl: 'https://example.com',
    altitudeRange: '1500-3000m',
    country: 'Switzerland',
    approximateCost: '1200',
  },
  {
    $id: 'p-3',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Test User',
    tripId: 'trip-1',
    state: 'SUBMITTED' as const,
    title: 'Zermatt Trip',
    description: 'A great trip to Zermatt',
    resortName: 'Zermatt',
    departureDate: '2024-02-01',
    returnDate: '2024-02-08',
    nearestAirport: 'ZRH',
    transferTime: '3 hours',
    accommodationName: 'Hotel C',
    accommodationUrl: 'https://example.com',
    altitudeRange: '2000-4000m',
    country: 'Switzerland',
    approximateCost: '1500',
  },
]

describe('PollResults', () => {
  it('renders all proposal names', () => {
    render(<PollResults poll={poll} proposals={proposals} votes={[]} />)
    expect(screen.getByText(/Chamonix/))
    expect(screen.getByText(/Verbier/))
    expect(screen.getByText(/Zermatt/))
  })

  it('shows "0 votes" when there are no votes', () => {
    render(<PollResults poll={poll} proposals={proposals} votes={[]} />)
    expect(screen.getByText('0 votes'))
  })

  it('shows "1 vote" singular', () => {
    const votes = [
      {
        $id: 'v-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1'],
        tokenCounts: [1],
      },
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    expect(screen.getByText('1 vote'))
  })

  it('shows "2 votes" plural', () => {
    const votes = [
      {
        $id: 'v-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1'],
        tokenCounts: [2],
      },
      {
        $id: 'v-2',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-3',
        voterUserName: 'Voter 2',
        proposalIds: ['p-2'],
        tokenCounts: [1],
      },
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    expect(screen.getByText('2 votes'))
  })

  it('shows correct total tokens per proposal', () => {
    const votes = [
      {
        $id: 'v-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1', 'p-2'],
        tokenCounts: [2, 1],
      },
      {
        $id: 'v-2',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-3',
        voterUserName: 'Voter 2',
        proposalIds: ['p-1'],
        tokenCounts: [1],
      },
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    // p-1 total = 3, p-2 total = 1, p-3 total = 0
    const totals = screen.getAllByText('3')
    expect(totals.length).toBeGreaterThan(0)
    expect(screen.getByText('1'))
    expect(screen.getByText('0'))
  })

  it('sorts proposals alphabetically by resort name regardless of votes', () => {
    const pollAlpha = {
      $id: 'poll-1',
      $createdAt: '2024-01-01T00:00:00Z',
      $updatedAt: '2024-01-01T00:00:00Z',
      pollCreatorUserId: 'user-1',
      pollCreatorUserName: 'Test User',
      state: 'OPEN' as const,
      tripId: 'trip-1',
      proposalIds: ['p-3', 'p-1', 'p-2'],
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    }
    const proposalsAlpha = [
      {
        $id: 'p-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposerUserId: 'user-1',
        proposerUserName: 'Test User',
        tripId: 'trip-1',
        state: 'SUBMITTED' as const,
        title: 'Chamonix Trip',
        description: 'A great trip to Chamonix',
        resortName: 'Chamonix',
        departureDate: '2024-02-01',
        returnDate: '2024-02-08',
        nearestAirport: 'GVA',
        transferTime: '1 hour',
        accommodationName: 'Hotel A',
        accommodationUrl: 'https://example.com',
        altitudeRange: '1000-2000m',
        country: 'France',
        approximateCost: '1000',
      },
      {
        $id: 'p-2',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposerUserId: 'user-1',
        proposerUserName: 'Test User',
        tripId: 'trip-1',
        state: 'SUBMITTED' as const,
        title: 'Verbier Trip',
        description: 'A great trip to Verbier',
        resortName: 'Verbier',
        departureDate: '2024-02-01',
        returnDate: '2024-02-08',
        nearestAirport: 'GVA',
        transferTime: '2 hours',
        accommodationName: 'Hotel B',
        accommodationUrl: 'https://example.com',
        altitudeRange: '1500-3000m',
        country: 'Switzerland',
        approximateCost: '1200',
      },
      {
        $id: 'p-3',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposerUserId: 'user-1',
        proposerUserName: 'Test User',
        tripId: 'trip-1',
        state: 'SUBMITTED' as const,
        title: 'Zermatt Trip',
        description: 'A great trip to Zermatt',
        resortName: 'Zermatt',
        departureDate: '2024-02-01',
        returnDate: '2024-02-08',
        nearestAirport: 'ZRH',
        transferTime: '3 hours',
        accommodationName: 'Hotel C',
        accommodationUrl: 'https://example.com',
        altitudeRange: '2000-4000m',
        country: 'Switzerland',
        approximateCost: '1500',
      },
    ]
    const votes = [
      {
        $id: 'v-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-1'],
        tokenCounts: [100],
      },
      {
        $id: 'v-2',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-3',
        voterUserName: 'Voter 2',
        proposalIds: ['p-2'],
        tokenCounts: [200],
      },
      {
        $id: 'v-3',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-4',
        voterUserName: 'Voter 3',
        proposalIds: ['p-3'],
        tokenCounts: [50],
      },
    ]
    render(
      <PollResults poll={pollAlpha} proposals={proposalsAlpha} votes={votes} />
    )
    const labels = screen.getAllByTestId('proposal-label')
    expect(labels[0].textContent).toMatch(/^Chamonix \(at Hotel A\)$/)
    expect(labels[1].textContent).toMatch(/^Verbier \(at Hotel B\)$/)
    expect(labels[2].textContent).toMatch(/^Zermatt \(at Hotel C\)$/)
  })

  it('ignores token allocations for proposalIds not in the poll', () => {
    const votes = [
      {
        $id: 'v-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        pollId: 'poll-1',
        tripId: 'trip-1',
        voterUserId: 'user-2',
        voterUserName: 'Voter 1',
        proposalIds: ['p-99'],
        tokenCounts: [5],
      },
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    // p-99 is not in poll, totals should all be 0
    const zeros = screen.getAllByText('0')
    expect(zeros).toHaveLength(3)
  })
})
