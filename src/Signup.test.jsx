import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Signup from './Signup'

const defaultUser = { $id: 'user-1', name: 'Test User', email: 'test@example.com' }
const noop = () => {}

function renderSignup (props = {}) {
  return render(
    <Signup
      onSignup={noop}
      onSwitchToLogin={noop}
      accountCreate={() => Promise.resolve()}
      createEmailPasswordSession={() => Promise.resolve()}
      accountGet={() => Promise.resolve(defaultUser)}
      generateId={() => 'generated-id'}
      {...props}
    />
  )
}

describe('Signup', () => {
  it('shows the Create Account heading', () => {
    renderSignup()
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders name, email, and password fields', () => {
    const { container } = renderSignup()
    expect(container.querySelector('[type="text"]')).toBeInTheDocument()
    expect(container.querySelector('[type="email"]')).toBeInTheDocument()
    expect(container.querySelector('[type="password"]')).toBeInTheDocument()
  })

  it('calls account.create, createEmailPasswordSession, and onSignup on submit', async () => {
    const user = userEvent.setup()
    const mockCreate = mock(() => Promise.resolve())
    const mockSession = mock(() => Promise.resolve())
    const handleSignup = mock(() => {})
    const { container } = renderSignup({
      accountCreate: mockCreate,
      createEmailPasswordSession: mockSession,
      onSignup: handleSignup
    })

    await user.type(container.querySelector('[type="text"]'), 'Alice')
    await user.type(container.querySelector('[type="email"]'), 'alice@example.com')
    await user.type(container.querySelector('[type="password"]'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        'generated-id',
        'alice@example.com',
        'password123',
        'Alice'
      )
      expect(mockSession).toHaveBeenCalledWith('alice@example.com', 'password123')
      expect(handleSignup).toHaveBeenCalledWith(defaultUser)
    })
  })

  it('shows an error message when account creation fails', async () => {
    const user = userEvent.setup()
    const { container } = renderSignup({
      accountCreate: () => Promise.reject(new Error('Email already in use'))
    })

    await user.type(container.querySelector('[type="text"]'), 'Alice')
    await user.type(container.querySelector('[type="email"]'), 'alice@example.com')
    await user.type(container.querySelector('[type="password"]'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already in use')).toBeInTheDocument()
    })
  })

  it('calls onSwitchToLogin when the Sign in button is clicked', async () => {
    const user = userEvent.setup()
    const handleSwitch = mock(() => {})
    renderSignup({ onSwitchToLogin: handleSwitch })

    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(handleSwitch).toHaveBeenCalledTimes(1)
  })
})
