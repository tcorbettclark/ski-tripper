import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordForm from './ForgotPasswordForm'
import { getToasts } from './toast'

const noop = () => {}

function renderForgotPasswordForm(props = {}) {
  let result: ReturnType<typeof render>
  act(() => {
    result = render(
      <ForgotPasswordForm
        onBackToLogin={noop}
        onOtpRequested={noop}
        {...props}
      />
    )
  })
  return result!
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

  it('calls requestOtp and onOtpRequested with email on submit', async () => {
    const user = userEvent.setup()
    const mockRequestOtp = mock(() => Promise.resolve({ otpId: 'otp-xyz' }))
    const handleOtpRequested = mock(() => {})
    renderForgotPasswordForm({
      requestOtp: mockRequestOtp,
      onOtpRequested: handleOtpRequested,
    })

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(
      screen.getByRole('button', { name: /send verification code/i })
    )

    await waitFor(() => {
      expect(mockRequestOtp).toHaveBeenCalledWith('alice@example.com')
      expect(handleOtpRequested).toHaveBeenCalledWith(
        'otp-xyz',
        'alice@example.com'
      )
    })
  })

  it('shows error when requestOtp fails', async () => {
    const user = userEvent.setup()
    renderForgotPasswordForm({
      requestOtp: () => Promise.reject(new Error('User not found')),
    })

    await user.type(screen.getByLabelText(/email/i), 'unknown@example.com')
    await user.click(
      screen.getByRole('button', { name: /send verification code/i })
    )

    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'User not found' && t.type === 'error'
        )
      ).toBeTruthy()
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
    let resolveOtp: ((value: unknown) => void) | undefined
    const user = userEvent.setup()
    renderForgotPasswordForm({
      requestOtp: () =>
        new Promise((resolve) => {
          resolveOtp = resolve
        }),
    })

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(
      screen.getByRole('button', { name: /send verification code/i })
    )

    expect(
      (
        screen.getByRole('button', {
          name: /sending/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    await act(async () => {
      resolveOtp?.({ otpId: 'test' })
    })
  })
})
