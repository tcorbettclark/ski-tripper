import { afterEach, describe, expect, it, mock } from 'bun:test'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { Models } from 'appwrite'
import Poll from './Poll'

// Constants for test data
const TEST_IDS = {
  USER: 'user-1',
  USER_NAME: 'Alice',
  TRIP: 'trip-1',
  POLL_OPEN: 'poll-1',
  POLL_CLOSED: 'poll-2',
  PROPOSAL_1: 'p-1',
  PROPOSAL_2: 'p-2',
  VOTE_1: 'v-1',
  PARTICIPANT_1: 'part-1',
} as const

const MOCK_USER = {
  $id: TEST_IDS.USER,
  name: TEST_IDS.USER_NAME,
} as Models.User

// Factory functions for creating mock data
function createMockProposal(overrides: Record<string, unknown> = {}) {
  return {
    $id: TEST_IDS.PROPOSAL_1,
    state: 'SUBMITTED',
    resortName: 'Chamonix',
    ...overrides,
  }
}

function createMockPoll(overrides: Record<string, unknown> = {}) {
  const baseDate = new Date('2026-04-05T00:00:00.000Z')
  const startDate = new Date(
    baseDate.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()
  const endDate = new Date(
    baseDate.getTime() - 1 * 24 * 60 * 60 * 1000
  ).toISOString()
  return {
    $id: TEST_IDS.POLL_OPEN,
    tripId: TEST_IDS.TRIP,
    state: 'OPEN',
    proposalIds: [TEST_IDS.PROPOSAL_1],
    startDate,
    endDate,
    ...overrides,
  }
}

function createMockVote(overrides: Record<string, unknown> = {}) {
  return {
    $id: TEST_IDS.VOTE_1,
    pollId: TEST_IDS.POLL_OPEN,
    tripId: TEST_IDS.TRIP,
    voterUserId: TEST_IDS.USER,
    proposalIds: [TEST_IDS.PROPOSAL_1],
    tokenCounts: [5],
    ...overrides,
  }
}

// Factory functions for creating mock callbacks
function createMockCallbacks(
  overrides: Record<string, ReturnType<typeof mock>> = {}
) {
  return {
    listPolls: mock(() => Promise.resolve({ polls: [] })),
    listProposals: mock(() =>
      Promise.resolve({ proposals: [createMockProposal()] })
    ),
    listVotes: mock(() => Promise.resolve({ votes: [] })),
    createPoll: mock(() => Promise.resolve(createMockPoll())),
    closePoll: mock(() =>
      Promise.resolve(
        createMockPoll({ $id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' })
      )
    ),
    upsertVote: mock(() => Promise.resolve(createMockVote())),
    getCoordinatorParticipant: mock(() =>
      Promise.resolve({ participants: [] })
    ),
    ...overrides,
  }
}

function createCoordinatorMock() {
  return mock(() =>
    Promise.resolve({
      participants: [
        { $id: TEST_IDS.PARTICIPANT_1, participantUserId: TEST_IDS.USER },
      ],
    })
  )
}

function createNonCoordinatorMock() {
  return mock(() => Promise.resolve({ participants: [] }))
}

// Helper function for rendering with proper defaults
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPoll(overrides: any = {}) {
  const callbacks = createMockCallbacks(overrides)
  const result = render(
    <Poll
      user={MOCK_USER}
      tripId={TEST_IDS.TRIP}
      {...callbacks}
      {...overrides}
    />
  )
  return { ...result, ...callbacks }
}

describe('Poll', () => {
  afterEach(() => {
    cleanup()
  })

  describe('loading states', () => {
    it('shows loading state while fetching data', async () => {
      // Create a mock that doesn't resolve immediately so we can see loading state
      let resolvePolls: (value: { polls: [] }) => void
      const listPolls = mock(
        () =>
          new Promise<{ polls: [] }>((resolve) => {
            resolvePolls = resolve
          })
      )

      await act(async () => {
        renderPoll({ listPolls })
      })

      // Should show loading state before data resolves
      expect(screen.getByText(/Loading poll…/i))

      // Resolve to clear loading state
      await act(async () => {
        resolvePolls?.({ polls: [] })
      })

      await waitFor(() => {
        expect(screen.queryByText(/Loading poll…/i)).toBeNull()
      })
    })

    it('removes loading state after data is fetched', async () => {
      await act(async () => {
        renderPoll()
      })
      await waitFor(() => {
        expect(screen.queryByText(/Loading poll…/i)).toBeNull()
      })
    })
  })

  describe('poll creation', () => {
    it('shows Create Poll button when coordinator with SUBMITTED proposals and no active poll', async () => {
      await act(async () => {
        renderPoll({
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create poll/i }))
      })
    })

    it('does not show Create Poll button when not coordinator', async () => {
      await act(async () => {
        renderPoll({
          getCoordinatorParticipant: createNonCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /create poll/i })
        ).toBeNull()
      })
    })

    it('does not show Create Poll button when there are no SUBMITTED proposals', async () => {
      await act(async () => {
        renderPoll({
          getCoordinatorParticipant: createCoordinatorMock(),
          listProposals: mock(() =>
            Promise.resolve({
              proposals: [createMockProposal({ state: 'DRAFT' })],
            })
          ),
        })
      })
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /create poll/i })
        ).toBeNull()
      })
    })

    it('does not show Create Poll button when an OPEN poll already exists', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /create poll/i })
        ).toBeNull()
      })
    })

    it('calls createPoll when Create Poll button is clicked', async () => {
      const createPoll = mock(() => Promise.resolve(createMockPoll()))
      await act(async () => {
        renderPoll({
          createPoll,
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create poll/i }))
      })

      expect(createPoll).toHaveBeenCalledWith(
        TEST_IDS.TRIP,
        TEST_IDS.USER,
        TEST_IDS.USER_NAME,
        7
      )
    })

    it('shows loading state while creating poll', async () => {
      let resolveCreate: ((value: unknown) => void) | undefined
      const createPoll = mock(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve
          })
      )

      await act(async () => {
        renderPoll({
          createPoll,
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create poll/i }))
      })

      expect(
        (screen.getByRole('button', { name: /Creating/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true)

      await act(async () => {
        resolveCreate?.(createMockPoll())
      })
    })
  })

  describe('active poll display', () => {
    it('shows active poll panel when an OPEN poll exists', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Active Poll/i))
      })
    })

    it('fetches votes when OPEN poll exists', async () => {
      const listVotes = mock(() =>
        Promise.resolve({ votes: [createMockVote()] })
      )
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          listVotes,
        })
      })
      await waitFor(() => {
        expect(listVotes).toHaveBeenCalledWith(
          TEST_IDS.POLL_OPEN,
          TEST_IDS.TRIP,
          TEST_IDS.USER
        )
      })
    })

    it('displays "Votes so far" section when poll is open', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          listVotes: mock(() => Promise.resolve({ votes: [createMockVote()] })),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Votes so far/i))
      })
    })
  })

  describe('poll closing', () => {
    it('shows Close Poll button for coordinator when poll is OPEN', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close poll/i }))
      })
    })

    it('does not show Close Poll button for non-coordinator', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createNonCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /close poll/i })).toBeNull()
      })
    })

    it('calls closePoll when Close Poll button is clicked', async () => {
      const closePoll = mock(() =>
        Promise.resolve(
          createMockPoll({ $id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' })
        )
      )
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close poll/i }))
      })

      expect(closePoll).toHaveBeenCalledWith(TEST_IDS.POLL_OPEN, TEST_IDS.USER)
    })

    it('moves closed poll to past polls section', async () => {
      const closedPoll = createMockPoll({
        $id: TEST_IDS.POLL_CLOSED,
        state: 'CLOSED',
      })
      const closePoll = mock(() => Promise.resolve(closedPoll))
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close poll/i }))
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Polls/i))
      })
    })

    it('shows loading state while closing poll', async () => {
      let resolveClose: ((value: unknown) => void) | undefined
      const closePoll = mock(
        () =>
          new Promise((resolve) => {
            resolveClose = resolve
          })
      )

      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close poll/i }))
      })

      expect(
        (screen.getByRole('button', { name: /Closing/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true)

      await act(async () => {
        resolveClose?.(
          createMockPoll({ $id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' })
        )
      })
    })
  })

  describe('past polls', () => {
    it('shows past polls section when closed polls exist', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ $id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' }),
              ],
            })
          ),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Polls/i))
      })
    })

    it('shows past poll expanded by default with dates', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ $id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' }),
              ],
            })
          ),
          listVotes: mock(() => Promise.resolve({ votes: [createMockVote()] })),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Polls/i))
        expect(screen.getByText(/Poll · CLOSED/i))
        expect(screen.getByText(/29 Mar 2026/i))
        expect(screen.getByText(/04 Apr 2026/i))
        expect(screen.getByText(/1 vote/i))
      })
    })

    it('fetches votes on mount for past poll', async () => {
      const listVotes = mock(() =>
        Promise.resolve({
          votes: [createMockVote({ pollId: TEST_IDS.POLL_CLOSED })],
        })
      )
      await act(async () => {
        renderPoll({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ $id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' }),
              ],
            })
          ),
          listVotes,
        })
      })
      await waitFor(() => {
        expect(listVotes).toHaveBeenCalledWith(
          TEST_IDS.POLL_CLOSED,
          TEST_IDS.TRIP,
          TEST_IDS.USER
        )
      })
    })

    it('displays multiple past polls expanded by default', async () => {
      const listVotes = mock(() => Promise.resolve({ votes: [] }))
      await act(async () => {
        renderPoll({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ $id: 'poll-closed-1', state: 'CLOSED' }),
                createMockPoll({ $id: 'poll-closed-2', state: 'CLOSED' }),
              ],
            })
          ),
          listVotes,
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Polls/i))
        expect(screen.getAllByText(/Poll · CLOSED/i)).toHaveLength(2)
      })
    })
  })

  describe('data fetching', () => {
    it('calls listPolls with correct tripId and userId', async () => {
      const listPolls = mock(() => Promise.resolve({ polls: [] }))
      await act(async () => {
        renderPoll({ listPolls })
      })
      await waitFor(() => {
        expect(listPolls).toHaveBeenCalledWith(TEST_IDS.TRIP, TEST_IDS.USER)
      })
    })

    it('calls listProposals with correct tripId and userId', async () => {
      const listProposals = mock(() => Promise.resolve({ proposals: [] }))
      await act(async () => {
        renderPoll({ listProposals })
      })
      await waitFor(() => {
        expect(listProposals).toHaveBeenCalledWith(TEST_IDS.TRIP, TEST_IDS.USER)
      })
    })

    it('calls getCoordinatorParticipant with correct tripId', async () => {
      const getCoordinatorParticipant = mock(() =>
        Promise.resolve({ participants: [] })
      )
      await act(async () => {
        renderPoll({ getCoordinatorParticipant })
      })
      await waitFor(() => {
        expect(getCoordinatorParticipant).toHaveBeenCalledWith(TEST_IDS.TRIP)
      })
    })

    it('refetches data when tripId changes', async () => {
      const listPolls = mock(() => Promise.resolve({ polls: [] }))
      const { rerender } = await act(async () => {
        return renderPoll({ listPolls, tripId: 'trip-1' })
      })
      await waitFor(() => {
        expect(listPolls).toHaveBeenCalledWith('trip-1', TEST_IDS.USER)
      })

      listPolls.mockClear()

      await act(async () => {
        rerender(
          <Poll
            user={MOCK_USER}
            tripId="trip-2"
            listPolls={listPolls as any}
            listProposals={createMockCallbacks().listProposals as any}
            listVotes={createMockCallbacks().listVotes as any}
            createPoll={createMockCallbacks().createPoll as any}
            closePoll={createMockCallbacks().closePoll as any}
            upsertVote={createMockCallbacks().upsertVote as any}
            getCoordinatorParticipant={
              createMockCallbacks().getCoordinatorParticipant as any
            }
          />
        )
      })

      await waitFor(() => {
        expect(listPolls).toHaveBeenCalledWith('trip-2', TEST_IDS.USER)
      })
    })
  })

  describe('error handling', () => {
    it('displays error message when listPolls fails', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.reject(new Error('Network error'))),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Network error/i))
      })
    })

    it('displays error message when listProposals fails', async () => {
      await act(async () => {
        renderPoll({
          listProposals: mock(() =>
            Promise.reject(new Error('Failed to load proposals'))
          ),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Failed to load proposals/i))
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty proposals array', async () => {
      await act(async () => {
        renderPoll({
          listProposals: mock(() => Promise.resolve({ proposals: [] })),
        })
      })
      await waitFor(() => {
        expect(screen.queryByText(/Loading poll/i)).toBeNull()
      })
    })

    it('handles multiple past polls', async () => {
      await act(async () => {
        renderPoll({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ $id: 'poll-closed-1', state: 'CLOSED' }),
                createMockPoll({ $id: 'poll-closed-2', state: 'CLOSED' }),
              ],
            })
          ),
          listVotes: mock(() => Promise.resolve({ votes: [] })),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Polls/i))
        expect(screen.getAllByText(/Poll · CLOSED/i)).toHaveLength(2)
      })
    })

    it('only considers SUBMITTED proposals for poll creation eligibility', async () => {
      await act(async () => {
        renderPoll({
          getCoordinatorParticipant: createCoordinatorMock(),
          listProposals: mock(() =>
            Promise.resolve({
              proposals: [
                createMockProposal({ $id: 'p-draft', state: 'DRAFT' }),
                createMockProposal({ $id: 'p-submitted', state: 'SUBMITTED' }),
                createMockProposal({ $id: 'p-rejected', state: 'REJECTED' }),
              ],
            })
          ),
        })
      })
      await waitFor(() => {
        // Should show Create Poll button because there's at least one SUBMITTED proposal
        expect(screen.getByRole('button', { name: /create poll/i }))
      })
    })

    it('shows error when createPoll rejects', async () => {
      const createPoll = mock(() =>
        Promise.reject(new Error('Create poll failed'))
      )
      await act(async () => {
        renderPoll({
          createPoll,
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create poll/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Create poll failed'))
      })
    })

    it('shows error when closePoll rejects', async () => {
      const closePoll = mock(() =>
        Promise.reject(new Error('Close poll failed'))
      )
      await act(async () => {
        renderPoll({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close poll/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close poll/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Close poll failed'))
      })
    })
  })
})
