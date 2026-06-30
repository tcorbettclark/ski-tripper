import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  Participant,
  Poll,
  Preferences,
  Proposal,
  ResortWithEmbedding,
  Trip,
  User,
  Vote,
} from '../shared/types.d'
import Overview from './Overview'
import { getToasts } from './toast'

const user = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  emailVerification: true,
} as User

const sampleTrip: Trip = {
  id: 'trip-1',
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-01T00:00:00.000Z',
  code: 'blue-mountain-lodge',
  description: 'Alpine Adventure',
}

const sampleParticipants: Participant[] = [
  {
    id: 'part-1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-1',
    userName: 'Alice',
    trip: 'trip-1',
    role: 'coordinator',
  },
  {
    id: 'part-2',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-2',
    userName: 'Bob',
    trip: 'trip-1',
    role: 'participant',
  },
]

const sampleProposals: Proposal[] = [
  {
    id: 'prop-1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    proposer: 'user-1',
    proposerUserName: 'Alice',
    trip: 'trip-1',
    state: 'DRAFT',
    description: 'Nice resort',
    resortName: 'Whistler',
    startDate: '2024-12-01',
    endDate: '2024-12-08',
    nearestAirport: 'Vancouver Airport',
    transferTime: 120,
    country: 'Canada',
    region: 'Rockies (Canadian)',
    summitAltitude: 2184,
    baseAltitude: 653,
    pisteKm: 200,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websites: ['https://whistler.com'],
    latitude: '50.1163',
    longitude: '-122.9574',
    linkedResortsDescription: '',
  },
  {
    id: 'prop-2',
    created: '2024-01-02T00:00:00Z',
    updated: '2024-01-02T00:00:00Z',
    proposer: 'user-2',
    proposerUserName: 'Bob',
    trip: 'trip-1',
    state: 'SUBMITTED',
    description: 'Great slopes',
    resortName: 'Chamonix',
    startDate: '2025-01-10',
    endDate: '2025-01-17',
    nearestAirport: 'Geneva Airport',
    transferTime: 60,
    country: 'France',
    region: 'Alps',
    summitAltitude: 3842,
    baseAltitude: 1035,
    pisteKm: 150,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://chamonix.com'],
    latitude: '45.9237',
    longitude: '6.8694',
    linkedResortsDescription: '',
  },
]

const samplePolls: Poll[] = [
  {
    id: 'poll-1',
    created: '2024-01-05T00:00:00Z',
    updated: '2024-01-05T00:00:00Z',
    pollCreator: 'user-1',
    pollCreatorUserName: 'Alice',
    state: 'OPEN',
    trip: 'trip-1',
    proposalIds: ['prop-2'],
    startDate: '2024-01-05T00:00:00Z',
    endDate: '2024-01-12T00:00:00Z',
    outcome: '',
  },
]

const sampleResorts: ResortWithEmbedding[] = [
  {
    id: 'whistler-rockies-canadian-canada',
    resortName: 'Whistler',
    country: 'Canada',
    region: 'Rockies (Canadian)',
    description: 'A great resort',
    latitude: '50.1163',
    longitude: '-122.9574',
    summitAltitude: 2184,
    baseAltitude: 653,
    nearestAirport: 'Vancouver Airport',
    transferTime: 120,
    pisteKm: 200,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websites: ['https://whistler.com'],
    linkedResortsDescription: '',
    embedding: [0.1, 0.2, 0.3],
  },
  {
    id: 'chamonix-alps-france',
    resortName: 'Chamonix',
    country: 'France',
    region: 'Alps',
    description: 'Another great resort',
    latitude: '45.9237',
    longitude: '6.8694',
    summitAltitude: 3842,
    baseAltitude: 1035,
    nearestAirport: 'Geneva Airport',
    transferTime: 60,
    pisteKm: 150,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://chamonix.com'],
    linkedResortsDescription: '',
    embedding: [0.4, 0.5, 0.6],
  },
  {
    id: 'zermatt-alps-switzerland',
    resortName: 'Zermatt',
    country: 'Switzerland',
    region: 'Alps',
    description: 'Yet another resort',
    latitude: '46.0207',
    longitude: '7.7491',
    summitAltitude: 3899,
    baseAltitude: 1620,
    nearestAirport: 'Geneva Airport',
    transferTime: 210,
    pisteKm: 360,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 53,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-May',
    websites: ['https://zermatt.ch'],
    linkedResortsDescription: '',
    embedding: [0.7, 0.8, 0.9],
  },
]

