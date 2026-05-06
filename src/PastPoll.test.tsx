import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import PastPoll from './PastPoll'
import type { Poll, Proposal, Vote } from './types.d.ts'

const TEST_IDS = {
  POLL: 'poll-1',
  TRIP: 'trip-1',
  USER: 'user-1',
  PROPOSAL_1: 'p-1',
  VOTE_1: 'v-1',
} as const

function createMockPoll(overrides: Partial<Poll> = {}): Poll {
  const baseDate = new Date('2026-04-05T00:00:00.000Z')
  const startDate = new Date(
    baseDate.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()
  const endDate = new Date(
    baseDate.getTime() - 1 * 24 * 60 * 60 * 1000
  ).toISOString()
  return {
    $id: TEST_IDS.POLL,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    pollCreatorUserId: TEST_IDS.USER,
    pollCreatorUserName: 'Alice',
    state: 'CLOSED',
    tripId: TEST_IDS.TRIP,
    proposalIds: [TEST_IDS.PROPOSAL_1],
    startDate,
    endDate,
    ...overrides,
  }
}

function createMockProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    $id: TEST_IDS.PROPOSAL_1,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    proposerUserId: TEST_IDS.USER,
    proposerUserName: 'Alice',
    tripId: TEST_IDS.TRIP,
    state: 'SUBMITTED',
    title: 'Chamonix',
    description: 'French Alps',
    resortName: 'Chamonix',
    startDate: '2026-03-29T00:00:00.000Z',
    endDate: '2026-04-05T00:00:00.000Z',
    nearestAirport: 'GVA',
    transferTime: '1h',
    altitudeRange: '1000-3800m',
    country: 'France',
    ...overrides,
  }
}

function createMockVote(overrides: Partial<Vote> = {}): Vote {
  return {
    $id: TEST_IDS.VOTE_1,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    pollId: TEST_IDS.POLL,
    tripId: TEST_IDS.TRIP,
    voterUserId: TEST_IDS.USER,
    voterUserName: 'Alice',
    proposalIds: [TEST_IDS.PROPOSAL_1],
    tokenCounts: [5],
    ...overrides,
  }
}

function renderPastPoll(
  overrides: {
    poll?: Poll
    proposals?: Proposal[]
    listVotes?: (
      pollId: string,
      tripId: string,
      userId: string
    ) => Promise<{ votes: Vote[] }>
  } = {}
) {
  const poll = overrides.poll ?? createMockPoll()
  const proposals = overrides.proposals ?? [createMockProposal()]
  const listVotes =
    overrides.listVotes ?? mock(() => Promise.resolve({ votes: [] }))
  const result = render(
    <PastPoll
      poll={poll}
      proposals={proposals}
      tripId={TEST_IDS.TRIP}
      userId={TEST_IDS.USER}
      listVotes={listVotes}
    />
  )
  return { ...result, listVotes, poll, proposals }
}

describe('PastPoll', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders loading state before votes load', async () => {
    let resolveVotes: (value: { votes: Vote[] }) => void
    const listVotes = mock(
      () =>
        new Promise<{ votes: Vote[] }>((resolve) => {
          resolveVotes = resolve
        })
    )

    await act(async () => {
      render(
        <PastPoll
          poll={createMockPoll()}
          proposals={[createMockProposal()]}
          tripId={TEST_IDS.TRIP}
          userId={TEST_IDS.USER}
          listVotes={listVotes}
        />
      )
    })

    expect(screen.getByText(/Loading…/i)).toBeTruthy()

    await act(async () => {
      resolveVotes?.({ votes: [] })
    })
  })

  it('calls listVotes with correct pollId, tripId, and userId', async () => {
    const poll = createMockPoll()
    const listVotes = mock(() => Promise.resolve({ votes: [] }))

    await act(async () => {
      render(
        <PastPoll
          poll={poll}
          proposals={[createMockProposal()]}
          tripId={TEST_IDS.TRIP}
          userId={TEST_IDS.USER}
          listVotes={listVotes}
        />
      )
    })

    expect(listVotes).toHaveBeenCalledWith(
      poll.$id,
      TEST_IDS.TRIP,
      TEST_IDS.USER
    )
  })

  it('renders PollResults after votes load', async () => {
    const vote = createMockVote()

    await act(async () => {
      renderPastPoll({
        listVotes: mock(() => Promise.resolve({ votes: [vote] })),
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/1 vote/i))
    })
  })

  it('displays error when listVotes rejects', async () => {
    const listVotes = mock(() =>
      Promise.reject(new Error('Failed to load votes'))
    )

    await act(async () => {
      renderPastPoll({ listVotes })
    })

    await waitFor(() => {
      expect(screen.getByText('Failed to load votes'))
    })
  })

  it('renders formatDate(poll.startDate) in output', async () => {
    await act(async () => {
      renderPastPoll()
    })

    await waitFor(() => {
      expect(screen.getByText(/29 Mar 2026/i))
    })
  })

  it('renders "Poll · CLOSED" label', async () => {
    await act(async () => {
      renderPastPoll()
    })

    await waitFor(() => {
      expect(screen.getByText(/Poll · CLOSED/i))
    })
  })
})
