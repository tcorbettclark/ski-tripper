import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordForm from './ResetPasswordForm'

const noop = () => {}

function renderResetPasswordForm(props = {}) {
  return render(
    <ResetPasswordForm token="test-token-123" onSuccess={noop} {...props} />
  )
}

describe('ResetPasswordForm', () => {
  it('shows the Set new password heading', () => {
    renderResetPasswordForm()
    expect(screen.getByRole('heading', { name: /set new password/i }))
  })

  it('renders new password and confirm password fields', () => {
    renderResetPasswordForm()
    expect(screen.getByLabelText(/new password/i))
    expect(screen.getByLabelText(/confirm password/i))
  })

  it('calls confirmPasswordReset with token and password on submit', async () => {
    const user = userEvent.setup()
    const mockConfirmPasswordReset = mock(() => Promise.resolve())
    const handleSuccess = mock(() => {})
    renderResetPasswordForm({
      confirmPasswordReset: mockConfirmPasswordReset,
      onSuccess: handleSuccess,
    })

    await user.type(screen.getByLabelText(/new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
        'test-token-123',
        'newpass123',
        'newpass123'
      )
      expect(handleSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderResetPasswordForm()

    await user.type(screen.getByLabelText(/new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different456')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(screen.getByText(/passwords do not match/i))
  })

  it('shows error when confirmPasswordReset fails', async () => {
    const user = userEvent.setup()
    renderResetPasswordForm({
      confirmPasswordReset: () =>
        Promise.reject(new Error('Recovery link expired')),
    })

    await user.type(screen.getByLabelText(/new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Recovery link expired'))
    })
  })

  it('disables submit button while saving', async () => {
    const user = userEvent.setup()
    renderResetPasswordForm({
      confirmPasswordReset: () => new Promise(() => {}),
    })

    await user.type(screen.getByLabelText(/new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(
      (
        screen.getByRole('button', {
          name: /saving/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
