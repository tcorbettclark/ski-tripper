import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetPasswordForm from './SetPasswordForm'

const noop = () => {}

function renderSetPasswordForm(props = {}) {
  return render(
    <SetPasswordForm email="test@example.com" onSuccess={noop} {...props} />
  )
}

function installCredentialApi() {
  const store = mock(() => Promise.resolve())
  const originalCredentials = navigator.credentials
  const originalPasswordCredential = (globalThis as Record<string, unknown>)
    .PasswordCredential
  Object.defineProperty(navigator, 'credentials', {
    value: { store },
    configurable: true,
  })
  ;(globalThis as Record<string, unknown>).PasswordCredential =
    class PasswordCredential {
      id: string
      password: string
      constructor({ id, password }: { id: string; password: string }) {
        this.id = id
        this.password = password
      }
    }
  return {
    store,
    restore: () => {
      if (originalCredentials === undefined) {
        Object.defineProperty(navigator, 'credentials', {
          value: undefined,
          configurable: true,
        })
      } else {
        Object.defineProperty(navigator, 'credentials', {
          value: originalCredentials,
          configurable: true,
        })
      }
      if (originalPasswordCredential === undefined) {
        delete (globalThis as Record<string, unknown>).PasswordCredential
      } else {
        ;(globalThis as Record<string, unknown>).PasswordCredential =
          originalPasswordCredential
      }
    },
  }
}

describe('SetPasswordForm', () => {
  it('shows the Set your password heading', () => {
    renderSetPasswordForm()
    expect(screen.getByRole('heading', { name: /set your password/i }))
  })

  it('renders password and confirm password fields', () => {
    renderSetPasswordForm()
    expect(screen.getByTestId('set-email'))
    expect(screen.getByTestId('set-password'))
    expect(screen.getByTestId('set-confirm-password'))
  })

  it('shows the email as a read-only field', () => {
    renderSetPasswordForm()
    const emailInput = screen.getByTestId('set-email') as HTMLInputElement
    expect(emailInput.value).toBe('test@example.com')
    expect(emailInput.readOnly).toBe(true)
  })

  it('calls setUserPassword and reauthenticate with password on submit', async () => {
    const user = userEvent.setup()
    const mockSetUserPassword = mock(() => Promise.resolve())
    const mockReauthenticate = mock(() =>
      Promise.resolve({ id: 'user-1', email: 'test@example.com' })
    )
    const handleSuccess = mock(() => {})
    renderSetPasswordForm({
      setUserPassword: mockSetUserPassword,
      reauthenticate: mockReauthenticate,
      onSuccess: handleSuccess,
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(mockSetUserPassword).toHaveBeenCalledWith(
        'newpass123',
        'newpass123'
      )
      expect(mockReauthenticate).toHaveBeenCalledWith(
        'test@example.com',
        'newpass123'
      )
      expect(handleSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('calls reauthenticate with the provided email', async () => {
    const user = userEvent.setup()
    const mockSetUserPassword = mock(() => Promise.resolve())
    const mockReauthenticate = mock(() => Promise.resolve({ id: 'user-1' }))
    renderSetPasswordForm({
      email: 'other@example.com',
      setUserPassword: mockSetUserPassword,
      reauthenticate: mockReauthenticate,
      onSuccess: noop,
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(mockReauthenticate).toHaveBeenCalledWith(
        'other@example.com',
        'newpass123'
      )
    })
  })

  it('stores credentials via Credential Management API when available', async () => {
    const { store, restore } = installCredentialApi()
    const user = userEvent.setup()
    const handleSuccess = mock(() => {})
    renderSetPasswordForm({
      setUserPassword: () => Promise.resolve(),
      reauthenticate: () => Promise.resolve({ id: 'user-1' }),
      onSuccess: handleSuccess,
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(store).toHaveBeenCalledTimes(1)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = store.mock.calls[0] as any[]
    expect(callArgs[0].id).toBe('test@example.com')
    expect(callArgs[0].password).toBe('newpass123')
    restore()
  })

  it('still calls onSuccess when credential store fails', async () => {
    const { restore } = installCredentialApi()
    const user = userEvent.setup()
    const handleSuccess = mock(() => {})
    renderSetPasswordForm({
      setUserPassword: () => Promise.resolve(),
      reauthenticate: () => Promise.resolve({ id: 'user-1' }),
      onSuccess: handleSuccess,
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1)
    })
    restore()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderSetPasswordForm()

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'different456')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    expect(screen.getByText(/passwords do not match/i))
  })

  it('shows error when setUserPassword fails', async () => {
    const user = userEvent.setup()
    renderSetPasswordForm({
      setUserPassword: () => Promise.reject(new Error('Password too short')),
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(screen.getByText('Password too short'))
    })
  })

  it('shows error when reauthenticate fails', async () => {
    const user = userEvent.setup()
    renderSetPasswordForm({
      setUserPassword: () => Promise.resolve(),
      reauthenticate: () =>
        Promise.reject(new Error('Re-authentication failed')),
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(screen.getByText('Re-authentication failed'))
    })
  })

  it('does not call onSuccess when reauthenticate fails', async () => {
    const user = userEvent.setup()
    const handleSuccess = mock(() => {})
    renderSetPasswordForm({
      setUserPassword: () => Promise.resolve(),
      reauthenticate: () =>
        Promise.reject(new Error('Re-authentication failed')),
      onSuccess: handleSuccess,
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(screen.getByText('Re-authentication failed'))
    })
    expect(handleSuccess).not.toHaveBeenCalled()
  })

  it('disables submit button while saving', async () => {
    const user = userEvent.setup()
    renderSetPasswordForm({
      setUserPassword: () => new Promise(() => {}),
    })

    await user.type(screen.getByTestId('set-password'), 'newpass123')
    await user.type(screen.getByTestId('set-confirm-password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    expect(
      (
        screen.getByRole('button', {
          name: /saving/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
