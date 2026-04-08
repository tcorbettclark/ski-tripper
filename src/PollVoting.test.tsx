import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PollVoting from './PollVoting'

const poll = {
  $id: 'poll-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  pollCreatorUserId: 'user-1',
  pollCreatorUserName: 'Test User',
  state: 'OPEN' as const,
  tripId: 'trip-1',
  proposalIds: ['p-1', 'p-2', 'p-3'],
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-12-31T23:59:59Z',
}
const proposals = [
  {
    $id: 'p-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Proposer',
    tripId: 'trip-1',
    state: 'SUBMITTED' as const,
    title: 'Chamonix Trip',
    description: 'Great skiing',
    resortName: 'Chamonix',
    departureDate: '2024-03-01',
    returnDate: '2024-03-08',
    nearestAirport: 'GVA',
    transferTime: '1 hour',
    accommodationName: 'Hotel A',
    accommodationUrl: 'https://example.com',
    altitudeRange: '1000-2000m',
    country: 'France',
    approximateCost: '£1000',
  },
  {
    $id: 'p-2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Proposer',
    tripId: 'trip-1',
    state: 'SUBMITTED' as const,
    title: 'Verbier Trip',
    description: 'Great skiing',
    resortName: 'Verbier',
    departureDate: '2024-03-01',
    returnDate: '2024-03-08',
    nearestAirport: 'GVA',
    transferTime: '2 hours',
    accommodationName: 'Hotel B',
    accommodationUrl: 'https://example.com',
    altitudeRange: '1500-3000m',
    country: 'Switzerland',
    approximateCost: '£1500',
  },
  {
    $id: 'p-3',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Proposer',
    tripId: 'trip-1',
    state: 'SUBMITTED' as const,
    title: 'Zermatt Trip',
    description: 'Great skiing',
    resortName: 'Zermatt',
    departureDate: '2024-03-01',
    returnDate: '2024-03-08',
    nearestAirport: 'ZRH',
    transferTime: '3 hours',
    accommodationName: 'Hotel C',
    accommodationUrl: 'https://example.com',
    altitudeRange: '2000-3500m',
    country: 'Switzerland',
    approximateCost: '£2000',
  },
]

function renderPollVoting(props = {}) {
  const defaults = {
    poll,
    proposals,
    myVote: null,
    userId: 'user-1',
    onVoteSaved: mock(() => {}),
    upsertVote: mock(() => Promise.resolve({ $id: 'v-new' })),
  }
  return render(<PollVoting {...defaults} {...props} />)
}

