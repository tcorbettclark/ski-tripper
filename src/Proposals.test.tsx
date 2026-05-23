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
    resortName: "Val d'Isère",
    country: 'France',
    region: 'Alps',
    topAltitude: 3456,
    bottomAltitude: 1850,
    nearestAirport: 'GVA',
    transferTime: '2h',
    pisteKm: 300,
    difficulty: 'advanced' as const,
    liftCount: 80,
    snowReliability: 'high' as const,
    skiSeasonMonths: 'Dec-Apr',
    websiteUrl: 'https://valdisere.com',
    latitude: '45.4475',
    longitude: '6.9219',
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
    listAccommodations: mock((_proposalId: string) => Promise.resolve([])),
    listResorts: mock(() => Promise.resolve({ resorts: [] })),
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
          listResorts={mock(() => Promise.resolve({ resorts: [] }))}
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
    await user.click(screen.getByRole('button', { name: /^SUBMITTED/ }))
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

  it('re-fetches accommodations when handleUpdated is called', async () => {
    const initialAccommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'p-1',
        name: 'Old Hotel',
        url: '',
        cost: '€100',
        description: 'Old description',
      },
    ]
    const updatedAccommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-02T00:00:00Z',
        proposalId: 'p-1',
        name: 'New Hotel',
        url: '',
        cost: '€200',
        description: 'New description',
      },
    ]
    let listAccCallCount = 0
    const listAccommodationsFn = mock((_proposalId: string) => {
      listAccCallCount++
      if (listAccCallCount === 1) return Promise.resolve(initialAccommodations)
      return Promise.resolve(updatedAccommodations)
    })
    const updateProposalFn = mock(() =>
      Promise.resolve({
        ...sampleProposals[0],
        resortName: 'Updated Resort',
      })
    )

    await act(async () => {
      renderProposals({
        tripId: 'trip-1',
        listAccommodations: listAccommodationsFn,
        updateProposal: updateProposalFn,
      })
    })

    await waitFor(() => {
      expect(screen.getByText('€100')).toBeTruthy()
    })

    const initialCallCount = listAccommodationsFn.mock.calls.length

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    const forms = document.querySelectorAll('form')
    const editForm = forms[forms.length - 1]
    await act(async () => {
      editForm?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    await waitFor(() => {
      expect(listAccommodationsFn.mock.calls.length).toBeGreaterThan(
        initialCallCount
      )
    })

    await waitFor(() => {
      expect(screen.getByText('€200')).toBeTruthy()
    })
  })
})
