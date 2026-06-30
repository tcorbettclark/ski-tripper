import { afterEach, describe, expect, it, mock } from 'bun:test'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { User } from '../shared/types.d'
import { getToasts } from './toast'
import { dayjs } from './utils'
import Voting from './Voting'

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
  id: TEST_IDS.USER,
  name: TEST_IDS.USER_NAME,
  email: 'alice@example.com',
  emailVerification: true,
} as User

function createMockProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_IDS.PROPOSAL_1,
    state: 'SUBMITTED',
    resortName: 'Chamonix',
    ...overrides,
  }
}

function createMockPoll(overrides: Record<string, unknown> = {}) {
  const baseDate = dayjs('2026-04-05T00:00:00.000Z')
  const startDate = baseDate.subtract(7, 'day').toISOString()
  const endDate = baseDate.subtract(1, 'day').toISOString()
  return {
    id: TEST_IDS.POLL_OPEN,
    trip: TEST_IDS.TRIP,
    state: 'OPEN',
    proposalIds: [TEST_IDS.PROPOSAL_1],
    startDate,
    endDate,
    outcome: '',
    ...overrides,
  }
}

function createMockVote(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_IDS.VOTE_1,
    poll: TEST_IDS.POLL_OPEN,
    voter: TEST_IDS.USER,
    voterUserName: TEST_IDS.USER_NAME,
    proposalIds: [TEST_IDS.PROPOSAL_1],
    tokenCounts: [5],
    ...overrides,
  }
}

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
    closePoll: mock((_pollId: string, _userId: string, _outcome: string) =>
      Promise.resolve(
        createMockPoll({
          id: TEST_IDS.POLL_CLOSED,
          state: 'CLOSED',
          outcome: 'Test outcome',
        })
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
      participants: [{ id: TEST_IDS.PARTICIPANT_1, user: TEST_IDS.USER }],
    })
  )
}

function createNonCoordinatorMock() {
  return mock(() => Promise.resolve({ participants: [] }))
}

function renderVoting(overrides: any = {}) {
  const callbacks = createMockCallbacks(overrides)
  const result = render(
    <Voting
      user={MOCK_USER}
      tripId={TEST_IDS.TRIP}
      {...callbacks}
      {...overrides}
    />
  )
  return { ...result, ...callbacks }
}

