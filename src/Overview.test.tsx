import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import Overview from './Overview'
import type {
  Participant,
  Poll,
  Preferences,
  Proposal,
  Resort,
  Trip,
  Vote,
} from './types.d.ts'

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

const samplePreferencesAlice: Preferences = {
  $id: 'prefs-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  userId: 'user-1',
  skiSnowboard: '["Ski"]',
  difficulty: '["Red","Black"]',
  piste: '["On-Piste","Off-Piste"]',
  timeSlopes: 60,
  timeEating: 20,
  timeApres: 15,
  timeHotel: 5,
  accommodation: '["Chalet"]',
  mostImportantAspect: 'Snow quality',
}

const samplePreferencesBob: Preferences = {
  $id: 'prefs-2',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  userId: 'user-2',
  skiSnowboard: '["Snowboard"]',
  difficulty: '["Blue"]',
  piste: '["On-Piste"]',
  timeSlopes: 40,
  timeEating: 30,
  timeApres: 20,
  timeHotel: 10,
  accommodation: '["Hotel"]',
  mostImportantAspect: '',
}

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
    listVotes: mock(() => Promise.resolve({ votes: [] })),
    getPreferences: mock((userId: string) => {
      if (userId === 'user-1') return Promise.resolve(samplePreferencesAlice)
      if (userId === 'user-2') return Promise.resolve(samplePreferencesBob)
      return Promise.resolve(null)
    }),
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
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
      expect(screen.getByText('Bob'))
    })
  })

  it('shows coordinator at the top of the list', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      const participantElements = screen.getAllByText(/Alice|Bob/)
      const first = participantElements.find((el) => el.textContent === 'Alice')
      const second = participantElements.find((el) => el.textContent === 'Bob')
      expect(first!.compareDocumentPosition(second!)).toBe(4)
    })
  })

  it('shows participant preferences as icon tags with hover tips', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByTitle('Ski')).toBeTruthy()
      expect(screen.getByTitle('Black/Red')).toBeTruthy()
      expect(screen.getByTitle('Snowboard')).toBeTruthy()
      expect(screen.getByTitle('Blue')).toBeTruthy()
    })
  })

  it('shows time allocation as VU meter bars for every category', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByTitle('Slopes 60%')).toBeTruthy()
      expect(screen.getByTitle('Eating 20%')).toBeTruthy()
      expect(screen.getByTitle('Après 15%')).toBeTruthy()
      expect(screen.getByTitle('Hotel 5%')).toBeTruthy()
      expect(screen.getByTitle('Slopes 40%')).toBeTruthy()
      expect(screen.getByTitle('Hotel 10%')).toBeTruthy()
    })
  })

  it('shows most important aspect with snowflake icon and label', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByTitle('Snow quality')).toBeTruthy()
      expect(screen.getByText('Snow quality')).toBeTruthy()
    })
  })

  it('handles participants with no preferences', async () => {
    const participantNoPrefs: Participant = {
      $id: 'part-3',
      $createdAt: '2024-01-01T00:00:00Z',
      $updatedAt: '2024-01-01T00:00:00Z',
      participantUserId: 'user-3',
      participantUserName: 'Charlie',
      tripId: 'trip-1',
      role: 'participant',
    }
    await act(async () => {
      renderOverview({
        listTripParticipants: mock(() =>
          Promise.resolve({
            participants: [...sampleParticipants, participantNoPrefs],
          })
        ),
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeTruthy()
    })
  })

  it('shows proposal status counts', async () => {
    await act(async () => {
      renderOverview({ listPolls: mock(() => Promise.resolve({ polls: [] })) })
    })
    await waitFor(() => {
      expect(screen.getByText(/submit 1 draft proposal for voting/i))
    })
  })

  it('shows active poll info', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText(/vote in the active poll/i))
    })
  })

  it('shows loading state for participants while data loads', async () => {
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
      1
    )
  })

  it('navigates to proposals tab when clicking submit drafts', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview({
        onNavigateToTab,
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/submit 1 draft proposal for voting/i))
    })
    await eventUser.click(
      screen.getByText(/submit 1 draft proposal for voting/i)
    )
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT')
  })

  it('navigates to poll tab when clicking vote in active poll', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByText(/vote in the active poll/i))
    })
    await eventUser.click(screen.getByText(/vote in the active poll/i))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })

  it('navigates to poll tab when clicking closed polls button', async () => {
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
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [closedPoll] })),
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/review 1 closed poll/i))
    })
    await eventUser.click(screen.getByText(/review 1 closed poll/i))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })

  it('navigates to resorts tab when clicking browse resorts', async () => {
    const onNavigateToTab = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview({ onNavigateToTab })
    })
    const browseButton = await screen.findByRole('button', {
      name: /browse.*resorts/i,
    })
    await eventUser.click(browseButton)
    expect(onNavigateToTab).toHaveBeenCalledWith('resorts', undefined)
  })

  it('shows next step prompt when no proposals exist', async () => {
    await act(async () => {
      renderOverview({
        listProposals: mock(() => Promise.resolve({ proposals: [] })),
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /browse.*resorts.*make a proposal/i,
        })
      )
    })
  })

  it('shows next step prompt for draft proposals', async () => {
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/submit 1 draft proposal for voting/i))
    })
  })

  it('shows next step prompt when active poll needs user vote', async () => {
    await act(async () => {
      renderOverview({
        listVotes: mock(() => Promise.resolve({ votes: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/vote in the active poll/i))
    })
  })

  it('shows view active poll when user already voted', async () => {
    const votedVote: Vote = {
      $id: 'vote-1',
      $createdAt: '2024-01-06T00:00:00Z',
      $updatedAt: '2024-01-06T00:00:00Z',
      pollId: 'poll-1',
      voterUserId: 'user-1',
      proposalIds: ['prop-2'],
      tokenCounts: [3],
    } as Vote
    await act(async () => {
      renderOverview({
        listVotes: mock(() => Promise.resolve({ votes: [votedVote] })),
      })
    })
    await waitFor(() => {
      expect(screen.queryByText(/vote in the active poll/i)).toBeNull()
      expect(screen.getByText(/view active poll/i))
    })
  })

  it('shows next step prompt for coordinator with submitted proposals and no poll', async () => {
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [] })),
        listProposals: mock(() =>
          Promise.resolve({ proposals: sampleProposals })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ participants: [sampleParticipants[0]] })
        ),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/comment on 1 submitted proposal/i))
      expect(screen.getByText(/create a poll from/i))
    })
  })

  it('shows comment on submitted proposals when no active poll', async () => {
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/comment on 1 submitted proposal/i))
    })
  })

  it('shows approved proposals button', async () => {
    const approvedProposal: Proposal = {
      ...sampleProposals[0],
      state: 'APPROVED',
    }
    await act(async () => {
      renderOverview({
        listProposals: mock(() =>
          Promise.resolve({ proposals: [approvedProposal] })
        ),
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/view 1 approved proposal/i))
    })
  })

  it('does not render Quick Actions section', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.queryByText(/quick actions/i)).toBeNull()
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

  it('shows only browse resorts when no proposals or polls', async () => {
    await act(async () => {
      renderOverview({
        listProposals: mock(() => Promise.resolve({ proposals: [] })),
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /browse.*resorts.*make a proposal/i,
        })
      )
    })
  })

  it('shows closed poll button', async () => {
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
      expect(screen.getByText(/review 1 closed poll/i))
    })
  })

  it('copies invite code to clipboard when copy button is clicked', async () => {
    const writeText = mock(() => Promise.resolve())
    navigator.clipboard.writeText = writeText
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText('blue-mountain-lodge'))
    })
    await eventUser.click(
      screen.getByRole('button', { name: /copy invite code/i })
    )
    expect(writeText).toHaveBeenCalledWith('blue-mountain-lodge')
    await waitFor(() => {
      expect(screen.getByText('Copied!'))
    })
  })

  it('shows error when copy fails', async () => {
    navigator.clipboard.writeText = mock(() => Promise.reject(new Error('No')))
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText('blue-mountain-lodge'))
    })
    await eventUser.click(
      screen.getByRole('button', { name: /copy invite code/i })
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to copy'))
    })
  })

  it('updates displayed preferences when onPreferencesUpdated is called', async () => {
    const { rerender } = render(
      <Overview
        {...{
          user,
          trip: sampleTrip,
          tripId: 'trip-1',
          resorts: sampleResorts,
          onNavigateToTab: mock(() => {}),
          listTripParticipants: mock(() =>
            Promise.resolve({ participants: sampleParticipants })
          ),
          listProposals: mock(() =>
            Promise.resolve({ proposals: sampleProposals })
          ),
          listPolls: mock(() => Promise.resolve({ polls: samplePolls })),
          listVotes: mock(() => Promise.resolve({ votes: [] })),
          getPreferences: mock((userId: string) => {
            if (userId === 'user-1')
              return Promise.resolve(samplePreferencesAlice)
            if (userId === 'user-2')
              return Promise.resolve(samplePreferencesBob)
            return Promise.resolve(null)
          }),
        }}
      />
    )
    await waitFor(() => {
      expect(screen.getByTitle('Snow quality')).toBeTruthy()
    })

    const updatedPrefs: Preferences = {
      ...samplePreferencesAlice,
      skiSnowboard: '["Snowboard"]',
      mostImportantAspect: 'Powder',
    }

    await act(async () => {
      rerender(
        <Overview
          {...{
            user,
            trip: sampleTrip,
            tripId: 'trip-1',
            resorts: sampleResorts,
            onNavigateToTab: mock(() => {}),
            listTripParticipants: mock(() =>
              Promise.resolve({ participants: sampleParticipants })
            ),
            listProposals: mock(() =>
              Promise.resolve({ proposals: sampleProposals })
            ),
            listPolls: mock(() => Promise.resolve({ polls: samplePolls })),
            listVotes: mock(() => Promise.resolve({ votes: [] })),
            getPreferences: mock((userId: string) => {
              if (userId === 'user-1') return Promise.resolve(updatedPrefs)
              if (userId === 'user-2')
                return Promise.resolve(samplePreferencesBob)
              return Promise.resolve(null)
            }),
            preferencesUpdated: { userId: 'user-1', preferences: updatedPrefs },
          }}
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByTitle('Powder')).toBeTruthy()
      expect(screen.queryByTitle('Snow quality')).toBeNull()
    })
  })
})