const samplePreferencesAlice: Preferences = {
  id: 'prefs-1',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  user: 'user-1',
  skiSnowboard: ['Ski'],
  difficulty: ['Red', 'Black'],
  piste: ['On-Piste', 'Off-Piste'],
  timeSlopes: 60,
  timeHuts: 20,
  timeApres: 15,
  timeHotel: 5,
  accommodation: ['Chalet'],
  notes: 'Snow quality',
}

const samplePreferencesBob: Preferences = {
  id: 'prefs-2',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  user: 'user-2',
  skiSnowboard: ['Snowboard'],
  difficulty: ['Blue'],
  piste: ['On-Piste'],
  timeSlopes: 40,
  timeHuts: 30,
  timeApres: 20,
  timeHotel: 10,
  accommodation: ['Hotel'],
  notes: '',
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
      expect(screen.getByTitle('Huts 20%')).toBeTruthy()
      expect(screen.getByTitle('Après 15%')).toBeTruthy()
      expect(screen.getByTitle('Hotel 5%')).toBeTruthy()
      expect(screen.getByTitle('Slopes 40%')).toBeTruthy()
      expect(screen.getByTitle('Hotel 10%')).toBeTruthy()
    })
  })

  it('shows most important aspect popup on heart click and closes on X or outside click', async () => {
    const eventUser = userEvent.setup()
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /show description/i })
      ).toBeTruthy()
    })
    expect(screen.queryByText('Snow quality')).toBeNull()

    await eventUser.click(
      screen.getByRole('button', { name: /show description/i })
    )

    await waitFor(() => {
      expect(screen.getByText('Snow quality')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    })

    await eventUser.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByText('Snow quality')).toBeNull()
    })
  })

  it('handles participants with no preferences', async () => {
    const participantNoPrefs: Participant = {
      id: 'part-3',
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-01T00:00:00Z',
      user: 'user-3',
      userName: 'Charlie',
      trip: 'trip-1',
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
      expect(screen.getAllByText(/1 draft/i).length).toBeGreaterThan(0)
    })
  })

  it('shows active poll info', async () => {
    await act(async () => {
      renderOverview()
    })
    await waitFor(() => {
      expect(screen.getByText(/vote now/i))
    })
  })

  it('renders preferences section immediately while data loads', async () => {
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

    expect(screen.getByText(/our preferences/i)).toBeDefined()
  })

  it('navigates to proposals tab when clicking submit drafts', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderOverview({
        onNavigateToTab,
        listPolls: mock(() => Promise.resolve({ polls: [] })),
      })
    })
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /^Submit:/ }).length
      ).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^Submit:/ })[0])
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT', {
      proposalId: 'prop-1',
      subTab: 'proposal',
    })
  })

  it('navigates to voting tab when clicking vote in active poll', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderOverview({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByText(/vote now/i))
    })
    fireEvent.click(screen.getByText(/vote now/i))
    expect(onNavigateToTab).toHaveBeenCalledWith('voting', undefined, undefined)
  })

  it('navigates to voting tab when clicking closed polls button', async () => {
    const closedPoll: Poll = {
      id: 'poll-closed',
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-08T00:00:00Z',
      pollCreator: 'user-1',
      pollCreatorUserName: 'Alice',
      state: 'CLOSED',
      trip: 'trip-1',
      proposalIds: ['prop-1'],
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-08T00:00:00Z',
      outcome: 'Chamonix through to next round',
    }
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderOverview({
        listPolls: mock(() => Promise.resolve({ polls: [closedPoll] })),
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/1 past voting rounds/i))
    })
    fireEvent.click(screen.getByText(/review \d+ past voting rounds/i))
    expect(onNavigateToTab).toHaveBeenCalledWith('voting', undefined, undefined)
  })

  it('navigates to resorts tab when clicking browse resorts', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderOverview({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /browse \d+ resorts/i }).length
      ).toBeGreaterThan(0)
    })
    fireEvent.click(
      screen.getAllByRole('button', { name: /browse \d+ resorts/i })[0]
    )
    expect(onNavigateToTab).toHaveBeenCalledWith(
      'resorts',
      undefined,
      undefined
    )
  })
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
      screen.getAllByRole('button', { name: /browse \d+ resorts/i }).length
    ).toBeGreaterThan(0)
  })
})

it('shows next step prompt for draft proposals', async () => {
  await act(async () => {
    renderOverview({
      listPolls: mock(() => Promise.resolve({ polls: [] })),
    })
  })
  await waitFor(() => {
    expect(screen.getAllByText(/1 draft/i).length).toBeGreaterThan(0)
  })
})

