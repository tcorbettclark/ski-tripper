import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import App from './App'
import type { Preferences, Trip } from './types.d.ts'
import { dayjs } from './utils'

let isSmallScreen = false

mock.module('./useIsSmallScreen', () => ({
  default: () => isSmallScreen,
}))

const defaultUser: Models.User = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerification: true,
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

function renderApp(props = {}, { loggedIn = true } = {}) {
  return render(
    <App
      hasSession={() => loggedIn}
      accountGet={() =>
        loggedIn
          ? Promise.resolve(defaultUser)
          : Promise.reject(new Error('Not authenticated'))
      }
      deleteSession={() => Promise.resolve()}
      listTrips={() => Promise.resolve({ trips: [], coordinatorUserIds: {} })}
      listParticipatedTrips={() => Promise.resolve({ trips: [] })}
      listPolls={() => Promise.resolve({ polls: [] })}
      getCoordinatorParticipant={() => Promise.resolve({ participants: [] })}
      getPreferences={() => Promise.resolve(defaultPreferences)}
      fetchResortDataWithAuth={() => Promise.resolve('')}
      {...props}
    />
  )
}

function renderAppWithTrip(props = {}, { loggedIn = true } = {}) {
  return render(
    <App
      hasSession={() => loggedIn}
      accountGet={() =>
        loggedIn
          ? Promise.resolve(defaultUser)
          : Promise.reject(new Error('Not authenticated'))
      }
      deleteSession={() => Promise.resolve()}
      listTrips={() =>
        Promise.resolve({ trips: [sampleTrip], coordinatorUserIds: {} })
      }
      listParticipatedTrips={() => Promise.resolve({ trips: [] })}
      listPolls={() => Promise.resolve({ polls: [] })}
      getCoordinatorParticipant={() => Promise.resolve({ participants: [] })}
      getPreferences={() => Promise.resolve(defaultPreferences)}
      fetchResortDataWithAuth={() => Promise.resolve('')}
      {...props}
    />
  )
}

