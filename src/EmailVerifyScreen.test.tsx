import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailVerifyScreen from './EmailVerifyScreen'

const noop = () => {}

function renderEmailVerifyScreen(props = {}) {
  return render(
    <EmailVerifyScreen
      email="test@example.com"
      onBackToLogin={noop}
      {...props}
    />
  )
}

describe('EmailVerifyScreen', () => {
  it('shows verify your email heading', () => {
    renderEmailVerifyScreen()
    expect(screen.getByRole('heading', { name: /verify your email/i }))
  })

  it('displays the email address', () => {
    renderEmailVerifyScreen()
    expect(screen.getByText(/test@example\.com/))
  })

  it('has a resend verification email button', () => {
    renderEmailVerifyScreen()
    expect(screen.getByRole('button', { name: /resend verification email/i }))
  })

  it('calls createEmailVerification when resend is clicked', async () => {
    const user = userEvent.setup()
    const mockCreateVerification = mock(() => Promise.resolve())
    renderEmailVerifyScreen({
      createEmailVerification: mockCreateVerification,
    })

    await user.click(
      screen.getByRole('button', { name: /resend verification email/i })
    )

    await waitFor(() => {
      expect(mockCreateVerification).toHaveBeenCalled()
    })
  })

  it('shows success message after resending', async () => {
    const user = userEvent.setup()
    renderEmailVerifyScreen({
      createEmailVerification: () => Promise.resolve(),
    })

    await user.click(
      screen.getByRole('button', { name: /resend verification email/i })
    )

    await waitFor(() => {
      expect(screen.getByText(/verification email resent/i))
    })
  })

  it('shows error when resend fails', async () => {
    const user = userEvent.setup()
    renderEmailVerifyScreen({
      createEmailVerification: () => Promise.reject(new Error('Rate limited')),
    })

    await user.click(
      screen.getByRole('button', { name: /resend verification email/i })
    )

    await waitFor(() => {
      expect(screen.getByText('Rate limited'))
    })
  })

  it('calls onBackToLogin when back to sign in is clicked', async () => {
    const user = userEvent.setup()
    const handleBack = mock(() => {})
    renderEmailVerifyScreen({ onBackToLogin: handleBack })

    await user.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(handleBack).toHaveBeenCalledTimes(1)
  })
})
