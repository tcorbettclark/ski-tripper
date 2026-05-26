import { useState } from 'react'
import { account as _account } from './backend'
import { authStyles, formStyles } from './theme'

interface EmailVerifyScreenProps {
  email: string
  onBackToLogin: () => void
  createEmailVerification?: (url: string) => Promise<unknown>
}

export default function EmailVerifyScreen({
  email,
  onBackToLogin,
  createEmailVerification = (url) => _account.createVerification(url),
}: EmailVerifyScreenProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleResend() {
    setError('')
    setLoading(true)
    try {
      const baseUrl = window.location.origin
      await createEmailVerification(`${baseUrl}/verify`)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...authStyles.container, flexDirection: 'column' }}>
      <div style={authStyles.card}>
        <p style={authStyles.eyebrow}>⛷ Ski Tripper</p>
        <h1 style={authStyles.title}>Verify your email</h1>
        <p style={verifyStyles.message}>
          We sent a verification link to <strong>{email}</strong>. Check your
          inbox and click the link to activate your account.
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
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}

const verifyStyles = {
  message: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    color: '#6a94ae',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  } as const,
  resent: {
    color: '#3bbde8',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: '0 0 12px 0',
  } as const,
}
