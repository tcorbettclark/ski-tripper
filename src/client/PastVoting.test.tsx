import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Poll, Proposal, Vote } from '../shared/types.d'
import PastVoting from './PastVoting'
import { getToasts } from './toast'
import { dayjs } from './utils'

const TEST_IDS = {
  POLL: 'poll-1',
  TRIP: 'trip-1',
  USER: 'user-1',
  PROPOSAL_1: 'p-1',
  VOTE_1: 'v-1',
} as const

function createMockPoll(overrides: Partial<Poll> = {}): Poll {
  const baseDate = dayjs('2026-04-05T00:00:00.000Z')
  const startDate = baseDate.subtract(7, 'day').toISOString()
  const endDate = baseDate.subtract(1, 'day').toISOString()
  return {
    id: TEST_IDS.POLL,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    pollCreator: TEST_IDS.USER,
    pollCreatorUserName: 'Alice',
    state: 'CLOSED',
    trip: TEST_IDS.TRIP,
    proposalIds: [TEST_IDS.PROPOSAL_1],
    startDate,
    endDate,
    outcome: '',
    ...overrides,
  }
}

function createMockProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: TEST_IDS.PROPOSAL_1,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    proposer: TEST_IDS.USER,
    proposerUserName: 'Alice',
    trip: TEST_IDS.TRIP,
    state: 'SUBMITTED',
    description: 'French Alps',
    resortName: 'Chamonix',
    startDate: '2026-03-29T00:00:00.000Z',
    endDate: '2026-04-05T00:00:00.000Z',
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
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://chamonix.com'],
    latitude: '45.9237',
    longitude: '6.8694',
    linkedResortsDescription: '',
    ...overrides,
  }
}

function createMockVote(overrides: Partial<Vote> = {}): Vote {
  return {
    id: TEST_IDS.VOTE_1,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    poll: TEST_IDS.POLL,
    voter: TEST_IDS.USER,
    voterUserName: 'Alice',
    proposalIds: [TEST_IDS.PROPOSAL_1],
    tokenCounts: [5],
    ...overrides,
  }
}

function renderPastVoting(
  overrides: {
    poll?: Poll
    proposals?: Proposal[]
    listVotes?: (pollId: string, userId: string) => Promise<{ votes: Vote[] }>
  } = {}
) {
  const poll = overrides.poll ?? createMockPoll()
  const proposals = overrides.proposals ?? [createMockProposal()]
  const listVotes =
    overrides.listVotes ?? mock(() => Promise.resolve({ votes: [] }))
  const result = render(
    <PastVoting
      poll={poll}
      proposals={proposals}
      userId={TEST_IDS.USER}
      listVotes={listVotes}
    />
  )
  return { ...result, listVotes, poll, proposals }
}

describe('PastVoting', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders "Voting · CLOSED" label collapsed by default', async () => {
    await act(async () => {
      renderPastVoting()
    })

    await waitFor(() => {
      expect(screen.getByText(/Voting · CLOSED/i))
    })
  })

  it('calls listVotes on mount', async () => {
    const listVotes = mock(() => Promise.resolve({ votes: [] }))

    await act(async () => {
      renderPastVoting({ listVotes })
    })

    await waitFor(() => {
      expect(listVotes).toHaveBeenCalledWith(TEST_IDS.POLL, TEST_IDS.USER)
    })
  })

  it('shows voter count in header without expanding', async () => {
    await act(async () => {
      renderPastVoting({
        listVotes: mock(() => Promise.resolve({ votes: [createMockVote()] })),
      })
    })

    await waitFor(() => {
      expect(screen.getByText('1 voter'))
    })
  })

  it('shows "0 voters" before votes load', async () => {
    await act(async () => {
      renderPastVoting({
        listVotes: mock(() => new Promise<{ votes: Vote[] }>(() => {})),
      })
    })

    expect(screen.getByText('0 voters'))
  })

  it('renders outcome text when expanded and outcome present', async () => {
    const user = userEvent.setup()

    await act(async () => {
      renderPastVoting({
        poll: createMockPoll({
          outcome: 'Chamonix through to next round, Annecy rejected',
        }),
        listVotes: mock(() => Promise.resolve({ votes: [] })),
      })
    })

    const headerButton = screen.getByRole('button', {
      name: /Voting · CLOSED/i,
    })
    await user.click(headerButton)

    await waitFor(() => {
      expect(screen.getByText('Outcome'))
      expect(
        screen.getByText('Chamonix through to next round, Annecy rejected')
      )
    })
  })

  it('renders results when expanded', async () => {
    const user = userEvent.setup()

    await act(async () => {
      renderPastVoting({
        listVotes: mock(() => Promise.resolve({ votes: [createMockVote()] })),
      })
    })

    const headerButton = screen.getByRole('button', {
      name: /Voting · CLOSED/i,
    })
    await user.click(headerButton)

    await waitFor(() => {
      expect(screen.getByText(/Chamonix/))
    })
  })

  it('displays error when listVotes rejects', async () => {
    const listVotes = mock(() =>
      Promise.reject(new Error('Failed to load votes'))
    )

    await act(async () => {
      renderPastVoting({ listVotes })
    })

    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'Failed to load votes' && t.type === 'error'
        )
      ).toBeTruthy()
    })
  })

  it('renders date range in header', async () => {
    await act(async () => {
      renderPastVoting()
    })

    await waitFor(() => {
      expect(screen.getByText(/29 Mar 2026/i))
      expect(screen.getByText(/04 Apr 2026/i))
    })
  })

  it('collapses when clicked again after expanding', async () => {
    const user = userEvent.setup()

    await act(async () => {
      renderPastVoting({
        listVotes: mock(() => Promise.resolve({ votes: [] })),
      })
    })

    const headerButton = screen.getByRole('button', {
      name: /Voting · CLOSED/i,
    })

    await user.click(headerButton)
    await waitFor(() => {
      expect(screen.getByText(/Chamonix/))
    })

    await user.click(headerButton)
    expect(screen.queryByText(/Chamonix/)).toBeNull()
  })
})
