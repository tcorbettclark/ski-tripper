import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetPasswordForm from './SetPasswordForm'

const noop = () => {}

function renderSetPasswordForm(props = {}) {
  return render(<SetPasswordForm onSuccess={noop} {...props} />)
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

  it('calls setUserPassword with password on submit', async () => {
    const user = userEvent.setup()
    const mockSetUserPassword = mock(() => Promise.resolve())
    const handleSuccess = mock(() => {})
    renderSetPasswordForm({
      setUserPassword: mockSetUserPassword,
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
      expect(handleSuccess).toHaveBeenCalledTimes(1)
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
