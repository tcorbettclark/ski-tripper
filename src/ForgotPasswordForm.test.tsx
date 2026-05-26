import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordForm from './ForgotPasswordForm'

const noop = () => {}

function renderForgotPasswordForm(props = {}) {
  return render(<ForgotPasswordForm onBackToLogin={noop} {...props} />)
}

describe('ForgotPasswordForm', () => {
  it('shows the Reset password heading', () => {
    renderForgotPasswordForm()
    expect(screen.getByRole('heading', { name: /reset password/i }))
  })

  it('renders email field', () => {
    renderForgotPasswordForm()
    expect(screen.getByLabelText(/email/i))
  })

  it('calls createRecovery with email and URL on submit', async () => {
    const user = userEvent.setup()
    const mockCreateRecovery = mock(() => Promise.resolve())
    renderForgotPasswordForm({
      createRecovery: mockCreateRecovery,
    })

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(mockCreateRecovery).toHaveBeenCalledWith(
        'alice@example.com',
        expect.stringContaining('/reset-password')
      )
    })
  })

  it('shows success message after sending reset link', async () => {
    const user = userEvent.setup()
    renderForgotPasswordForm({
      createRecovery: () => Promise.resolve(),
    })

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/sent a password reset link/i))
      expect(screen.getByText('alice@example.com'))
    })
  })

  it('shows back to sign in button after sending reset link', async () => {
    const user = userEvent.setup()
    const handleBack = mock(() => {})
    renderForgotPasswordForm({
      createRecovery: () => Promise.resolve(),
      onBackToLogin: handleBack,
    })

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to sign in/i }))
    })

    await user.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(handleBack).toHaveBeenCalledTimes(1)
  })

  it('shows error when createRecovery fails', async () => {
    const user = userEvent.setup()
    renderForgotPasswordForm({
      createRecovery: () => Promise.reject(new Error('User not found')),
    })

    await user.type(screen.getByLabelText(/email/i), 'unknown@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('User not found'))
    })
  })

  it('calls onBackToLogin when back to sign in is clicked', async () => {
    const user = userEvent.setup()
    const handleBack = mock(() => {})
    renderForgotPasswordForm({ onBackToLogin: handleBack })

    await user.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(handleBack).toHaveBeenCalledTimes(1)
  })

  it('disables submit button while sending', async () => {
    let resolveRecovery: ((value: unknown) => void) | undefined
    const user = userEvent.setup()
    renderForgotPasswordForm({
      createRecovery: () =>
        new Promise((resolve) => {
          resolveRecovery = resolve
        }),
    })

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(
      (
        screen.getByRole('button', {
          name: /sending/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    resolveRecovery?.(undefined)
  })
})
