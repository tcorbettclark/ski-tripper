import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const defaultUser = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
}
const sampleTrip = {
  $id: 'trip-1',
  code: 'abc-123',
  description: 'Alps adventure',
}
const updatedTrip = {
  $id: 'trip-1',
  code: 'abc-123',
  description: 'Dolomites adventure',
}

function renderApp(props = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser)}
      deleteSession={() => Promise.resolve()}
      listTrips={() => Promise.resolve({ documents: [] })}
      listParticipatedTrips={() => Promise.resolve({ documents: [] })}
      {...props}
    />
  )
}

function renderAppWithTrip(props = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser)}
      deleteSession={() => Promise.resolve()}
      listTrips={() => Promise.resolve({ documents: [sampleTrip] })}
      listParticipatedTrips={() => Promise.resolve({ documents: [] })}
      updateTrip={() => Promise.resolve(updatedTrip)}
      getCoordinatorParticipant={() => Promise.resolve({ documents: [] })}
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
      expect(
        screen.getByRole('heading', { name: /sign in/i })
      ).toBeInTheDocument()
    })
  })

  it('shows the trips interface when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })

  it('shows the Sign Out button when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign out/i })
      ).toBeInTheDocument()
    })
  })

  it('shows the signup form when the Sign up link is clicked', async () => {
    const user = userEvent.setup()
    renderApp({
      accountGet: () => Promise.reject(new Error('Not authenticated')),
    })

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /sign in/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /create account/i })
      ).toBeInTheDocument()
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
      expect(
        screen.getByRole('heading', { name: /sign in/i })
      ).toBeInTheDocument()
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
      expect(screen.getByText('nameless@example.com')).toBeInTheDocument()
    })
  })

  it('returns to the login form after signing out', async () => {
    const mockDelete = mock(() => Promise.resolve())
    const user = userEvent.setup()
    renderApp({ deleteSession: mockDelete })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign out/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole('heading', { name: /sign in/i })
      ).toBeInTheDocument()
    })
  })

  it('shows the trip description in the trip table', async () => {
    renderAppWithTrip()
    await waitFor(() => {
      expect(screen.getByText('Alps adventure')).toBeInTheDocument()
    })
  })

  it('shows the trip description in the detail panel when navigating to a trip', async () => {
    const ue = userEvent.setup()
    renderAppWithTrip()

    await waitFor(() => screen.getByText('Alps adventure'))
    await ue.click(screen.getByText('Alps adventure'))

    await waitFor(() => {
      expect(screen.getByText('Trip Details')).toBeInTheDocument()
      expect(screen.getAllByText('Alps adventure').length).toBeGreaterThan(0)
    })
  })

  it('updates the trip description in the detail panel and table after editing', async () => {
    const ue = userEvent.setup()
    const getCoordinatorParticipant = () =>
      Promise.resolve({
        documents: [
          {
            ParticipantUserId: 'user-1',
            role: 'coordinator',
            ParticipantUserName: 'Test User',
          },
        ],
      })
    const listParticipatedTrips = () => Promise.resolve({ documents: [] })

    render(
      <App
        accountGet={() => Promise.resolve(defaultUser)}
        deleteSession={() => Promise.resolve()}
        listTrips={() => Promise.resolve({ documents: [sampleTrip] })}
        listParticipatedTrips={listParticipatedTrips}
        updateTrip={() => Promise.resolve(updatedTrip)}
        getCoordinatorParticipant={getCoordinatorParticipant}
      />
    )

    // Navigate to trip detail
    await waitFor(() => screen.getByText('Alps adventure'))
    await ue.click(screen.getByText('Alps adventure'))
    await waitFor(() => screen.getByText('Trip Details'))

    // Click Edit (visible because user is coordinator)
    await waitFor(() => screen.getByRole('button', { name: /^edit$/i }))
    await ue.click(screen.getByRole('button', { name: /^edit$/i }))

    // Save the form
    await ue.click(screen.getByRole('button', { name: /^save$/i }))

    // Detail panel and header both show the updated description
    await waitFor(() => {
      expect(screen.getAllByText('Dolomites adventure').length).toBeGreaterThan(
        0
      )
    })

    // Navigating back to the list also shows the updated description in the table
    await ue.click(screen.getByRole('button', { name: /my trips/i }))
    await waitFor(() => screen.getByRole('heading', { name: /^my trips$/i }))
    expect(screen.getByText('Dolomites adventure')).toBeInTheDocument()
  })
})
