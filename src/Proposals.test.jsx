import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, mock } from 'bun:test'
import Proposals from './Proposals'

const user = { $id: 'user-1', name: 'Alice' }

const sampleTrips = [
  { $id: 'trip-1', description: 'Alps Adventure', code: 'abc-def-ghi' },
  { $id: 'trip-2', description: 'Dolomites', code: 'xyz-uvw-rst' }
]

const sampleProposals = [
  { $id: 'p-1', userId: 'user-1', state: 'DRAFT', resortName: "Val d'Isère", country: 'France', altitudeRange: '1850m - 3456m', nearestAirport: 'GVA', transferTime: '2h', accommodationName: 'Chalet', accommodationUrl: '', approximateCost: '£1200', description: 'Nice resort' }
]

function renderProposals (props = {}) {
  const defaults = {
    user,
    listParticipatedTrips: mock(() => Promise.resolve({ documents: sampleTrips })),
    listProposals: mock(() => Promise.resolve({ documents: sampleProposals })),
    createProposal: mock(() => Promise.resolve({ $id: 'p-new' })),
    updateProposal: mock(() => Promise.resolve({ $id: 'p-1' })),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' })),
    getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
  }
  return render(<Proposals {...defaults} {...props} />)
}

describe('Proposals', () => {
  it('shows loading state initially', () => {
    renderProposals({ listParticipatedTrips: mock(() => new Promise(() => {})) })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows trip selector after loading with trip descriptions', async () => {
    await act(async () => { renderProposals() })
    await waitFor(() => {
      expect(screen.getByText('Proposals')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Alps Adventure')).toBeInTheDocument()
      expect(screen.getByText('Dolomites')).toBeInTheDocument()
    })
  })

  it('shows "Join a trip first" when listParticipatedTrips returns empty array', async () => {
    await act(async () => {
      renderProposals({ listParticipatedTrips: mock(() => Promise.resolve({ documents: [] })) })
    })
    await waitFor(() => {
      expect(screen.getByText(/join a trip first/i)).toBeInTheDocument()
    })
  })

  it('shows error when listParticipatedTrips rejects', async () => {
    await act(async () => {
      renderProposals({ listParticipatedTrips: mock(() => Promise.reject(new Error('Network error'))) })
    })
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('fetches and shows proposals when a trip is selected', async () => {
    const listProposals = mock(() => Promise.resolve({ documents: sampleProposals }))
    await act(async () => { renderProposals({ listProposals }) })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })

    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    })
  })

  it('shows "No proposals yet" when selected trip has no proposals', async () => {
    await act(async () => {
      renderProposals({ listProposals: mock(() => Promise.resolve({ documents: [] })) })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })

    await waitFor(() => {
      expect(screen.getByText(/no proposals yet/i)).toBeInTheDocument()
    })
  })

  it('hides "+ New Proposal" button when no trip selected', async () => {
    await act(async () => { renderProposals() })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /new proposal/i })).not.toBeInTheDocument()
  })

  it('shows "+ New Proposal" button when a trip is selected', async () => {
    await act(async () => { renderProposals() })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ new proposal/i })).toBeInTheDocument()
    })
  })

  it('shows create form when "+ New Proposal" is clicked and trip is selected', async () => {
    await act(async () => { renderProposals() })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /\+ new proposal/i })).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ new proposal/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create proposal/i })).toBeInTheDocument()
    })
  })

  it('auto-selects single trip and loads proposals', async () => {
    const singleTrip = [{ $id: 'trip-1', description: 'Alps Adventure', code: 'abc-def-ghi' }]
    const listProposals = mock(() => Promise.resolve({ documents: sampleProposals }))
    await act(async () => {
      renderProposals({
        listParticipatedTrips: mock(() => Promise.resolve({ documents: singleTrip })),
        listProposals
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Proposals')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    })
  })

  it('does not auto-select when multiple trips exist', async () => {
    const listProposals = mock(() => Promise.resolve({ documents: [] }))
    await act(async () => {
      renderProposals({ listProposals })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /new proposal/i })).not.toBeInTheDocument()
  })

  it('auto-selected single trip shows "+ New Proposal" button', async () => {
    const singleTrip = [{ $id: 'trip-1', description: 'Alps Adventure', code: 'abc-def-ghi' }]
    await act(async () => {
      renderProposals({
        listParticipatedTrips: mock(() => Promise.resolve({ documents: singleTrip }))
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ new proposal/i })).toBeInTheDocument()
    })
  })

  it('pre-selects a trip when selectedTripId prop is provided', async () => {
    const listProposals = mock(() => Promise.resolve({ documents: sampleProposals }))
    await act(async () => {
      renderProposals({
        selectedTripId: 'trip-2',
        listParticipatedTrips: mock(() => Promise.resolve({ documents: sampleTrips })),
        listProposals
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-2', 'user-1')
    })
  })

  it('selects a different trip when selectedTripId prop changes', async () => {
    const listProposals = mock(() => Promise.resolve({ documents: sampleProposals }))
    const { rerender } = await act(async () => {
      return renderProposals({
        selectedTripId: 'trip-1',
        listParticipatedTrips: mock(() => Promise.resolve({ documents: sampleTrips })),
        listProposals
      })
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
    })
    listProposals.mockClear()
    await act(async () => {
      rerender(<Proposals
        user={user}
        selectedTripId='trip-2'
        listParticipatedTrips={mock(() => Promise.resolve({ documents: sampleTrips }))}
        listProposals={listProposals}
        createProposal={mock(() => Promise.resolve({ $id: 'p-new' }))}
        updateProposal={mock(() => Promise.resolve({ $id: 'p-1' }))}
        deleteProposal={mock(() => Promise.resolve())}
        submitProposal={mock(() => Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' }))}
        getUserById={mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))}
               />)
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-2', 'user-1')
    })
  })
})
