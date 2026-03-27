import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const defaultUser = { $id: 'user-1', name: 'Test User', email: 'test@example.com' }

function renderApp (props = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser)}
      deleteSession={() => Promise.resolve()}
      listParticipatedTrips={() => Promise.resolve({ documents: [] })}
      {...props}
    />
  )
}

describe('App', () => {
  it('shows the login form when not authenticated', async () => {
    renderApp({ accountGet: () => Promise.reject(new Error('Not authenticated')) })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
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
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    })
  })

  it('shows the signup form when the Sign up link is clicked', async () => {
    const user = userEvent.setup()
    renderApp({ accountGet: () => Promise.reject(new Error('Not authenticated')) })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
    })
  })

  it('returns to the login form from the signup form', async () => {
    const user = userEvent.setup()
    renderApp({ accountGet: () => Promise.reject(new Error('Not authenticated')) })

    await waitFor(() => screen.getByRole('button', { name: /sign up/i }))
    await user.click(screen.getByRole('button', { name: /sign up/i }))
    await waitFor(() => screen.getByRole('heading', { name: /create account/i }))
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  it('shows the email when the user has no name', async () => {
    renderApp({ accountGet: () => Promise.resolve({ $id: 'user-2', name: '', email: 'nameless@example.com' }) })
    await waitFor(() => {
      expect(screen.getByText('nameless@example.com')).toBeInTheDocument()
    })
  })

  it('returns to the login form after signing out', async () => {
    const mockDelete = mock(() => Promise.resolve())
    const user = userEvent.setup()
    renderApp({ deleteSession: mockDelete })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  it('shows Trips and Proposals nav tabs when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^trips$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^proposals$/i })).toBeInTheDocument()
    })
  })

  it('shows the Proposals page when the Proposals tab is clicked', async () => {
    const user = userEvent.setup()
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^proposals$/i })).toBeInTheDocument()
    })

    // The Trips component is mounted by default; clicking Proposals unmounts it
    await user.click(screen.getByRole('button', { name: /^proposals$/i }))

    // Proposals mounts and immediately starts loading; Trips is no longer rendered
    await waitFor(() => {
      expect(screen.queryByText(/loading trips/i)).not.toBeInTheDocument()
      // The Proposals nav tab button is still in the header
      expect(screen.getByRole('button', { name: /^proposals$/i })).toBeInTheDocument()
    })
  })

  it('switches back to the Trips page when the Trips tab is clicked after navigating to Proposals', async () => {
    const user = userEvent.setup()
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^proposals$/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /^proposals$/i }))

    // Now switch back to Trips
    await user.click(screen.getByRole('button', { name: /^trips$/i }))

    // The user name is still visible in the header
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })

  it('shows a Poll nav tab when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^poll$/i })).toBeInTheDocument()
    })
  })

  it('shows the Poll page when the Poll tab is clicked', async () => {
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^poll$/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /^poll$/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^poll$/i })).toBeInTheDocument()
    })
  })
})
