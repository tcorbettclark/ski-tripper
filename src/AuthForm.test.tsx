import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import AuthForm from './AuthForm'

const verifiedUser: Models.User = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerification: true,
} as Models.User
const unverifiedUser: Models.User = {
  $id: 'user-2',
  name: 'Unverified User',
  email: 'unverified@example.com',
  emailVerification: false,
} as Models.User
const defaultSession: Models.Session = {
  $id: 'session-1',
  userId: 'user-1',
  expire: '2026-01-01T00:00:00.000Z',
} as Models.Session
const noop = () => {}

function renderAuthForm(props = {}) {
  return render(
    <AuthForm
      mode="login"
      onSuccess={noop}
      onSwitchMode={noop}
      createEmailPasswordSession={() => Promise.resolve({} as Models.Session)}
      accountGet={() => Promise.resolve(verifiedUser)}
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

    it('calls createEmailPasswordSession and onSuccess with session and user on submit', async () => {
      const user = userEvent.setup()
      const mockSession = mock(() => Promise.resolve(defaultSession))
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
        expect(handleSuccess).toHaveBeenCalledWith(defaultSession, verifiedUser)
      })
    })

    it('calls onSuccess with unverified user when user is unverified on login', async () => {
      const user = userEvent.setup()
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'login',
        createEmailPasswordSession: () => Promise.resolve(defaultSession),
        accountGet: () => Promise.resolve(unverifiedUser),
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
        expect(handleSuccess).toHaveBeenCalledWith(
          defaultSession,
          unverifiedUser
        )
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

    it('calls createEmailVerification and onSuccess when unverified after signup', async () => {
      const user = userEvent.setup()
      const mockCreate = mock(() => Promise.resolve(unverifiedUser))
      const mockSession = mock(() => Promise.resolve(defaultSession))
      const mockCreateVerification = mock(() => Promise.resolve())
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'signup',
        accountCreate: mockCreate,
        createEmailPasswordSession: mockSession,
        createEmailVerification: mockCreateVerification,
        onSuccess: handleSuccess,
        accountGet: () => Promise.resolve(unverifiedUser),
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
        expect(mockCreateVerification).toHaveBeenCalled()
        expect(handleSuccess).toHaveBeenCalledWith(
          defaultSession,
          unverifiedUser
        )
      })
    })

    it('calls onSuccess without createEmailVerification when user is already verified after signup', async () => {
      const user = userEvent.setup()
      const mockCreate = mock(() => Promise.resolve(verifiedUser))
      const mockSession = mock(() => Promise.resolve(defaultSession))
      const mockCreateVerification = mock(() => Promise.resolve())
      const handleSuccess = mock(() => {})
      const { container } = renderAuthForm({
        mode: 'signup',
        accountCreate: mockCreate,
        createEmailPasswordSession: mockSession,
        createEmailVerification: mockCreateVerification,
        onSuccess: handleSuccess,
        accountGet: () => Promise.resolve(verifiedUser),
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
        expect(mockCreateVerification).not.toHaveBeenCalled()
        expect(handleSuccess).toHaveBeenCalledWith(defaultSession, verifiedUser)
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