describe('App', () => {
  beforeEach(() => {
    isSmallScreen = false
  })

  it('shows the login form when not authenticated', async () => {
    renderApp({}, { loggedIn: false })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('shows the login form when hasSession returns false', async () => {
    renderApp({ hasSession: () => false })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('never calls accountGet when hasSession returns false', async () => {
    const mockAccountGet = mock(() => Promise.resolve(defaultUser))
    renderApp({ hasSession: () => false, accountGet: mockAccountGet })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    expect(mockAccountGet).not.toHaveBeenCalled()
  })

  it('does not fetch resort data before login', async () => {
    const mockFetchResortDataWithAuth = mock(() => Promise.resolve(''))
    renderApp(
      {
        hasSession: () => false,
        fetchResortDataWithAuth: mockFetchResortDataWithAuth,
      },
      { loggedIn: false }
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    expect(mockFetchResortDataWithAuth).not.toHaveBeenCalled()
  })

  it('fetches resort data after login', async () => {
    const mockFetchResortDataWithAuth = mock(() => Promise.resolve(''))
    renderApp({ fetchResortDataWithAuth: mockFetchResortDataWithAuth })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })
    expect(mockFetchResortDataWithAuth).toHaveBeenCalled()
  })

  it('shows the user menu when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })
  })

  it('shows the signup form when the Sign up link is clicked', async () => {
    renderApp({}, { loggedIn: false })
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create account/i }))
    })
  })

  it('returns to the login form from the signup form', async () => {
    renderApp({}, { loggedIn: false })
    const user = userEvent.setup()

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
      expect(screen.getByRole('button', { name: /test user/i }))
    })
    await user.click(screen.getByRole('button', { name: /test user/i }))
    await waitFor(() => {
      expect(screen.getByText('Sign Out'))
    })
    await user.click(screen.getByText('Sign Out'))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('auto-selects the single trip and goes to trip detail', async () => {
    renderAppWithTrip()
    await waitFor(() => {
      expect(screen.getAllByText('Alps adventure').length).toBeGreaterThan(0)
    })
  })

  it('defaults to the Overview tab for a single trip with no active polls', async () => {
    renderAppWithTrip()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^overview$/i }))
    })
  })

  it('defaults to the Overview tab when there is an active poll', async () => {
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
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2025-01-08T00:00:00.000Z',
            },
          ],
        }),
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^overview$/i }))
    })
  })

  it('shows countdown in header when an active poll exists', async () => {
    const future = dayjs().add(2, 'day').toISOString()
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
              endDate: future,
            },
          ],
        }),
    })
    await waitFor(() => {
      expect(screen.getByText(/Poll closing in \d+d \d+h/))
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
        hasSession={() => true}
        accountGet={() => Promise.resolve(defaultUser)}
        deleteSession={() => Promise.resolve()}
        listTrips={() =>
          Promise.resolve({
            trips: [sampleTrip, anotherTrip],
            coordinatorUserIds: {},
          })
        }
        listParticipatedTrips={() => Promise.resolve({ trips: [] })}
        listPolls={() => Promise.resolve({ polls: [] })}
        getCoordinatorParticipant={() => Promise.resolve({ participants: [] })}
        getPreferences={() => Promise.resolve(defaultPreferences)}
        fetchResortDataWithAuth={() => Promise.resolve('')}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Alps adventure'))
    })
    await ue.click(screen.getByText('Alps adventure'))

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /^proposals$/i }).length
      ).toBeGreaterThan(0)
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
      expect(screen.getByRole('button', { name: /test user/i }))
    })
    await user.click(screen.getByRole('button', { name: /test user/i }))
    await waitFor(() => {
      expect(screen.getByText('Sign Out'))
    })
    await user.click(screen.getByText('Sign Out'))
    await screen.findByText('Logout failed')
  })

  it('does not re-fetch preferences when user object changes after initial load', async () => {
    let callCount = 0
    const mockGetPreferences = mock(() => {
      callCount++
      return Promise.resolve(defaultPreferences)
    })
    renderApp({ getPreferences: mockGetPreferences })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })
    expect(callCount).toBe(1)
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

    await ue.type(
      screen.getByPlaceholderText(/tell us what matters most/i),
      'Good snow'
    )

    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^my trips$/i }))
    })
  })

  it('opens preferences modal from user menu', async () => {
    const ue = userEvent.setup()
    await act(async () => {
      renderApp()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })
    await ue.click(screen.getByRole('button', { name: /test user/i }))
    await waitFor(() => {
      expect(screen.getByText('Preferences'))
    })
    await ue.click(screen.getByText('Preferences'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /preferences/i }))
    })
  })

  it('displays sessionExpiredMessage above the login form', async () => {
    const user = userEvent.setup()
    const mockDelete = mock(() => Promise.resolve())
    renderApp({ deleteSession: mockDelete })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })

    await user.click(screen.getByRole('button', { name: /test user/i }))
    await waitFor(() => {
      expect(screen.getByText('Sign Out'))
    })
    await user.click(screen.getByText('Sign Out'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('displays sessionExpiredMessage on auth failure from account.get', async () => {
    renderApp({
      hasSession: () => true,
      accountGet: () => Promise.reject(new Error('Not authenticated')),
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('shows forgot password form when Forgot password link is clicked', async () => {
    const user = userEvent.setup()
    renderApp({}, { loggedIn: false })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    await user.click(screen.getByRole('button', { name: /forgot password/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset password/i }))
    })
  })

  it('returns to login from forgot password form', async () => {
    const user = userEvent.setup()
    renderApp({}, { loggedIn: false })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
    await user.click(screen.getByRole('button', { name: /forgot password/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset password/i }))
    })
    await user.click(screen.getByRole('button', { name: /back to sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('shows password reset message after successful reset', async () => {
    const mockUpdateRecovery = mock(() => Promise.resolve())
    renderApp({ updateRecovery: mockUpdateRecovery }, { loggedIn: false })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  describe('on small screens', () => {
    beforeEach(() => {
      isSmallScreen = true
    })

    it('shows hamburger menu instead of user name button on trip list', async () => {
      renderApp()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open menu/i })).toBeDefined()
      })
      expect(screen.queryByRole('button', { name: /test user/i })).toBeNull()
    })

    it('shows user name text beside hamburger on trip list', async () => {
      renderApp()
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeDefined()
      })
    })

    it('opens mobile menu and shows sign out option', async () => {
      const ue = userEvent.setup()
      renderApp()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open menu/i })).toBeDefined()
      })
      await ue.click(screen.getByRole('button', { name: /open menu/i }))
      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeDefined()
      })
    })
  })
})
