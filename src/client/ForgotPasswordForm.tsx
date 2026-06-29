import { useState } from 'react'
import { getPb } from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, colors, fontSizes, fonts, formStyles } from './theme'
import { toast } from './toast'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
  onOtpRequested: (otpId: string, email: string) => void
  requestOtp?: (email: string) => Promise<{ otpId: string }>
}

export default function ForgotPasswordForm({
  onBackToLogin,
  onOtpRequested,
  requestOtp = (email) =>
    getPb().collection('users').requestOTP(email) as Promise<{ otpId: string }>,
}: ForgotPasswordFormProps) {
  const isSmall = useIsSmallScreen()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await requestOtp(email)
      onOtpRequested(result.otpId, email)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        ...authStyles.container,
        flexDirection: 'column',
        position: 'relative',
        padding: isSmall ? '16px' : '24px',
      }}
    >
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 2 }}>
        <ThemeToggle />
      </div>
      <div
        style={{
          ...authStyles.card,
          padding: isSmall ? '28px 20px' : '48px 44px',
        }}
      >
        <h1 style={authStyles.title}>Reset password</h1>
        <p style={forgotStyles.message}>
          Enter your email and we&apos;ll send you a verification code to reset
          your password.
        </p>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          <Field
            label="Email"
            name="email"
            data-testid="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            variant="auth"
          />
          <button
            type="submit"
            data-testid="send-otp"
            disabled={loading}
            style={formStyles.primaryButton}
          >
            {loading ? 'Sending…' : 'Send verification code'}
          </button>
        </form>
        <p style={authStyles.switchText}>
          <button
            type="button"
            onClick={onBackToLogin}
            style={authStyles.switchLink}
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}

const forgotStyles = {
  message: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  },
}