describe('Voting', () => {
  afterEach(() => {
    cleanup()
  })

  describe('loading states', () => {
    it('renders heading after data loads', async () => {
      await act(async () => {
        renderVoting()
      })
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /voting/i }))
      })
    })

    it('removes loading state after data is fetched', async () => {
      await act(async () => {
        renderVoting()
      })
      await waitFor(() => {
        expect(screen.queryByText(/Loading…/i)).toBeNull()
      })
    })
  })

  describe('voting creation', () => {
    it('shows Start Voting button when coordinator with SUBMITTED proposals and no active poll', async () => {
      await act(async () => {
        renderVoting({
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start voting/i }))
      })
    })

    it('does not show Start Voting button when not coordinator', async () => {
      await act(async () => {
        renderVoting({
          getCoordinatorParticipant: createNonCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /start voting/i })
        ).toBeNull()
      })
    })

    it('does not show Start Voting button when there are no SUBMITTED proposals', async () => {
      await act(async () => {
        renderVoting({
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
          screen.queryByRole('button', { name: /start voting/i })
        ).toBeNull()
      })
    })

    it('does not show Start Voting button when an OPEN poll already exists', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /start voting/i })
        ).toBeNull()
      })
    })

    it('calls createPoll when Start Voting button is clicked', async () => {
      const createPoll = mock(() => Promise.resolve(createMockPoll()))
      const onActivePollChange = mock(() => {})
      await act(async () => {
        renderVoting({
          createPoll,
          onActivePollChange,
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start voting/i }))
      })

      await waitFor(() => {
        expect(onActivePollChange).toHaveBeenCalled()
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
        renderVoting({
          createPoll,
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start voting/i }))
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
    it('shows OPEN status when an OPEN poll exists', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/OPEN/i))
      })
    })

    it('fetches votes when OPEN poll exists', async () => {
      const listVotes = mock(() =>
        Promise.resolve({ votes: [createMockVote()] })
      )
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          listVotes,
        })
      })
      await waitFor(() => {
        expect(listVotes).toHaveBeenCalledWith(
          TEST_IDS.POLL_OPEN,
          TEST_IDS.USER
        )
      })
    })

    it('displays "Votes so far" section when poll is open', async () => {
      await act(async () => {
        renderVoting({
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
    it('shows Close Voting button for coordinator when poll is OPEN', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })
    })

    it('does not show Close Voting button for non-coordinator', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createNonCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /close voting/i })
        ).toBeNull()
      })
    })

    it('shows outcome form when Close Voting is clicked', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      expect(screen.getByLabelText(/outcome/i)).toBeTruthy()
      expect(
        screen.getByRole('button', { name: /confirm close/i })
      ).toBeTruthy()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
    })

    it('calls closePoll with outcome text when Confirm Close is clicked', async () => {
      const closePoll = mock(() =>
        Promise.resolve(
          createMockPoll({
            id: TEST_IDS.POLL_CLOSED,
            state: 'CLOSED',
            outcome: 'Chamonix through, Annecy rejected',
          })
        )
      )
      const onActivePollChange = mock(() => {})
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
          onActivePollChange,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/outcome/i), {
          target: { value: 'Chamonix through, Annecy rejected' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm close/i }))
      })

      await waitFor(() => {
        expect(onActivePollChange).toHaveBeenCalledWith(null)
      })

      expect(closePoll).toHaveBeenCalledWith(
        TEST_IDS.POLL_OPEN,
        TEST_IDS.USER,
        'Chamonix through, Annecy rejected'
      )
    })

    it('disables Confirm Close when outcome is empty', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      expect(
        (
          screen.getByRole('button', {
            name: /confirm close/i,
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true)
    })

    it('hides outcome form on Cancel', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      expect(screen.getByLabelText(/outcome/i)).toBeTruthy()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      })

      expect(screen.queryByLabelText(/outcome/i)).toBeNull()
      expect(screen.getByRole('button', { name: /close voting/i })).toBeTruthy()
    })

    it('moves closed poll to past votings section', async () => {
      const closedPoll = createMockPoll({
        id: TEST_IDS.POLL_CLOSED,
        state: 'CLOSED',
        outcome: 'Chamonix through',
      })
      const closePoll = mock(() => Promise.resolve(closedPoll))
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/outcome/i), {
          target: { value: 'Chamonix through' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm close/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/Past Voting Rounds/i))
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
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/outcome/i), {
          target: { value: 'Outcome' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm close/i }))
      })

      expect(
        (screen.getByRole('button', { name: /closing/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true)

      await act(async () => {
        resolveClose?.(
          createMockPoll({
            id: TEST_IDS.POLL_CLOSED,
            state: 'CLOSED',
            outcome: 'Outcome',
          })
        )
      })
    })
  })

  describe('past voting rounds', () => {
    it('shows Past Voting Rounds section when closed polls exist', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' }),
              ],
            })
          ),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Voting Rounds/i))
      })
    })

    it('shows past voting rounds collapsed by default with CLOSED status', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() =>
            Promise.resolve({
              polls: [
                createMockPoll({ id: TEST_IDS.POLL_CLOSED, state: 'CLOSED' }),
              ],
            })
          ),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/Past Voting Rounds/i))
        expect(screen.getByText(/Voting · CLOSED/i))
      })
    })
  })

  describe('data fetching', () => {
    it('calls listPolls with correct tripId and userId', async () => {
      const listPolls = mock(() => Promise.resolve({ polls: [] }))
      await act(async () => {
        renderVoting({ listPolls })
      })
      await waitFor(() => {
        expect(listPolls).toHaveBeenCalledWith(TEST_IDS.TRIP, TEST_IDS.USER)
      })
    })

    it('calls listProposals with correct tripId and userId', async () => {
      const listProposals = mock(() => Promise.resolve({ proposals: [] }))
      await act(async () => {
        renderVoting({ listProposals })
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
        renderVoting({ getCoordinatorParticipant })
      })
      await waitFor(() => {
        expect(getCoordinatorParticipant).toHaveBeenCalledWith(TEST_IDS.TRIP)
      })
    })
  })

  describe('error handling', () => {
    it('displays error message when listPolls fails', async () => {
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.reject(new Error('Network error'))),
        })
      })
      await waitFor(() => {
        expect(
          getToasts().some(
            (t) => t.message === 'Network error' && t.type === 'error'
          )
        ).toBeTruthy()
      })
    })

    it('displays error message when listProposals fails', async () => {
      await act(async () => {
        renderVoting({
          listProposals: mock(() =>
            Promise.reject(new Error('Failed to load proposals'))
          ),
        })
      })
      await waitFor(() => {
        expect(
          getToasts().some(
            (t) =>
              t.message === 'Failed to load proposals' && t.type === 'error'
          )
        ).toBeTruthy()
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty proposals array', async () => {
      await act(async () => {
        renderVoting({
          listProposals: mock(() => Promise.resolve({ proposals: [] })),
        })
      })
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).toBeNull()
      })
    })

    it('only considers SUBMITTED proposals for poll creation eligibility', async () => {
      await act(async () => {
        renderVoting({
          getCoordinatorParticipant: createCoordinatorMock(),
          listProposals: mock(() =>
            Promise.resolve({
              proposals: [
                createMockProposal({ id: 'p-draft', state: 'DRAFT' }),
                createMockProposal({ id: 'p-submitted', state: 'SUBMITTED' }),
                createMockProposal({ id: 'p-rejected', state: 'REJECTED' }),
              ],
            })
          ),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start voting/i }))
      })
    })

    it('shows error when createPoll rejects', async () => {
      const createPoll = mock(() =>
        Promise.reject(new Error('Create poll failed'))
      )
      await act(async () => {
        renderVoting({
          createPoll,
          getCoordinatorParticipant: createCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start voting/i }))
      })

      await waitFor(() => {
        expect(
          getToasts().some(
            (t) => t.message === 'Create poll failed' && t.type === 'error'
          )
        ).toBeTruthy()
      })
    })

    it('shows empty state for non-coordinator when no active poll', async () => {
      await act(async () => {
        renderVoting({
          getCoordinatorParticipant: createNonCoordinatorMock(),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/No open voting yet/i))
        expect(screen.getByText(/coordinator will start one when ready/i))
      })
    })

    it('shows empty state for coordinator without submitted proposals', async () => {
      await act(async () => {
        renderVoting({
          getCoordinatorParticipant: createCoordinatorMock(),
          listProposals: mock(() =>
            Promise.resolve({
              proposals: [createMockProposal({ state: 'DRAFT' })],
            })
          ),
        })
      })
      await waitFor(() => {
        expect(screen.getByText(/No open voting/i))
        expect(screen.getByText(/Submit proposals to enable voting/i))
      })
    })

    it('shows error when closePoll rejects', async () => {
      const closePoll = mock(() =>
        Promise.reject(new Error('Close poll failed'))
      )
      await act(async () => {
        renderVoting({
          listPolls: mock(() => Promise.resolve({ polls: [createMockPoll()] })),
          getCoordinatorParticipant: createCoordinatorMock(),
          closePoll,
        })
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close voting/i }))
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/outcome/i), {
          target: { value: 'Some outcome' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm close/i }))
      })

      await waitFor(() => {
        expect(
          getToasts().some(
            (t) => t.message === 'Close poll failed' && t.type === 'error'
          )
        ).toBeTruthy()
      })
    })
  })
})
