import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import AuthForm from './AuthForm'

const defaultUser: Models.User = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
} as Models.User
const noop = () => {}

function renderAuthForm(props = {}) {
  return render(
    <AuthForm
      mode="login"
      onSuccess={noop}
      onSwitchMode={noop}
      createEmailPasswordSession={() => Promise.resolve({} as Models.Session)}
      accountGet={() => Promise.resolve(defaultUser)}
      {...props}
    />
  )
}

describe('AuthForm', () => {
  describe('login mode', () => {
    it('shows the Sign In heading', () => {
      renderAuthForm({ mode: 'login' })
      expect(screen.getByRole('heading', { name: /sign in/i }))
    })

    it('renders email and password fields', () => {
      const { container } = renderAuthForm({ mode: 'login' })
      expect(container.querySelector('[type="email"]'))
      expect(container.querySelector('[type="password"]'))
    })

    it('calls createEmailPasswordSession and onSuccess with the user on submit', async () => {
      const user = userEvent.setup()
      const mockSession = mock(() => Promise.resolve())
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'login',
        createEmailPasswordSession: mockSession,
        onSuccess: handleSuccess,
      })

      await user.type(
        container.querySelector('[type="email"]')!,
        'alice@example.com'
      )
      await user.type(
        container.querySelector('[type="password"]')!,
        'secret123'
      )
      await user.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(mockSession).toHaveBeenCalledWith(
          'alice@example.com',
          'secret123'
        )
        expect(handleSuccess).toHaveBeenCalledWith(defaultUser)
      })
    })

    it('shows an error message when login fails', async () => {
      const user = userEvent.setup()
      const { container } = renderAuthForm({
        mode: 'login',
        createEmailPasswordSession: () =>
          Promise.reject(new Error('Invalid credentials')),
      })

      await user.type(
        container.querySelector('[type="email"]')!,
        'bad@example.com'
      )
      await user.type(
        container.querySelector('[type="password"]')!,
        'wrongpass'
      )
      await user.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials'))
      })
    })

    it('calls onSwitchMode when the Sign up button is clicked', async () => {
      const user = userEvent.setup()
      const handleSwitch = mock(() => {})
      renderAuthForm({ mode: 'login', onSwitchMode: handleSwitch })

      await user.click(screen.getByRole('button', { name: /sign up/i }))
      expect(handleSwitch).toHaveBeenCalledTimes(1)
    })

    it('disables the submit button while signing in', async () => {
      let resolveSession: ((value: unknown) => void) | undefined
      const user = userEvent.setup()
      const { container } = renderAuthForm({
        mode: 'login',
        createEmailPasswordSession: () =>
          new Promise((resolve) => {
            resolveSession = resolve
          }),
      })

      await user.type(
        container.querySelector('[type="email"]')!,
        'alice@example.com'
      )
      await user.type(
        container.querySelector('[type="password"]')!,
        'secret123'
      )
      await user.click(screen.getByRole('button', { name: /^sign in$/i }))

      expect(
        (
          screen.getByRole('button', {
            name: /signing in/i,
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true)

      // Settle the pending promise so cleanup doesn't trigger act() warnings
      await act(async () => {
        resolveSession?.(undefined)
      })
    })
  })

  describe('signup mode', () => {
    it('shows the Create Account heading', () => {
      renderAuthForm({ mode: 'signup' })
      expect(screen.getByRole('heading', { name: /create account/i }))
    })

    it('renders name, email, and password fields', () => {
      const { container } = renderAuthForm({ mode: 'signup' })
      expect(container.querySelector('[type="text"]'))
      expect(container.querySelector('[type="email"]'))
      expect(container.querySelector('[type="password"]'))
    })

    it('calls accountCreate, createEmailPasswordSession, and onSuccess on submit', async () => {
      const user = userEvent.setup()
      const mockCreate = mock(() => Promise.resolve())
      const mockSession = mock(() => Promise.resolve())
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'signup',
        accountCreate: mockCreate,
        createEmailPasswordSession: mockSession,
        onSuccess: handleSuccess,
        generateId: () => 'generated-id',
      })

      await user.type(container.querySelector('[type="text"]')!, 'Alice')
      await user.type(
        container.querySelector('[type="email"]')!,
        'alice@example.com'
      )
      await user.type(
        container.querySelector('[type="password"]')!,
        'password123'
      )
      await user.click(screen.getByRole('button', { name: /sign up$/i }))

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          'generated-id',
          'alice@example.com',
          'password123',
          'Alice'
        )
        expect(mockSession).toHaveBeenCalledWith(
          'alice@example.com',
          'password123'
        )
        expect(handleSuccess).toHaveBeenCalledWith(defaultUser)
      })
    })

    it('shows an error message when account creation fails', async () => {
      const user = userEvent.setup()
      const { container } = renderAuthForm({
        mode: 'signup',
        accountCreate: () => Promise.reject(new Error('Email already in use')),
      })

      await user.type(container.querySelector('[type="text"]')!, 'Alice')
      await user.type(
        container.querySelector('[type="email"]')!,
        'alice@example.com'
      )
      await user.type(
        container.querySelector('[type="password"]')!,
        'password123'
      )
      await user.click(screen.getByRole('button', { name: /sign up$/i }))

      await waitFor(() => {
        expect(screen.getByText('Email already in use'))
      })
    })

    it('calls onSwitchMode when the Sign in button is clicked', async () => {
      const user = userEvent.setup()
      const handleSwitch = mock(() => {})
      renderAuthForm({ mode: 'signup', onSwitchMode: handleSwitch })

      await user.click(screen.getByRole('button', { name: /^sign in$/i }))
      expect(handleSwitch).toHaveBeenCalledTimes(1)
    })
  })
})
