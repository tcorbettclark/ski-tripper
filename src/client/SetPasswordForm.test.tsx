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

describe('SetPasswordForm', () => {
  it('shows the Set your password heading', () => {
    renderSetPasswordForm()
    expect(screen.getByRole('heading', { name: /set your password/i }))
  })

  it('renders password and confirm password fields', () => {
    renderSetPasswordForm()
    expect(screen.getByTestId('set-password'))
    expect(screen.getByTestId('set-confirm-password'))
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
