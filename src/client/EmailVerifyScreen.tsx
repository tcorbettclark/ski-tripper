import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { authStyles, colors, fontSizes, formStyles } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface EmailVerifyScreenProps {
  email: string
  onBackToLogin: () => void
  requestVerification: (email: string) => Promise<unknown>
}

export default function EmailVerifyScreen({
  email,
  onBackToLogin,
  requestVerification,
}: EmailVerifyScreenProps) {
  const isSmall = useIsSmallScreen()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleResend() {
    setError('')
    setLoading(true)
    try {
      await requestVerification(email)
      setResent(true)
    } catch (err) {
      setError(getErrorMessage(err))
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
        <h1 style={authStyles.title}>Verify your email</h1>
        <p style={verifyStyles.message}>We sent a verification link to</p>
        <p style={verifyStyles.email}>{email}</p>
        <p style={verifyStyles.followUp}>
          Check your inbox and click the link to activate your account.
        </p>
        {error && <p style={formStyles.error}>{error}</p>}
        {resent && (
          <p style={verifyStyles.resent}>Verification email resent!</p>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={handleResend}
          style={{
            ...formStyles.primaryButton,
            opacity: loading ? 0.6 : 1,
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'block',
          }}
        >
          {loading ? 'Sending…' : 'Resend verification email'}
        </button>
        <p style={authStyles.switchText}>
          <button
            type="button"
            onClick={onBackToLogin}
            style={authStyles.switchLink}
          >
            Back to sign-in
          </button>
        </p>
      </div>
    </div>
  )
}

const verifyStyles = {
  email: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: fontSizes.md,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center' as const,
    margin: '8px 0',
  } as const,
  message: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0',
  } as const,
  followUp: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  } as const,
  resent: {
    color: colors.accent,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: fontSizes.sm,
    margin: '0 0 12px 0',
  } as const,
}
