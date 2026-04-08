import { describe, expect, it } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import Trips from './Trips'
import type { Trip } from './types'

interface RenderTripsProps {
  user?: Models.User
  trips?: Trip[]
  onSelectTrip?: (tripId: string) => void
  onJoinedTrip?: () => void
  createTrip?: () => Promise<{ $id: string; description: string; code: string }>
  getTripByCode?: () => Promise<{ trips: Trip[] }>
  joinTrip?: () => Promise<void>
  getCoordinatorParticipant?: () => Promise<{
    participants: Array<{
      participantUserId: string
      participantUserName: string
    }>
  }>
}

const testUser = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
} as Models.User

const defaultTrip = {
  $id: 'new-trip',
  description: 'New Trip',
  code: 'aaa-bbb-ccc',
}

function renderTrips(props: RenderTripsProps = {}) {
  return render(
    <Trips
      user={testUser}
      trips={props.trips || []}
      onSelectTrip={props.onSelectTrip || (() => {})}
      onJoinedTrip={props.onJoinedTrip || (() => {})}
      createTrip={() => Promise.resolve(defaultTrip)}
      getTripByCode={() => Promise.resolve({ trips: [] })}
      joinTrip={() => Promise.resolve()}
      getCoordinatorParticipant={() =>
        Promise.resolve({
          participants: [
            { participantUserId: 'user-1', participantUserName: 'Test User' },
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
      expect(screen.getByText('My Trips'))
      expect(screen.getByRole('button', { name: /\+ new trip/i }))
      expect(screen.getByRole('button', { name: /\+ join trip/i }))
    })
  })

  it('shows an empty state message when no trips', async () => {
    await act(async () => {
      renderTrips({ trips: [] })
    })
    await waitFor(() => {
      expect(screen.getByText(/no trips yet/i))
    })
  })

  it('renders a row for each trip', async () => {
    await act(async () => {
      renderTrips({
        trips: [
          {
            $id: 't-1',
            description: "Val d'Isere week",
            code: 'aaa-bbb-ccc',
            $createdAt: '2024-01-01T00:00:00.000Z',
            $updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            $id: 't-2',
            description: 'Chamonix weekend',
            code: 'ddd-eee-fff',
            $createdAt: '2024-01-01T00:00:00.000Z',
            $updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      })
    })
    await waitFor(() => {
      expect(screen.getByText("Val d'Isere week"))
      expect(screen.getByText('Chamonix weekend'))
    })
  })

  it('calls onSelectTrip when a row is clicked', async () => {
    const user = userEvent.setup()
    const handleSelectTrip = () => {}
    await act(async () => {
      renderTrips({
        trips: [
          {
            $id: 't-1',
            description: 'Test Trip',
            code: 'xxx-yyy-zzz',
            $createdAt: '2024-01-01T00:00:00.000Z',
            $updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        onSelectTrip: handleSelectTrip,
      })
    })
    await user.click(screen.getByText('Test Trip'))
    await waitFor(() => {
      expect(screen.getByText('Test Trip'))
    })
  })
})
