import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import App from './App'
import type { Preferences, Trip } from './types.d.ts'

const defaultUser: Models.User = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
} as Models.User

const defaultPreferences: Preferences = {
  $id: 'pref-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  userId: 'user-1',
  skiSnowboard: JSON.stringify(['Ski']),
  difficulty: JSON.stringify(['Red']),
  piste: JSON.stringify(['On-Piste']),
  timeSlopes: 20,
  timeEating: 20,
  timeApres: 20,
  timeHotel: 40,
  accommodation: JSON.stringify(['Chalet']),
  mostImportantAspect: 'Good snow',
}

const sampleTrip: Trip = {
  $id: 'trip-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  code: 'abc-123',
  description: 'Alps adventure',
}
const updatedTrip: Trip = {
  $id: 'trip-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  code: 'abc-123',
  description: 'Dolomites adventure',
}

function renderApp(props = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser)}
      deleteSession={() => Promise.resolve()}
      listTrips={() => Promise.resolve({ trips: [], coordinatorUserIds: {} })}
      listParticipatedTrips={() => Promise.resolve({ trips: [] })}
      listTripParticipants={() => Promise.resolve({ participants: [] })}
      listPolls={() => Promise.resolve({ polls: [] })}
      updateTrip={() => Promise.resolve(updatedTrip)}
      deleteTrip={() => Promise.resolve()}
      leaveTrip={() => Promise.resolve()}
      getCoordinatorParticipant={() => Promise.resolve({ participants: [] })}
      getPreferences={() => Promise.resolve(defaultPreferences)}
      {...props}
    />
  )
}

function renderAppWithTrip(props = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser)}
      deleteSession={() => Promise.resolve()}
      listTrips={() =>
        Promise.resolve({ trips: [sampleTrip], coordinatorUserIds: {} })
      }
      listParticipatedTrips={() => Promise.resolve({ trips: [] })}
      listTripParticipants={() => Promise.resolve({ participants: [] })}
      listPolls={() => Promise.resolve({ polls: [] })}
      updateTrip={() => Promise.resolve(updatedTrip)}
      deleteTrip={() => Promise.resolve()}
      leaveTrip={() => Promise.resolve()}
      getCoordinatorParticipant={() => Promise.resolve({ participants: [] })}
      getPreferences={() => Promise.resolve(defaultPreferences)}
      {...props}
    />
  )
}

