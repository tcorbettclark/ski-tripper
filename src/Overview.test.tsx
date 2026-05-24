import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import Overview from './Overview'
import type { Participant, Poll, Proposal, Resort, Trip } from './types.d.ts'

const user = { $id: 'user-1', name: 'Alice' } as Models.User

const sampleTrip: Trip = {
  $id: 'trip-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  code: 'blue-mountain-lodge',
  description: 'Alpine Adventure',
}

const sampleParticipants: Participant[] = [
  {
    $id: 'part-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    participantUserId: 'user-1',
    participantUserName: 'Alice',
    tripId: 'trip-1',
    role: 'coordinator',
  },
  {
    $id: 'part-2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    participantUserId: 'user-2',
    participantUserName: 'Bob',
    tripId: 'trip-1',
    role: 'participant',
  },
]

const sampleProposals: Proposal[] = [
  {
    $id: 'prop-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Alice',
    tripId: 'trip-1',
    state: 'DRAFT',
    description: 'Nice resort',
    resortName: 'Whistler',
    startDate: '2024-12-01',
    endDate: '2024-12-08',
    nearestAirport: 'YVR',
    transferTime: '2h',
    country: 'Canada',
    region: 'Rockies (Canadian)',
    topAltitude: 2184,
    bottomAltitude: 653,
    pisteKm: 200,
    difficulty: 'advanced',
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websiteUrl: 'https://whistler.com',
    latitude: '50.1163',
    longitude: '-122.9574',
  },
  {
    $id: 'prop-2',
    $createdAt: '2024-01-02T00:00:00Z',
    $updatedAt: '2024-01-02T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Bob',
    tripId: 'trip-1',
    state: 'SUBMITTED',
    description: 'Great slopes',
    resortName: 'Chamonix',
    startDate: '2025-01-10',
    endDate: '2025-01-17',
    nearestAirport: 'GVA',
    transferTime: '1h',
    country: 'France',
    region: 'Alps',
    topAltitude: 3842,
    bottomAltitude: 1035,
    pisteKm: 150,
    difficulty: 'advanced',
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websiteUrl: 'https://chamonix.com',
    latitude: '45.9237',
    longitude: '6.8694',
  },
]

const samplePolls: Poll[] = [
  {
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
  },
]

const sampleResorts: Resort[] = [
  {
    $id: 'resort-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    resortName: 'Whistler',
    country: 'Canada',
    region: 'Rockies (Canadian)',
    description: 'A great resort',
    latitude: '50.1163',
    longitude: '-122.9574',
    topAltitude: 2184,
    bottomAltitude: 653,
    nearestAirport: 'YVR',
    transferTime: '2h',
    pisteKm: 200,
    difficulty: 'advanced',
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websiteUrl: 'https://whistler.com',
    enriched: true,
  },
  {
    $id: 'resort-2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    resortName: 'Chamonix',
    country: 'France',
    region: 'Alps',
    description: 'Another great resort',
    latitude: '45.9237',
    longitude: '6.8694',
    topAltitude: 3842,
    bottomAltitude: 1035,
    nearestAirport: 'GVA',
    transferTime: '1h',
    pisteKm: 150,
    difficulty: 'advanced',
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websiteUrl: 'https://chamonix.com',
    enriched: true,
  },
  {
    $id: 'resort-3',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    resortName: 'Zermatt',
    country: 'Switzerland',
    region: 'Alps',
    description: 'Yet another resort',
    latitude: '46.0207',
    longitude: '7.7491',
    topAltitude: 3899,
    bottomAltitude: 1620,
    nearestAirport: 'GVA',
    transferTime: '3h 30m',
    pisteKm: 360,
    difficulty: 'advanced',
    liftCount: 53,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-May',
    websiteUrl: 'https://zermatt.ch',
    enriched: true,
  },
]

function renderOverview(props = {}) {
  const defaults = {
    user,
    trip: sampleTrip,
    tripId: 'trip-1',
    resorts: sampleResorts,
    onNavigateToTab: mock(() => {}),
    listTripParticipants: mock(() =>
      Promise.resolve({ participants: sampleParticipants })
    ),
    listProposals: mock(() => Promise.resolve({ proposals: sampleProposals })),
    listPolls: mock(() => Promise.resolve({ polls: samplePolls })),
  }
  return render(<Overview {...defaults} {...props} />)
}

describe('Overview', () => {
  it('renders trip description and code', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText('Alpine Adventure'))
      expect(screen.getByText('blue-mountain-lodge'))
    })
  })

  it('renders participants list', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText('Alice'))
      expect(screen.getByText('Bob'))
      expect(screen.getByText('Coordinator'))
    })
  })

  it('shows proposal status counts', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText(/1 draft/))
      expect(screen.getByText(/1 submitted/))
    })
  })

  it('shows active poll info', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText(/Active poll/))
      expect(screen.getByText(/Ends/))
    })
  })

  it('shows resort catalog summary', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText(/3 resorts available/))
      expect(screen.getByText(/Canada: 1/))
      expect(screen.getByText(/France: 1/))
      expect(screen.getByText(/Switzerland: 1/))
    })
  })

  it('shows loading state for participants, proposals, and polls while data loads', async () => {
    const listTripParticipants = mock(
      () => new Promise<{ participants: Participant[] }>(() => {})
    )
    const listProposals = mock(
      () => new Promise<{ proposals: Proposal[] }>(() => {})
    )
    const listPolls = mock(() => new Promise<{ polls: Poll[] }>(() => {}))

    await act(async () => {
      renderOverview({
        listTripParticipants,
        listProposals,
        listPolls,
      })
    })

    expect(screen.getAllByText(/Loading\.\.\./).length).toBeGreaterThanOrEqual(
      2
    )
  })

  it('shows "Loading resorts..." when resorts prop is empty', async () => {
    await act(async () => {
      renderOverview({ resorts: [] })
    })
    expect(screen.getByText(/Loading resorts\.\.\./)).toBeTruthy()
  })

  it('navigates to proposals tab on quick action click', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view proposals/i }))
    })
    await eventUser.click(
      screen.getByRole('button', { name: /view proposals/i })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals')
  })

  it('navigates to poll tab on quick action click', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go to active poll/i }))
    })
    await eventUser.click(
      screen.getByRole('button', { name: /go to active poll/i })
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('poll')
  })

  it('shows "View Polls" when no active poll', async () => {
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view polls/i }))
    })
  })

  it('shows error when participants fetch fails', async () => {
    await act(async () => {
      renderOverview({
        listTripParticipants: mock(() =>
          Promise.reject(new Error('Auth failed'))
        ),
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Auth failed'))
    })
  })

  it('shows error when proposals fetch fails', async () => {
    await act(async () => {
      renderOverview({
        listProposals: mock(() => Promise.reject(new Error('Failed to load'))),
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Failed to load'))
    })
  })

  it('shows "No activity yet" when no proposals or polls', async () => {
    await act(async () => {
      renderOverview({
        listProposals: mock(() => Promise.resolve({ proposals: [] })),
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/no activity yet/i))
    })
  })

  it('shows closed poll count', async () => {
    const closedPoll: Poll = {
      $id: 'poll-closed',
      $createdAt: '2024-01-01T00:00:00Z',
      $updatedAt: '2024-01-08T00:00:00Z',
      pollCreatorUserId: 'user-1',
      pollCreatorUserName: 'Alice',
      state: 'CLOSED',
      tripId: 'trip-1',
      proposalIds: ['prop-1'],
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-08T00:00:00Z',
    }
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [closedPoll] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/closed polls/i))
    })
  })
})