it('shows next step prompt when active poll needs user vote', async () => {
  await act(async () => {
    renderOverview({
      listVotes: mock(() => Promise.resolve({ votes: [] })),
    })
  })
  await waitFor(() => {
    expect(screen.getByText(/vote now/i))
  })
})

it('shows view active poll when user already voted', async () => {
  const votedVote: Vote = {
    id: 'vote-1',
    created: '2024-01-06T00:00:00Z',
    updated: '2024-01-06T00:00:00Z',
    poll: 'poll-1',
    voter: 'user-1',
    proposalIds: ['prop-2'],
    tokenCounts: [3],
  } as Vote
  await act(async () => {
    renderOverview({
      listVotes: mock(() => Promise.resolve({ votes: [votedVote] })),
    })
  })
  await waitFor(() => {
    expect(screen.queryByText(/vote now/i)).toBeNull()
    expect(screen.getByText(/view voting/i))
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
    expect(screen.getByText(/Browse \d+ submitted/i))
    expect(screen.getByRole('button', { name: /Discuss: Chamonix/ }))
    expect(screen.getByText(/Start voting/i))
  })
})

it('shows Browse submitted proposals when no active poll', async () => {
  await act(async () => {
    renderOverview({
      listPolls: mock(() => Promise.resolve({ polls: [] })),
    })
  })
  await waitFor(() => {
    expect(screen.getByText(/Browse \d+ submitted/i))
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

it('renders ActionGuide section', async () => {
  await act(async () => {
    renderOverview()
  })
  await waitFor(() => {
    expect(screen.getByText("What's Next"))
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
    expect(
      getToasts().some((t) => t.message === 'Auth failed' && t.type === 'error')
    ).toBeTruthy()
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
      screen.getAllByRole('button', { name: /browse \d+ resorts/i }).length
    ).toBeGreaterThan(0)
  })
})

it('shows closed poll button', async () => {
  const closedPoll: Poll = {
    id: 'poll-closed',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-08T00:00:00Z',
    pollCreator: 'user-1',
    pollCreatorUserName: 'Alice',
    state: 'CLOSED',
    trip: 'trip-1',
    proposalIds: ['prop-1'],
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-01-08T00:00:00Z',
    outcome: 'Chamonix through to next round',
  }
  await act(async () => {
    renderOverview({
      listPolls: mock(() => Promise.resolve({ polls: [closedPoll] })),
    })
  })
  await waitFor(() => {
    expect(screen.getByText(/1 past voting rounds/i))
  })
})

it('copies invite code to clipboard when copy button is clicked', async () => {
  const writeText = mock(() => Promise.resolve())
  navigator.clipboard.writeText = writeText
  await act(async () => {
    renderOverview()
  })
  await waitFor(() => {
    expect(screen.getByText('blue-mountain-lodge'))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /copy invite code/i }))
  })
  expect(writeText).toHaveBeenCalledWith('blue-mountain-lodge')
  await waitFor(() => {
    expect(
      getToasts().some((t) => t.message === 'Copied!' && t.type === 'success')
    ).toBeTruthy()
  })
})

it('shows error when copy fails', async () => {
  navigator.clipboard.writeText = mock(() => Promise.reject(new Error('No')))
  await act(async () => {
    renderOverview()
  })
  await waitFor(() => {
    expect(screen.getByText('blue-mountain-lodge'))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /copy invite code/i }))
  })
  await waitFor(() => {
    expect(
      getToasts().some(
        (t) => t.message === 'Failed to copy' && t.type === 'error'
      )
    ).toBeTruthy()
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
          if (userId === 'user-2') return Promise.resolve(samplePreferencesBob)
          return Promise.resolve(null)
        }),
      }}
    />
  )
  await waitFor(() => {
    expect(screen.getByTitle('Ski')).toBeTruthy()
  })

  const updatedPrefs: Preferences = {
    ...samplePreferencesAlice,
    skiSnowboard: ['Snowboard'],
    notes: 'Powder',
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
    expect(screen.getAllByTitle('Snowboard')).toHaveLength(2)
    expect(screen.queryByTitle('Ski')).toBeNull()
  })
})

it('uses current user name from user prop instead of stale participant name', async () => {
  const updatedUser = {
    id: 'user-1',
    name: 'Alice Updated',
    email: 'alice@example.com',
    emailVerification: true,
  } as User
  await act(async () => {
    renderOverview({ user: updatedUser })
  })
  await waitFor(() => {
    expect(screen.getByText('Alice Updated')).toBeTruthy()
  })
})