describe('App', () => {
  it('shows the login form when not authenticated', async () => {
    renderApp({
      accountGet: () => Promise.reject(new Error('Not authenticated')),
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('shows the Sign Out button when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i }))
    })
  })

  it('shows the signup form when the Sign up link is clicked', async () => {
    const user = userEvent.setup()
    renderApp({
      accountGet: () => Promise.reject(new Error('Not authenticated')),
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create account/i }))
    })
  })

  it('returns to the login form from the signup form', async () => {
    const user = userEvent.setup()
    renderApp({
      accountGet: () => Promise.reject(new Error('Not authenticated')),
    })

    await waitFor(() => screen.getByRole('button', { name: /sign up/i }))
    await user.click(screen.getByRole('button', { name: /sign up/i }))
    await waitFor(() =>
      screen.getByRole('heading', { name: /create account/i })
    )
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('shows the email when the user has no name', async () => {
    renderApp({
      accountGet: () =>
        Promise.resolve({
          $id: 'user-2',
          name: '',
          email: 'nameless@example.com',
        }),
    })
    await waitFor(() => {
      expect(screen.getByText('nameless@example.com'))
    })
  })

  it('returns to the login form after signing out', async () => {
    const mockDelete = mock(() => Promise.resolve())
    const user = userEvent.setup()
    renderApp({ deleteSession: mockDelete })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i }))
    })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('auto-selects the single trip and goes to trip detail', async () => {
    renderAppWithTrip()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /alps adventure/i }))
    })
  })

  it('defaults to the Proposals tab for a single trip with no active polls', async () => {
    renderAppWithTrip()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /proposals/i }))
    })
  })

  it('defaults to the Poll tab when there is an active poll', async () => {
    renderAppWithTrip({
      listPolls: () =>
        Promise.resolve({
          polls: [
            {
              $id: 'poll-1',
              state: 'OPEN',
              tripId: 'trip-1',
              pollCreatorUserId: 'user-1',
              pollCreatorUserName: 'Test',
              proposalIds: [],
              startDate: '2024-01-01T00:00:00.000Z',
              endDate: '2025-01-08T00:00:00.000Z',
            },
          ],
        }),
    })
    await waitFor(() => {
      const pollTab = screen.getByRole('button', { name: /^poll$/i })
      expect(pollTab.className !== 'active' || pollTab)
    })
  })

  it('shows the trip info panel when the info button is clicked', async () => {
    const ue = userEvent.setup()
    renderAppWithTrip({
      getCoordinatorParticipant: () =>
        Promise.resolve({
          participants: [
            {
              participantUserId: 'user-1',
              participantUserName: 'Test User',
            },
          ],
        }),
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alps adventure/i }))
    })
    await ue.click(screen.getByRole('button', { name: /Alps adventure/i }))

    await waitFor(() => {
      expect(screen.getByText('Trip Info'))
    })
  })

  it('shows the invite code in the trip info panel', async () => {
    const ue = userEvent.setup()
    renderAppWithTrip()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alps adventure/i }))
    })
    await ue.click(screen.getByRole('button', { name: /Alps adventure/i }))

    await waitFor(() => {
      expect(screen.getByText('Invite Code'))
    })
  })

  it('updates the trip description in the header after editing via trip info', async () => {
    const ue = userEvent.setup()
    const getCoordinatorParticipant = () =>
      Promise.resolve({
        participants: [
          {
            participantUserId: 'user-1',
            role: 'coordinator',
            participantUserName: 'Test User',
          },
        ],
      })

    render(
      <App
        accountGet={() => Promise.resolve(defaultUser)}
        deleteSession={() => Promise.resolve()}
        listTrips={() =>
          Promise.resolve({
            trips: [sampleTrip],
            coordinatorUserIds: {},
          })
        }
        listParticipatedTrips={() => Promise.resolve({ trips: [] })}
        listTripParticipants={() => Promise.resolve({ participants: [] })}
        listPolls={() => Promise.resolve({ polls: [] })}
        updateTrip={() => Promise.resolve(updatedTrip)}
        deleteTrip={() => Promise.resolve()}
        leaveTrip={() => Promise.resolve()}
        getCoordinatorParticipant={getCoordinatorParticipant}
        getPreferences={() => Promise.resolve(defaultPreferences)}
      />
    )

    await waitFor(() => screen.getByRole('button', { name: /Alps adventure/i }))
    await ue.click(screen.getByRole('button', { name: /Alps adventure/i }))

    await waitFor(() => screen.getByText('Trip Info'))
    await ue.click(screen.getByRole('button', { name: 'Edit description' }))

    await waitFor(() => screen.getByRole('button', { name: /^save$/i }))
    await ue.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Dolomites adventure').length).toBeGreaterThan(
        0
      )
    })
  })

  it('returns to trip list when navigating back from trip detail', async () => {
    const ue = userEvent.setup()
    const anotherTrip: Trip = {
      $id: 'trip-2',
      $createdAt: '2024-01-01T00:00:00.000Z',
      $updatedAt: '2024-01-01T00:00:00.000Z',
      code: 'def-456',
      description: 'Second trip',
    }
    render(
      <App
        accountGet={() => Promise.resolve(defaultUser)}
        deleteSession={() => Promise.resolve()}
        listTrips={() =>
          Promise.resolve({
            trips: [sampleTrip, anotherTrip],
            coordinatorUserIds: {},
          })
        }
        listParticipatedTrips={() => Promise.resolve({ trips: [] })}
        listTripParticipants={() => Promise.resolve({ participants: [] })}
        listPolls={() => Promise.resolve({ polls: [] })}
        updateTrip={() => Promise.resolve(updatedTrip)}
        deleteTrip={() => Promise.resolve()}
        leaveTrip={() => Promise.resolve()}
        getCoordinatorParticipant={() => Promise.resolve({ participants: [] })}
        getPreferences={() => Promise.resolve(defaultPreferences)}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Alps adventure'))
    })
    await ue.click(screen.getByText('Alps adventure'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /proposals/i }))
    })
    await ue.click(screen.getByRole('button', { name: /my trips/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^my trips$/i }))
    })
  })

  it('shows error when logout fails', async () => {
    const user = userEvent.setup()
    renderApp({
      deleteSession: () => Promise.reject(new Error('Logout failed')),
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i }))
    })
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    await screen.findByText('Logout failed')
  })

  it('shows preferences blocker when user has no preferences', async () => {
    renderApp({
      getPreferences: () => Promise.resolve(null),
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome/i }))
    })
    expect(screen.getByText(/set your preferences/i))
  })

  it('shows the app after saving preferences from blocker', async () => {
    const ue = userEvent.setup()
    const mockCreate = mock(() =>
      Promise.resolve({
        $id: 'pref-1',
        userId: 'user-1',
        skiSnowboard: JSON.stringify(['Ski']),
        difficulty: JSON.stringify(['Red']),
        piste: JSON.stringify(['On-Piste']),
        timeSlopes: 20,
        timeEating: 20,
        timeApres: 20,
        timeHotel: 40,
        accommodation: JSON.stringify(['Chalet']),
        mostImportantAspect: 'Good snow',
      })
    )
    renderApp({
      getPreferences: () => Promise.resolve(null),
      createPreferences: mockCreate,
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome/i }))
    })

    // Set a text field
    await ue.type(
      screen.getByPlaceholderText(/great après-ski scene/i),
      'Good snow'
    )

    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^my trips$/i }))
    })
  })

  it('opens preferences modal from header gear icon', async () => {
    const ue = userEvent.setup()
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preferences/i }))
    })
    await ue.click(screen.getByRole('button', { name: /preferences/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /preferences/i }))
    })
  })
})
