import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, mock } from 'bun:test'
import Proposals from './Proposals'

const user = { $id: 'user-1', name: 'Alice' }

const sampleProposals = [
  { $id: 'p-1', userId: 'user-1', state: 'DRAFT', resortName: "Val d'Isère", country: 'France', altitudeRange: '1850m - 3456m', nearestAirport: 'GVA', transferTime: '2h', accommodationName: 'Chalet', accommodationUrl: '', approximateCost: '£1200', description: 'Nice resort' }
]

function renderProposals (props = {}) {
  const defaults = {
    user,
    selectedTripId: null,
    listProposals: mock(() => Promise.resolve({ documents: sampleProposals })),
    createProposal: mock(() => Promise.resolve({ $id: 'p-new' })),
    updateProposal: mock(() => Promise.resolve({ $id: 'p-1' })),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' })),
    rejectProposal: mock(() => Promise.resolve({ $id: 'p-1', state: 'REJECTED' })),
    getCoordinatorParticipant: mock(() => Promise.resolve({ documents: [] })),
    getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
  }
  return render(<Proposals {...defaults} {...props} />)
}

describe('Proposals', () => {
  it('shows prompt to select a trip when selectedTripId is null', async () => {
    await act(async () => { renderProposals() })
    await waitFor(() => {
      expect(screen.getByText('Proposals')).toBeInTheDocument()
      expect(screen.getByText(/select a trip above/i)).toBeInTheDocument()
    })
  })

  it('shows proposals when selectedTripId is provided', async () => {
    const listProposals = mock(() => Promise.resolve({ documents: sampleProposals }))
    await act(async () => { renderProposals({ selectedTripId: 'trip-1', listProposals }) })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    })
  })

  it('shows "No proposals yet" when selected trip has no proposals', async () => {
    await act(async () => {
      renderProposals({ selectedTripId: 'trip-1', listProposals: mock(() => Promise.resolve({ documents: [] })) })
    })
    await waitFor(() => {
      expect(screen.getByText(/no proposals yet/i)).toBeInTheDocument()
    })
  })

  it('shows "+ New Proposal" button when a trip is selected', async () => {
    await act(async () => { renderProposals({ selectedTripId: 'trip-1' }) })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ new proposal/i })).toBeInTheDocument()
    })
  })

  it('hides "+ New Proposal" button when no trip selected', async () => {
    await act(async () => { renderProposals({ selectedTripId: null }) })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /new proposal/i })).not.toBeInTheDocument()
    })
  })

  it('shows create form when "+ New Proposal" is clicked', async () => {
    await act(async () => { renderProposals({ selectedTripId: 'trip-1' }) })
    await waitFor(() => expect(screen.getByRole('button', { name: /\+ new proposal/i })).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ new proposal/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create proposal/i })).toBeInTheDocument()
    })
  })

  it('fetches new proposals when selectedTripId changes', async () => {
    const listProposals = mock(() => Promise.resolve({ documents: sampleProposals }))
    await act(async () => { renderProposals({ selectedTripId: 'trip-1', listProposals }) })
    await waitFor(() => { expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1') })

    listProposals.mockClear()
    const newProposals = [{ ...sampleProposals[0], $id: 'p-2', resortName: 'Whistler' }]
    listProposals.mockImplementation(() => Promise.resolve({ documents: newProposals }))

    const { rerender } = await act(async () => {
      return renderProposals({ selectedTripId: 'trip-1', listProposals })
    })
    await act(async () => {
      rerender(<Proposals
        user={user}
        selectedTripId='trip-2'
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

  it('shows Reject button when user is coordinator and proposal is SUBMITTED', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        selectedTripId: 'trip-1',
        listProposals: mock(() => Promise.resolve({ documents: [submittedProposal] })),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
        )
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
    })
  })

  it('does not show Reject button when user is not coordinator', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        selectedTripId: 'trip-1',
        listProposals: mock(() => Promise.resolve({ documents: [submittedProposal] })),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'other-user' }] })
        )
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
    })
  })
})
