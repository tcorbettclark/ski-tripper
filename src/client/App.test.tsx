import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Preferences, Trip, User } from '../shared/types.d'
import App from './App'
import { dayjs } from './utils'

const mockLogin = mock((_user: User) => {})
const mockLogout = mock((_message?: string) => {})
const mockAutoLogout = mock((_message?: string) => {})

function createMockAuth(
  overrides: {
    user?: User | null
    checking?: boolean
    sessionExpiredMessage?: string | null
  } = {}
) {
  return (_options?: { hasSession?: () => boolean }) => ({
    user: overrides.user ?? null,
    checking: overrides.checking ?? false,
    sessionExpiredMessage: overrides.sessionExpiredMessage ?? null,
    login: mockLogin,
    logout: mockLogout,
    autoLogout: mockAutoLogout,
    onAuthError: mock(() => {}),
    setSessionExpiredMessage: mock(() => {}),
    refreshUser: mock(() => {}),
  })
}

const defaultUser: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerification: true,
}

const defaultPreferences: Preferences = {
  id: 'pref-1',
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-01T00:00:00.000Z',
  user: 'user-1',
  skiSnowboard: ['Ski'],
  difficulty: ['Red'],
  piste: ['On-Piste'],
  timeSlopes: 20,
  timeEating: 20,
  timeApres: 20,
  timeHotel: 40,
  accommodation: ['Chalet'],
  notes: 'Good snow',
}

const sampleTrip: Trip = {
  id: 'trip-1',
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-01T00:00:00.000Z',
  code: 'abc-123',
  description: 'Alps adventure',
}

const defaultAppProps = {
  listTrips: () => Promise.resolve({ trips: [], coordinatorUserIds: {} }),
  listParticipatedTrips: () => Promise.resolve({ trips: [] }),
  listPolls: () => Promise.resolve({ polls: [] }),
  getCoordinatorParticipant: () => Promise.resolve({ participants: [] }),
  getPreferences: () => Promise.resolve(defaultPreferences),
  fetchResortDataWithAuth: () => Promise.resolve(''),
  createPreferences: () => Promise.resolve(defaultPreferences),
  updateTrip: () => Promise.resolve(sampleTrip),
  hasSession: () => true,
  updateName: () => Promise.resolve(),
  listTripParticipants: () => Promise.resolve({ participants: [] }),
  useAuthHook: createMockAuth(),
  useIsSmallScreenHook: () => false,
  useAutoHideFooterHook: (() => 'visible') as () => 'visible' | 'hidden',
}

function renderApp(props = {}) {
  return render(<App {...defaultAppProps} {...props} />)
}

function renderAppWithTrip(props = {}) {
  return render(
    <App
      {...defaultAppProps}
      listTrips={() =>
        Promise.resolve({ trips: [sampleTrip], coordinatorUserIds: {} })
      }
      {...props}
    />
  )
}

describe('App', () => {
  it('shows the login form when not authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })
  })

  it('fetches resort data after login', async () => {
    const mockFetchResortDataWithAuth = mock(() => Promise.resolve(''))
    renderApp({
      useAuthHook: createMockAuth({ user: defaultUser }),
      fetchResortDataWithAuth: mockFetchResortDataWithAuth,
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })
    expect(mockFetchResortDataWithAuth).toHaveBeenCalled()
  })

  it('shows the user menu when authenticated', async () => {
    renderApp({ useAuthHook: createMockAuth({ user: defaultUser }) })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test user/i }))
    })
  })

  it('shows the signup form when the Sign up link is clicked', async () => {
    renderApp()
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
    renderApp()
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

  it('shows forgot password form when Forgot password link is clicked', async () => {
    const user = userEvent.setup()
    renderApp()
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
    renderApp()
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

  it('auto-selects the single trip and goes to trip detail', async () => {
    renderAppWithTrip({ useAuthHook: createMockAuth({ user: defaultUser }) })
    await waitFor(() => {
      expect(screen.getAllByText('Alps adventure').length).toBeGreaterThan(0)
    })
  })

  it('defaults to the Overview tab for a single trip with no active polls', async () => {
    renderAppWithTrip({ useAuthHook: createMockAuth({ user: defaultUser }) })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^overview$/i }))
    })
  })

  it('shows countdown in header when an active poll exists', async () => {
    const future = dayjs().add(2, 'day').toISOString()
    renderAppWithTrip({
      useAuthHook: createMockAuth({ user: defaultUser }),
      listPolls: () =>
        Promise.resolve({
          polls: [
            {
              state: 'OPEN',
              endDate: future,
            },
          ],
        }),
    })
    await waitFor(() => {
      expect(screen.getByText(/Poll closing in \d+d \d+h/))
    })
  })

  describe('on small screens', () => {
    it('shows hamburger menu instead of user name button on trip list', async () => {
      renderApp({
        useAuthHook: createMockAuth({ user: defaultUser }),
        useIsSmallScreenHook: () => true,
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open menu/i })).toBeDefined()
      })
      expect(screen.queryByRole('button', { name: /test user/i })).toBeNull()
    })

    it('shows user name text beside hamburger on trip list', async () => {
      renderApp({
        useAuthHook: createMockAuth({ user: defaultUser }),
        useIsSmallScreenHook: () => true,
      })
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeDefined()
      })
    })
  })
})
