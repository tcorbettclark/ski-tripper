import { describe, expect, it } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Trip, User } from '../shared/types.d'
import Trips from './Trips'

interface RenderTripsProps {
  user?: User
  trips?: Trip[]
  onSelectTrip?: (trip: string) => void
  onJoinedTrip?: () => void
  createTrip?: () => Promise<{ id: string; description: string; code: string }>
  getTripByCode?: () => Promise<{ trips: Trip[] }>
  joinTrip?: () => Promise<void>
  getCoordinatorParticipant?: () => Promise<{
    participants: Array<{
      user: string
      userName: string
    }>
  }>
}

const testUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerification: true,
} as User

const defaultTrip = {
  id: 'new-trip',
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
          participants: [{ user: 'user-1', userName: 'Test User' }],
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

  it('shows help text explaining New Trip and Join Trip', async () => {
    await act(async () => {
      renderTrips()
    })
    await waitFor(() => {
      expect(screen.getByText(/coordinating a trip/i))
      expect(screen.getByText(/joining a trip/i))
    })
  })

  it('shows select trip line when user has trips', async () => {
    await act(async () => {
      renderTrips({
        trips: [
          {
            id: 't-1',
            description: 'Test Trip',
            code: 'xxx-yyy-zzz',
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-01T00:00:00.000Z',
          },
        ],
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/or select one of your trips below/i))
    })
  })

  it('hides select trip line when user has no trips', async () => {
    await act(async () => {
      renderTrips({ trips: [] })
    })
    await waitFor(() => {
      expect(screen.getByText(/coordinating a trip/i))
    })
    expect(screen.queryByText(/or select one of your trips below/i)).toBeNull()
  })

  it('renders a row for each trip', async () => {
    await act(async () => {
      renderTrips({
        trips: [
          {
            id: 't-1',
            description: "Val d'Isere week",
            code: 'aaa-bbb-ccc',
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 't-2',
            description: 'Chamonix weekend',
            code: 'ddd-eee-fff',
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-01T00:00:00.000Z',
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
            id: 't-1',
            description: 'Test Trip',
            code: 'xxx-yyy-zzz',
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-01T00:00:00.000Z',
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
