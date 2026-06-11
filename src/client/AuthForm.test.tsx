import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from '../shared/types.d'
import AuthForm from './AuthForm'

const verifiedUser: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerification: true,
}
const unverifiedUser: User = {
  id: 'user-2',
  name: 'Unverified User',
  email: 'unverified@example.com',
  emailVerification: false,
}
const noop = () => {}

function renderAuthForm(props = {}) {
  return render(
    <AuthForm
      mode="login"
      onSuccess={noop}
      onSwitchMode={noop}
      authWithPassword={() => Promise.resolve(verifiedUser)}
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

    it('calls authWithPassword and onSuccess with user on submit', async () => {
      const user = userEvent.setup()
      const mockAuth = mock(() => Promise.resolve(verifiedUser))
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'login',
        authWithPassword: mockAuth,
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
        expect(mockAuth).toHaveBeenCalledWith('alice@example.com', 'secret123')
        expect(handleSuccess).toHaveBeenCalledWith(verifiedUser)
      })
    })

    it('calls onSuccess with unverified user when user is unverified on login', async () => {
      const user = userEvent.setup()
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'login',
        authWithPassword: () => Promise.resolve(unverifiedUser),
        onSuccess: handleSuccess,
      })

      await user.type(
        container.querySelector('[type="email"]')!,
        'unverified@example.com'
      )
      await user.type(
        container.querySelector('[type="password"]')!,
        'secret123'
      )
      await user.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalledWith(unverifiedUser)
      })
    })

    it('shows an error message when login fails', async () => {
      const user = userEvent.setup()
      const { container } = renderAuthForm({
        mode: 'login',
        authWithPassword: () =>
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

    it('calls onForgotPassword when the Forgot password link is clicked', async () => {
      const user = userEvent.setup()
      const handleForgotPassword = mock(() => {})
      renderAuthForm({
        mode: 'login',
        onForgotPassword: handleForgotPassword,
      })

      await user.click(screen.getByRole('button', { name: /forgot password/i }))
      expect(handleForgotPassword).toHaveBeenCalledTimes(1)
    })

    it('does not show Forgot password link when onForgotPassword is not provided', () => {
      renderAuthForm({ mode: 'login' })
      expect(
        screen.queryByRole('button', { name: /forgot password/i })
      ).toBeNull()
    })

    it('does not show Forgot password link in signup mode', () => {
      const handleForgotPassword = mock(() => {})
      renderAuthForm({
        mode: 'signup',
        onForgotPassword: handleForgotPassword,
      })
      expect(
        screen.queryByRole('button', { name: /forgot password/i })
      ).toBeNull()
    })

    it('disables the submit button while signing in', async () => {
      let resolveAuth: ((value: unknown) => void) | undefined
      const user = userEvent.setup()
      const { container } = renderAuthForm({
        mode: 'login',
        authWithPassword: () =>
          new Promise((resolve) => {
            resolveAuth = resolve
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

      await act(async () => {
        resolveAuth?.(undefined)
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

    it('calls createUser, authWithPassword, and requestVerification when unverified after signup', async () => {
      const user = userEvent.setup()
      const mockCreateUser = mock(() => Promise.resolve())
      const mockAuth = mock(() => Promise.resolve(unverifiedUser))
      const mockRequestVerification = mock(() => Promise.resolve())
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'signup',
        createUser: mockCreateUser,
        authWithPassword: mockAuth,
        requestVerification: mockRequestVerification,
        onSuccess: handleSuccess,
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
        expect(mockCreateUser).toHaveBeenCalledWith(
          'alice@example.com',
          'password123',
          'Alice'
        )
        expect(mockAuth).toHaveBeenCalledWith(
          'alice@example.com',
          'password123'
        )
        expect(mockRequestVerification).toHaveBeenCalledWith(
          'alice@example.com'
        )
        expect(handleSuccess).toHaveBeenCalledWith(unverifiedUser)
      })
    })

    it('calls onSuccess without requestVerification when user is already verified after signup', async () => {
      const user = userEvent.setup()
      const mockCreateUser = mock(() => Promise.resolve())
      const mockAuth = mock(() => Promise.resolve(verifiedUser))
      const mockRequestVerification = mock(() => Promise.resolve())
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'signup',
        createUser: mockCreateUser,
        authWithPassword: mockAuth,
        requestVerification: mockRequestVerification,
        onSuccess: handleSuccess,
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
        expect(mockRequestVerification).not.toHaveBeenCalled()
        expect(handleSuccess).toHaveBeenCalledWith(verifiedUser)
      })
    })

    it('shows an error message when account creation fails', async () => {
      const user = userEvent.setup()
      const { container } = renderAuthForm({
        mode: 'signup',
        createUser: () => Promise.reject(new Error('Email already in use')),
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
