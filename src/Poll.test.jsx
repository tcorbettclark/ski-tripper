import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import Poll from './Poll'

const user = { $id: 'user-1', name: 'Alice' }
const sampleTrips = [
  { $id: 'trip-1', description: 'Alps Adventure' },
  { $id: 'trip-2', description: 'Dolomites' },
]
const sampleProposals = [
  { $id: 'p-1', state: 'SUBMITTED', resortName: 'Chamonix' },
]
const openPoll = {
  $id: 'poll-1',
  tripId: 'trip-1',
  state: 'OPEN',
  proposalIds: ['p-1'],
}
const closedPoll = {
  $id: 'poll-2',
  tripId: 'trip-1',
  state: 'CLOSED',
  proposalIds: ['p-1'],
}

function renderPoll(props = {}) {
  const defaults = {
    user,
    listParticipatedTrips: mock(() =>
      Promise.resolve({ documents: sampleTrips }),
    ),
    listPolls: mock(() => Promise.resolve({ documents: [] })),
    listProposals: mock(() => Promise.resolve({ documents: sampleProposals })),
    listVotes: mock(() => Promise.resolve({ documents: [] })),
    createPoll: mock(() => Promise.resolve(openPoll)),
    closePoll: mock(() => Promise.resolve(closedPoll)),
    upsertVote: mock(() => Promise.resolve({ $id: 'v-new' })),
    getCoordinatorParticipant: mock(() => Promise.resolve({ documents: [] })),
  }
  return render(<Poll {...defaults} {...props} />)
}

describe('Poll', () => {
  it('shows loading state initially', () => {
    renderPoll({ listParticipatedTrips: mock(() => new Promise(() => {})) })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows trip selector after loading', async () => {
    await act(async () => {
      renderPoll()
    })
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Alps Adventure')).toBeInTheDocument()
      expect(screen.getByText('Dolomites')).toBeInTheDocument()
    })
  })

  it('shows "Join a trip first" when no trips', async () => {
    await act(async () => {
      renderPoll({
        listParticipatedTrips: mock(() => Promise.resolve({ documents: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/join a trip first/i)).toBeInTheDocument()
    })
  })

  it('shows Create Poll button when coordinator with SUBMITTED proposals and no active poll', async () => {
    await act(async () => {
      renderPoll({
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] }),
        ),
      })
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'trip-1' },
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create poll/i }),
      ).toBeInTheDocument()
    })
  })

  it('does not show Create Poll button when not coordinator', async () => {
    await act(async () => {
      renderPoll()
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'trip-1' },
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /create poll/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows active poll panel when an OPEN poll exists', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [openPoll] })),
      })
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'trip-1' },
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/active poll/i)).toBeInTheDocument()
    })
  })

  it('shows Close Poll button for coordinator when poll is OPEN', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [openPoll] })),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] }),
        ),
      })
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'trip-1' },
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /close poll/i }),
      ).toBeInTheDocument()
    })
  })

  it('does not show Close Poll button for non-coordinator', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [openPoll] })),
      })
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'trip-1' },
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /close poll/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows past polls section when closed polls exist', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [closedPoll] })),
      })
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'trip-1' },
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/past polls/i)).toBeInTheDocument()
    })
  })

  it('shows error when listParticipatedTrips fails', async () => {
    await act(async () => {
      renderPoll({
        listParticipatedTrips: mock(() =>
          Promise.reject(new Error('Network error')),
        ),
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })
})
