import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import Proposals from './Proposals'

const user = { $id: 'user-1', name: 'Alice' } as Models.User

const sampleProposals = [
  {
    $id: 'p-1',
    $createdAt: '2024-01-01T00:00:00.000Z',
    $updatedAt: '2024-01-01T00:00:00.000Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Alice',
    tripId: 'trip-1',
    state: 'DRAFT' as const,
    title: "Val d'Isère Trip",
    resortName: "Val d'Isère",
    country: 'France',
    altitudeRange: '1850m - 3456m',
    nearestAirport: 'GVA',
    transferTime: '2h',
    accommodationName: 'Chalet',
    accommodationUrl: '',
    approximateCost: '£1200',
    description: 'Nice resort',
    startDate: '2024-12-01',
    endDate: '2024-12-08',
  },
]

function renderProposals(props = {}) {
  const defaults = {
    user,
    tripId: 'trip-1',
    listProposals: mock((_tripId: string, _userId: string) =>
      Promise.resolve({ proposals: sampleProposals })
    ),
    createProposal: mock(() => Promise.resolve({ $id: 'p-new' })),
    updateProposal: mock(() => Promise.resolve({ $id: 'p-1' })),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' })
    ),
    rejectProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', state: 'REJECTED' })
    ),
    getCoordinatorParticipant: mock(() =>
      Promise.resolve({ participants: [] })
    ),
  }
  return render(<Proposals {...defaults} {...props} />)
}

describe('Proposals', () => {
  it('shows proposals when tripId is provided', async () => {
    const listProposals = mock(() =>
      Promise.resolve({ proposals: sampleProposals })
    )
    await act(async () => {
      renderProposals({ tripId: 'trip-1', listProposals })
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(screen.getByText(/Val d'Isère/))
    })
  })

  it('shows "No proposals yet" when trip has no proposals', async () => {
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listProposals: mock(() => Promise.resolve({ proposals: [] })),
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/no proposals yet/i))
    })
  })

  it('shows "+ New Proposal" button when a trip is selected', async () => {
    await act(async () => {
      renderProposals({ tripId: 'trip-1' })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ new proposal/i }))
    })
  })

  it('shows create form when "+ New Proposal" is clicked', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderProposals({ tripId: 'trip-1' })
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /\+ new proposal/i }))
    )

    await user.click(screen.getByRole('button', { name: /\+ new proposal/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create proposal/i }))
    })
  })

  it('fetches new proposals when tripId changes', async () => {
    const listProposals = mock(() =>
      Promise.resolve({ proposals: sampleProposals })
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
      Promise.resolve({ proposals: newProposals })
    )

    const { rerender } = await act(async () => {
      return renderProposals({ tripId: 'trip-1', listProposals })
    })
    await act(async () => {
      rerender(
        <Proposals
          user={user as Models.User}
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
            Promise.resolve({ participants: [] })
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
    const user = userEvent.setup()
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listProposals: mock(() =>
          Promise.resolve({ proposals: [submittedProposal] })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({
            participants: [{ $id: 'part-1', participantUserId: 'user-1' }],
          })
        ),
      })
    })
    await user.click(screen.getByRole('button', { name: 'SUBMITTED' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^reject$/i }))
    })
  })

  it('does not show Reject button when user is not coordinator', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listProposals: mock(() =>
          Promise.resolve({ proposals: [submittedProposal] })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({
            participants: [{ $id: 'part-1', participantUserId: 'other-user' }],
          })
        ),
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^reject$/i })).toBeNull()
    })
  })

  it('shows error when random proposal creation fails', async () => {
    const ue = userEvent.setup()
    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        createProposal: mock(() =>
          Promise.reject(new Error('Random proposal failed'))
        ),
      })
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /random/i })))
    await ue.click(screen.getByRole('button', { name: /random/i }))
    await waitFor(() => {
      expect(screen.getByText('Random proposal failed'))
    })
  })
})