describe('PollVoting', () => {
  it('renders proposal names', () => {
    renderPollVoting()
    expect(screen.getByText(/Chamonix/))
    expect(screen.getByText(/Verbier/))
    expect(screen.getByText(/Zermatt/))
  })

  it('initialises all counts to 0 with no myVote', () => {
    renderPollVoting()
    expect(screen.getByTestId('count-p-1').textContent).toBe('0')
    expect(screen.getByTestId('count-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-p-3').textContent).toBe('0')
  })

  it('initialises from myVote', () => {
    const myVote = { proposalIds: ['p-1', 'p-3'], tokenCounts: [2, 1] }
    renderPollVoting({ myVote })
    expect(screen.getByTestId('count-p-1').textContent).toBe('2')
    expect(screen.getByTestId('count-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-p-3').textContent).toBe('1')
  })

  it('+ increments count', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    expect(screen.getByTestId('count-p-1').textContent).toBe('1')
  })

  it('− decrements count', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderPollVoting({ myVote })
    await user.click(
      screen.getByRole('button', { name: /remove vote from Chamonix/i })
    )
    expect(screen.getByTestId('count-p-1').textContent).toBe('0')
  })

  it('+ disabled when no tokens remaining', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Zermatt/i })
    )
    expect(
      (
        screen.getByRole('button', {
          name: /add vote to Chamonix/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /add vote to Verbier/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /add vote to Zermatt/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it('− disabled when count is zero', () => {
    renderPollVoting()
    expect(
      (
        screen.getByRole('button', {
          name: /remove vote from Chamonix/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /remove vote from Verbier/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: /remove vote from Zermatt/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it('save calls upsertVote with correct args and calls onVoteSaved', async () => {
    const user = userEvent.setup()
    const savedVote = { $id: 'v-new' }
    const upsertVote = mock(() => Promise.resolve(savedVote))
    const onVoteSaved = mock(() => {})
    renderPollVoting({ upsertVote, onVoteSaved })
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    )
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(upsertVote).toHaveBeenCalledWith(
        'poll-1',
        'trip-1',
        'user-1',
        ['p-1', 'p-2'],
        [2, 1]
      )
      expect(onVoteSaved).toHaveBeenCalledWith(savedVote)
    })
  })

  it('shows error on failure', async () => {
    const user = userEvent.setup()
    renderPollVoting({
      upsertVote: mock(() => Promise.reject(new Error('Vote failed'))),
    })
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(screen.getByText('Vote failed'))
    })
  })

  it('Save button disabled when current allocation matches saved vote', () => {
    const myVote = { proposalIds: ['p-1', 'p-2'], tokenCounts: [2, 1] }
    renderPollVoting({ myVote })
    expect(
      (screen.getByRole('button', { name: /save vote/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it('Save button enabled when current allocation differs from saved vote', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderPollVoting({ myVote })
    await user.click(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    )
    expect(screen.getByRole('button', { name: /save vote/i })).not.toBe(true)
  })

  it('displays proposals in alphabetical order regardless of proposalIds order', () => {
    const pollOutOfOrder = {
      $id: 'poll-1',
      $createdAt: '2024-01-01T00:00:00Z',
      $updatedAt: '2024-01-01T00:00:00Z',
      pollCreatorUserId: 'user-1',
      pollCreatorUserName: 'Test User',
      state: 'OPEN' as const,
      tripId: 'trip-1',
      proposalIds: ['p-3', 'p-1', 'p-2'],
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
    }
    const proposalsOutOfOrder = [
      {
        $id: 'p-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposerUserId: 'user-2',
        proposerUserName: 'Proposer',
        tripId: 'trip-1',
        state: 'SUBMITTED' as const,
        title: 'Chamonix Trip',
        description: 'Great skiing',
        resortName: 'Chamonix',
        departureDate: '2024-03-01',
        returnDate: '2024-03-08',
        nearestAirport: 'GVA',
        transferTime: '1 hour',
        accommodationName: 'Hotel A',
        accommodationUrl: 'https://example.com',
        altitudeRange: '1000-2000m',
        country: 'France',
        approximateCost: '£1000',
      },
      {
        $id: 'p-2',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposerUserId: 'user-2',
        proposerUserName: 'Proposer',
        tripId: 'trip-1',
        state: 'SUBMITTED' as const,
        title: 'Verbier Trip',
        description: 'Great skiing',
        resortName: 'Verbier',
        departureDate: '2024-03-01',
        returnDate: '2024-03-08',
        nearestAirport: 'GVA',
        transferTime: '2 hours',
        accommodationName: 'Hotel B',
        accommodationUrl: 'https://example.com',
        altitudeRange: '1500-3000m',
        country: 'Switzerland',
        approximateCost: '£1500',
      },
      {
        $id: 'p-3',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposerUserId: 'user-2',
        proposerUserName: 'Proposer',
        tripId: 'trip-1',
        state: 'SUBMITTED' as const,
        title: 'Zermatt Trip',
        description: 'Great skiing',
        resortName: 'Zermatt',
        departureDate: '2024-03-01',
        returnDate: '2024-03-08',
        nearestAirport: 'ZRH',
        transferTime: '3 hours',
        accommodationName: 'Hotel C',
        accommodationUrl: 'https://example.com',
        altitudeRange: '2000-3500m',
        country: 'Switzerland',
        approximateCost: '£2000',
      },
    ]
    renderPollVoting({ poll: pollOutOfOrder, proposals: proposalsOutOfOrder })
    const resortNames = screen.getAllByText(/Chamonix|Verbier|Zermatt/)
    expect(resortNames[0].textContent).toBe('Chamonix (at Hotel A)')
    expect(resortNames[1].textContent).toBe('Verbier (at Hotel B)')
    expect(resortNames[2].textContent).toBe('Zermatt (at Hotel C)')
  })

  it('Save button disabled after incrementing then decrementing back to saved value', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderPollVoting({ myVote })
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    expect(screen.getByRole('button', { name: /save vote/i })).not.toBe(true)
    await user.click(
      screen.getByRole('button', { name: /remove vote from Chamonix/i })
    )
    expect(
      (screen.getByRole('button', { name: /save vote/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})
