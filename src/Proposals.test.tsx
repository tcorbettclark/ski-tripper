import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, mock } from 'bun:test'
import Proposals from './Proposals'

const user = { $id: 'user-1', name: 'Alice' }

const sampleProposals = [
  {
    $id: 'p-1',
    ProposerUserId: 'user-1',
    state: 'DRAFT',
    resortName: "Val d'Isère",
    country: 'France',
    altitudeRange: '1850m - 3456m',
    nearestAirport: 'GVA',
    transferTime: '2h',
    accommodationName: 'Chalet',
    accommodationUrl: '',
    approximateCost: '£1200',
    description: 'Nice resort',
  },
]

function renderProposals(props = {}) {
  const defaults = {
    user,
    tripId: 'trip-1',
    listProposals: mock(() => Promise.resolve({ documents: sampleProposals })),
    createProposal: mock(() => Promise.resolve({ $id: 'p-new' })),
    updateProposal: mock(() => Promise.resolve({ $id: 'p-1' })),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' })
    ),
    rejectProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', state: 'REJECTED' })
    ),
    getCoordinatorParticipant: mock(() => Promise.resolve({ documents: [] })),
  }
  return render(<Proposals {...defaults} {...props} />)
}

describe('Proposals', () => {
  it('shows proposals when tripId is provided', async () => {
    const listProposals = mock(() =>
      Promise.resolve({ documents: sampleProposals })
    )
    await act(async () => {
      renderProposals({ tripId: 'trip-1', listProposals })
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    })
  })

  it('shows "No proposals yet" when trip has no proposals', async () => {
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listProposals: mock(() => Promise.resolve({ documents: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/no proposals yet/i)).toBeInTheDocument()
    })
  })

  it('shows "+ New Proposal" button when a trip is selected', async () => {
    await act(async () => {
      renderProposals({ tripId: 'trip-1' })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /\+ new proposal/i })
      ).toBeInTheDocument()
    })
  })

  it('shows create form when "+ New Proposal" is clicked', async () => {
    await act(async () => {
      renderProposals({ tripId: 'trip-1' })
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /\+ new proposal/i })
      ).toBeInTheDocument()
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ new proposal/i }))
    })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create proposal/i })
      ).toBeInTheDocument()
    })
  })

  it('fetches new proposals when tripId changes', async () => {
    const listProposals = mock(() =>
      Promise.resolve({ documents: sampleProposals })
    )
    await act(async () => {
      renderProposals({ tripId: 'trip-1', listProposals })
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
    })

    listProposals.mockClear()
    const newProposals = [
      { ...sampleProposals[0], $id: 'p-2', resortName: 'Whistler' },
    ]
    listProposals.mockImplementation(() =>
      Promise.resolve({ documents: newProposals })
    )

    const { rerender } = await act(async () => {
      return renderProposals({ tripId: 'trip-1', listProposals })
    })
    await act(async () => {
      rerender(
        <Proposals
          user={user}
          tripId="trip-2"
          listProposals={listProposals}
          createProposal={mock(() => Promise.resolve({ $id: 'p-new' }))}
          updateProposal={mock(() => Promise.resolve({ $id: 'p-1' }))}
          deleteProposal={mock(() => Promise.resolve())}
          submitProposal={mock(() =>
            Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' })
          )}
          rejectProposal={mock(() =>
            Promise.resolve({ $id: 'p-1', state: 'REJECTED' })
          )}
          getCoordinatorParticipant={mock(() =>
            Promise.resolve({ documents: [] })
          )}
        />
      )
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-2', 'user-1')
    })
  })

  it('shows Reject button when user is coordinator and proposal is SUBMITTED', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listProposals: mock(() =>
          Promise.resolve({ documents: [submittedProposal] })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({
            documents: [{ $id: 'part-1', ParticipantUserId: 'user-1' }],
          })
        ),
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^reject$/i })
      ).toBeInTheDocument()
    })
  })

  it('does not show Reject button when user is not coordinator', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listProposals: mock(() =>
          Promise.resolve({ documents: [submittedProposal] })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({
            documents: [{ $id: 'part-1', ParticipantUserId: 'other-user' }],
          })
        ),
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /^reject$/i })
      ).not.toBeInTheDocument()
    })
  })
})
