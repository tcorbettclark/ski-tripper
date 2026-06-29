import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OtpCodeEntry from './OtpCodeEntry'
import { getToasts } from './toast'

const noop = () => {}

function renderOtpCodeEntry(props = {}) {
  let result: ReturnType<typeof render>
  act(() => {
    result = render(
      <OtpCodeEntry
        email="alice@example.com"
        otpId="otp-123"
        onSuccess={noop}
        onBack={noop}
        {...props}
      />
    )
  })
  return result!
}

describe('OtpCodeEntry', () => {
  it('shows the Enter verification code heading', () => {
    renderOtpCodeEntry()
    expect(screen.getByRole('heading', { name: /enter verification code/i }))
  })

  it('shows the email address', () => {
    renderOtpCodeEntry()
    expect(screen.getByText('alice@example.com'))
  })

  it('renders the code input field', () => {
    renderOtpCodeEntry()
    expect(screen.getByLabelText(/verification code/i))
  })

  it('calls authWithOtp with otpId and code on submit', async () => {
    const user = userEvent.setup()
    const mockAuthWithOtp = mock(() =>
      Promise.resolve({
        id: 'user-1',
        email: 'alice@example.com',
        verified: true,
      })
    )
    const handleSuccess = mock(() => {})

    renderOtpCodeEntry({
      authWithOtp: mockAuthWithOtp,
      onSuccess: handleSuccess,
    })

    await user.type(screen.getByLabelText(/verification code/i), '12345678')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockAuthWithOtp).toHaveBeenCalledWith('otp-123', '12345678')
      expect(handleSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error when authWithOtp fails', async () => {
    const user = userEvent.setup()
    renderOtpCodeEntry({
      authWithOtp: () => Promise.reject(new Error('Invalid code')),
    })

    await user.type(screen.getByLabelText(/verification code/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'Invalid code' && t.type === 'error'
        )
      ).toBeTruthy()
    })
  })

  it('resends code and updates otpId on resend click', async () => {
    const user = userEvent.setup()
    const mockRequestOtp = mock(() => Promise.resolve({ otpId: 'new-otp-id' }))

    renderOtpCodeEntry({
      requestOtp: mockRequestOtp,
    })

    await user.click(screen.getByTestId('resend-otp'))

    await waitFor(() => {
      expect(mockRequestOtp).toHaveBeenCalledWith('alice@example.com')
      expect(
        getToasts().some(
          (t) =>
            t.message === 'Verification code resent!' && t.type === 'success'
        )
      ).toBeTruthy()
    })
  })

  it('calls onBack when back to sign in is clicked', async () => {
    const user = userEvent.setup()
    const handleBack = mock(() => {})
    renderOtpCodeEntry({ onBack: handleBack })

    await user.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(handleBack).toHaveBeenCalledTimes(1)
  })

  it('disables submit button while verifying', async () => {
    let resolveAuth: ((value: unknown) => void) | undefined
    const user = userEvent.setup()
    renderOtpCodeEntry({
      authWithOtp: () =>
        new Promise((resolve) => {
          resolveAuth = resolve
        }),
    })

    await user.type(screen.getByLabelText(/verification code/i), '12345678')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    expect(
      (
        screen.getByRole('button', {
          name: /verifying/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    await act(async () => {
      resolveAuth?.({ id: 'user-1' })
    })
  })
})
