import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import TripInfo from './TripInfo'

const trip = {
  $id: 'trip-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  code: 'abc-123',
  description: 'Old description',
}
const currentUser = {
  $id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  registration: '2024-01-01T00:00:00.000Z',
  status: 'active',
} as unknown as Models.User
const updatedTrip = {
  $id: 'trip-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-02T00:00:00.000Z',
  code: 'abc-123',
  description: 'New description',
}

const noop = () => {}

async function renderInfo(props: Record<string, unknown> = {}) {
  await act(async () => {
    render(
      <TripInfo
        trip={trip}
        user={currentUser}
        open={true}
        onClose={noop}
        getCoordinatorParticipant={() =>
          Promise.resolve({
            participants: [
              {
                participantUserId: 'user-1',
                participantUserName: 'Alice',
              },
            ],
          })
        }
        listTripParticipants={() =>
          Promise.resolve({
            participants: [
              {
                $id: 'p1',
                participantUserName: 'Alice',
                role: 'coordinator' as const,
              },
            ],
          })
        }
        updateTrip={() => Promise.resolve(updatedTrip)}
        deleteTrip={() => Promise.resolve()}
        leaveTrip={() => Promise.resolve()}
        onLeft={noop}
        onUpdated={noop}
        {...props}
      />
    )
    await waitFor(() =>
      expect(screen.queryByText('Loading participants…')).toBeNull()
    )
  })
}
describe('TripInfo', () => {
  it('shows the trip description', async () => {
    await renderInfo()
    expect(screen.getByText('Old description'))
  })

  it('shows the invite code', async () => {
    await renderInfo()
    expect(screen.getByText('abc-123'))
  })

  it('does not render when open is false', async () => {
    await act(async () => {
      render(
        <TripInfo
          trip={trip}
          user={currentUser}
          open={false}
          onClose={noop}
          getCoordinatorParticipant={() =>
            Promise.resolve({ participants: [] })
          }
          listTripParticipants={() => Promise.resolve({ participants: [] })}
        />
      )
    })
    expect(screen.queryByText('Trip Info')).toBeNull()
  })

  it('shows the Edit button for the coordinator', async () => {
    await renderInfo()
    expect(screen.getByRole('button', { name: /Edit description$/i }))
  })

  it('shows the Leave Trip button for participants', async () => {
    await renderInfo({
      getCoordinatorParticipant: () =>
        Promise.resolve({
          participants: [
            {
              participantUserId: 'other-user',
              participantUserName: 'Bob',
            },
          ],
        }),
    })
    expect(screen.getByRole('button', { name: /leave trip/i }))
  })

  it('shows EditTripForm when Edit is clicked', async () => {
    const ue = userEvent.setup()
    await renderInfo()
    await ue.click(
      screen.getByRole('button', {
        name: /^Edit description$/i,
      })
    )
    expect(screen.getByRole('button', { name: /^save$/i }))
  })

  it('calls onUpdated with the updated trip after saving', async () => {
    const ue = userEvent.setup()
    const handleUpdated = mock(() => {})
    await renderInfo({ onUpdated: handleUpdated })

    await ue.click(screen.getByRole('button', { name: 'Edit description' }))

    const descInput = screen.getByRole('textbox')
    await ue.clear(descInput)
    await ue.type(descInput, 'New description')
    await ue.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(handleUpdated).toHaveBeenCalledWith(updatedTrip)
    })
  })

  it('shows the Delete Trip button for the coordinator', async () => {
    await renderInfo()
    expect(screen.getByRole('button', { name: /delete trip/i }))
  })

  it('does not show the Delete Trip button for participants', async () => {
    await renderInfo({
      getCoordinatorParticipant: () =>
        Promise.resolve({
          participants: [
            {
              participantUserId: 'other-user',
              participantUserName: 'Bob',
            },
          ],
        }),
    })
    expect(screen.queryByRole('button', { name: /delete trip/i })).toBeNull()
  })

  it('calls onClose when the close button is clicked', async () => {
    const ue = userEvent.setup()
    const handleClose = mock(() => {})
    await renderInfo({ onClose: handleClose })
    await ue.click(screen.getByRole('button', { name: 'Close' }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('shows error when deleteTrip rejects', async () => {
    const originalConfirm = window.confirm
    window.confirm = mock(() => true)
    const failingDelete = mock(() => Promise.reject(new Error('Delete failed')))
    const onDeleted = mock()
    const ue = userEvent.setup()
    try {
      await renderInfo({ deleteTrip: failingDelete, onDeleted })
      await ue.click(screen.getByRole('button', { name: /delete trip/i }))
      await screen.findByText('Delete failed')
      expect(onDeleted).not.toHaveBeenCalled()
    } finally {
      window.confirm = originalConfirm
    }
  })

  it('shows error when leaveTrip rejects', async () => {
    const failingLeave = mock(() => Promise.reject(new Error('Leave failed')))
    const onLeft = mock()
    const ue = userEvent.setup()
    await renderInfo({
      leaveTrip: failingLeave,
      onLeft,
      getCoordinatorParticipant: () =>
        Promise.resolve({
          participants: [
            {
              participantUserId: 'other-user',
              participantUserName: 'Bob',
            },
          ],
        }),
    })
    await ue.click(screen.getByRole('button', { name: /leave trip/i }))
    await screen.findByText('Leave failed')
    expect(onLeft).not.toHaveBeenCalled()
  })
})
