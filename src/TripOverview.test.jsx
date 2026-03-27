import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TripOverview from './TripOverview'

const trip = { $id: 'trip-1', code: 'abc-123', description: 'Old description' }
const currentUser = { $id: 'user-1', name: 'Alice', email: 'alice@example.com' }
const updatedTrip = { $id: 'trip-1', code: 'abc-123', description: 'New description' }

const noop = () => {}

function renderOverview (props = {}) {
  return render(
    <TripOverview
      trip={trip}
      user={currentUser}
      getCoordinatorParticipant={() => Promise.resolve({ documents: [{ userId: 'user-1', role: 'coordinator' }] })}
      getUserById={() => Promise.resolve(currentUser)}
      listParticipatedTrips={() => Promise.resolve({ documents: [] })}
      updateTrip={() => Promise.resolve(updatedTrip)}
      deleteTrip={() => Promise.resolve()}
      leaveTrip={() => Promise.resolve()}
      onLeft={noop}
      onUpdated={noop}
      {...props}
    />
  )
}

describe('TripOverview', () => {
  it('shows the trip description', () => {
    renderOverview()
    expect(screen.getByText('Old description')).toBeInTheDocument()
  })

  it('shows the Edit button for the coordinator', async () => {
    renderOverview()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    })
  })

  it('shows EditTripForm when Edit is clicked', async () => {
    const ue = userEvent.setup()
    renderOverview()
    await waitFor(() => screen.getByRole('button', { name: /^edit$/i }))
    await ue.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('calls onUpdated with the updated trip after saving', async () => {
    const ue = userEvent.setup()
    const handleUpdated = mock(() => {})
    renderOverview({ onUpdated: handleUpdated })

    await waitFor(() => screen.getByRole('button', { name: /^edit$/i }))
    await ue.click(screen.getByRole('button', { name: /^edit$/i }))

    const descInput = screen.getByRole('textbox')
    await ue.clear(descInput)
    await ue.type(descInput, 'New description')
    await ue.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(handleUpdated).toHaveBeenCalledWith(updatedTrip)
    })
  })

  it('exits edit mode after saving', async () => {
    const ue = userEvent.setup()
    renderOverview()

    await waitFor(() => screen.getByRole('button', { name: /^edit$/i }))
    await ue.click(screen.getByRole('button', { name: /^edit$/i }))
    await ue.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
    })
  })
})
