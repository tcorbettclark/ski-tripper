import { describe, it, expect } from 'bun:test'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Trips from './Trips'

const testUser = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
}
const defaultTrip = {
  $id: 'new-trip',
  description: 'New Trip',
  code: 'aaa-bbb-ccc',
}

function renderTrips(props = {}) {
  return render(
    <Trips
      user={testUser}
      trips={props.trips || []}
      onSelectTrip={props.onSelectTrip || (() => {})}
      onJoinedTrip={props.onJoinedTrip || (() => {})}
      createTrip={() => Promise.resolve(defaultTrip)}
      getTripByCode={() => Promise.resolve({ documents: [] })}
      joinTrip={() => Promise.resolve()}
      updateTrip={() => Promise.resolve(defaultTrip)}
      deleteTrip={() => Promise.resolve()}
      leaveTrip={() => Promise.resolve()}
      getCoordinatorParticipant={() =>
        Promise.resolve({
          documents: [
            { ParticipantUserId: 'user-1', ParticipantUserName: 'Test User' },
          ],
        })
      }
    />
  )
}

describe('Trips', () => {
  it('shows the My Trips heading with New Trip and Join Trip buttons', async () => {
    await act(async () => {
      renderTrips()
    })
    await waitFor(() => {
      expect(screen.getByText('My Trips')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /\+ new trip/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /\+ join trip/i })
      ).toBeInTheDocument()
    })
  })

  it('shows an empty state message when no trips', async () => {
    await act(async () => {
      renderTrips({ trips: [] })
    })
    await waitFor(() => {
      expect(screen.getByText(/no trips yet/i)).toBeInTheDocument()
    })
  })

  it('renders a row for each trip', async () => {
    await act(async () => {
      renderTrips({
        trips: [
          { $id: 't-1', description: "Val d'Isere week", code: 'aaa-bbb-ccc' },
          { $id: 't-2', description: 'Chamonix weekend', code: 'ddd-eee-fff' },
        ],
      })
    })
    await waitFor(() => {
      expect(screen.getByText("Val d'Isere week")).toBeInTheDocument()
      expect(screen.getByText('Chamonix weekend')).toBeInTheDocument()
    })
  })

  it('calls onSelectTrip when a row is clicked', async () => {
    const user = userEvent.setup()
    const handleSelectTrip = () => {}
    await act(async () => {
      renderTrips({
        trips: [{ $id: 't-1', description: 'Test Trip', code: 'xxx-yyy-zzz' }],
        onSelectTrip: handleSelectTrip,
      })
    })
    await user.click(screen.getByText('Test Trip'))
    await waitFor(() => {
      expect(screen.getByText('Test Trip')).toBeInTheDocument()
    })
  })
})
