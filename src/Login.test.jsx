import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './Login'

const defaultUser = { $id: 'user-1', name: 'Test User', email: 'test@example.com' }
const noop = () => {}

function renderLogin (props = {}) {
  return render(
    <Login
      onLogin={noop}
      onSwitchToSignup={noop}
      createEmailPasswordSession={() => Promise.resolve()}
      accountGet={() => Promise.resolve(defaultUser)}
      {...props}
    />
  )
}

describe('Login', () => {
  it('shows the Sign In heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    const { container } = renderLogin()
    expect(container.querySelector('[type="email"]')).toBeInTheDocument()
    expect(container.querySelector('[type="password"]')).toBeInTheDocument()
  })

  it('calls createEmailPasswordSession and onLogin with the user on submit', async () => {
    const user = userEvent.setup()
    const mockSession = mock(() => Promise.resolve())
    const handleLogin = mock(() => {})
    const { container } = renderLogin({ createEmailPasswordSession: mockSession, onLogin: handleLogin })

    await user.type(container.querySelector('[type="email"]'), 'alice@example.com')
    await user.type(container.querySelector('[type="password"]'), 'secret123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(mockSession).toHaveBeenCalledWith('alice@example.com', 'secret123')
      expect(handleLogin).toHaveBeenCalledWith(defaultUser)
    })
  })

  it('shows an error message when login fails', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin({
      createEmailPasswordSession: () => Promise.reject(new Error('Invalid credentials'))
    })

    await user.type(container.querySelector('[type="email"]'), 'bad@example.com')
    await user.type(container.querySelector('[type="password"]'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls onSwitchToSignup when the Sign up button is clicked', async () => {
    const user = userEvent.setup()
    const handleSwitch = mock(() => {})
    renderLogin({ onSwitchToSignup: handleSwitch })

    await user.click(screen.getByRole('button', { name: /sign up/i }))
    expect(handleSwitch).toHaveBeenCalledTimes(1)
  })

  it('disables the submit button while signing in', async () => {
    let resolveSession
    const user = userEvent.setup()
    const { container } = renderLogin({
      createEmailPasswordSession: () => new Promise((resolve) => { resolveSession = resolve })
    })

    await user.type(container.querySelector('[type="email"]'), 'alice@example.com')
    await user.type(container.querySelector('[type="password"]'), 'secret123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()

    // Settle the pending promise so cleanup doesn't trigger act() warnings
    await act(async () => { resolveSession() })
  })
})
