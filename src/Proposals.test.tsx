import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Proposals from './Proposals'
import type { User } from './types.d'

const user = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  emailVerification: true,
} as User

const sampleProposals = [
  {
    id: 'p-1',
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-01T00:00:00.000Z',
    proposer: 'user-1',
    proposerUserName: 'Alice',
    trip: 'trip-1',
    state: 'DRAFT' as const,
    resortName: "Val d'Isère",
    country: 'France',
    region: 'Alps',
    summitAltitude: 3456,
    baseAltitude: 1850,
    nearestAirport: 'Geneva Airport',
    transferTime: 120,
    pisteKm: 300,
    beginnerPct: 0,
    intermediatePct: 0,
    advancedPct: 0,
    liftCount: 80,
    snowReliability: 'high' as const,
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://valdisere.com'],
    latitude: '45.4475',
    longitude: '6.9219',
    linkedResortsDescription: '',
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
    createProposal: mock(() => Promise.resolve({ id: 'p-new' })),
    listAccommodations: mock((_proposal: string) => Promise.resolve([])),
    updateProposal: mock(() => Promise.resolve({ id: 'p-1' })),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() =>
      Promise.resolve({ id: 'p-1', state: 'SUBMITTED' })
    ),
    rejectProposal: mock(() =>
      Promise.resolve({ id: 'p-1', state: 'REJECTED' })
    ),
    revertProposalToDraft: mock(() =>
      Promise.resolve({ id: 'p-1', state: 'DRAFT' })
    ),
    createAccommodation: mock(() => Promise.resolve({ id: 'acc-new' })),
    updateAccommodation: mock(() => Promise.resolve({ id: 'acc-1' })),
    deleteAccommodation: mock(() => Promise.resolve()),
    getCoordinatorParticipant: mock(() =>
      Promise.resolve({ participants: [] })
    ),
    listDiscussion: mock(() => Promise.resolve([])),
    resorts: [] as any[],
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
        trip: 'trip-1',
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
      expect(screen.getByRole('button', { name: /create draft proposal/i }))
    })
  })

  it('fetches new proposals when tripId changes', async () => {
    const listProposals = mock(() =>
      Promise.resolve({ proposals: sampleProposals })
    )
    const { rerender } = await act(async () => {
      return renderProposals({ tripId: 'trip-1', listProposals })
    })
    await waitFor(() => {
      expect(listProposals).toHaveBeenCalledWith('trip-1', 'user-1')
    })

    listProposals.mockClear()
    const newProposals = [
      { ...sampleProposals[0], id: 'p-2', resortName: 'Whistler' },
    ]
    listProposals.mockImplementation(() =>
      Promise.resolve({ proposals: newProposals })
    )

    await act(async () => {
      rerender(
        <Proposals
          user={user as User}
          tripId="trip-2"
          listProposals={listProposals}
          createProposal={mock(() => Promise.resolve({ id: 'p-new' }))}
          listAccommodations={mock((_proposal: string) => Promise.resolve([]))}
          updateProposal={mock(() => Promise.resolve({ id: 'p-1' }))}
          deleteProposal={mock(() => Promise.resolve())}
          submitProposal={mock(() =>
            Promise.resolve({ id: 'p-1', state: 'SUBMITTED' })
          )}
          rejectProposal={mock(() =>
            Promise.resolve({ id: 'p-1', state: 'REJECTED' })
          )}
          revertProposalToDraft={mock(() =>
            Promise.resolve({ id: 'p-1', state: 'DRAFT' })
          )}
          createAccommodation={mock(() => Promise.resolve({ id: 'acc-new' }))}
          updateAccommodation={mock(() => Promise.resolve({ id: 'acc-1' }))}
          deleteAccommodation={mock(() => Promise.resolve())}
          getCoordinatorParticipant={mock(() =>
            Promise.resolve({ participants: [] })
          )}
          listDiscussion={mock(() => Promise.resolve([]))}
          resorts={[]}
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
        trip: 'trip-1',
        listProposals: mock(() =>
          Promise.resolve({ proposals: [submittedProposal] })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({
            participants: [{ id: 'part-1', user: 'user-1' }],
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
        trip: 'trip-1',
        listProposals: mock(() =>
          Promise.resolve({ proposals: [submittedProposal] })
        ),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({
            participants: [{ id: 'part-1', user: 'other-user' }],
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
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposal: 'p-1',
        name: 'Old Hotel',
        url: '',
        cost: '€100',
        description: 'Old description',
      },
    ]
    const updatedAccommodations = [
      {
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-02T00:00:00Z',
        proposal: 'p-1',
        name: 'New Hotel',
        url: '',
        cost: '€200',
        description: 'New description',
      },
    ]
    let listAccCallCount = 0
    const listAccommodationsFn = mock((_proposal: string) => {
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

    const updateAccommodationFn = mock(() => Promise.resolve({ id: 'acc-1' }))

    const user = userEvent.setup()

    await act(async () => {
      renderProposals({
        trip: 'trip-1',
        listAccommodations: listAccommodationsFn,
        updateProposal: updateProposalFn,
        updateAccommodation: updateAccommodationFn,
      })
    })

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    await waitFor(() => {
      expect(screen.getByText('€100')).toBeTruthy()
    })

    const initialCallCount = listAccommodationsFn.mock.calls.length

    const editButton = screen.getByRole('button', {
      name: /Edit accommodation/,
    })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    await user.click(saveButton)

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
