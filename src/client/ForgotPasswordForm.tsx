import { useState } from 'react'
import { getPb } from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, colors, fontSizes, formStyles } from './theme'
import { getErrorMessage } from './utils'

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
  requestPasswordReset?: (email: string) => Promise<unknown>
}

export default function ForgotPasswordForm({
  onBackToLogin,
  requestPasswordReset = (email) =>
    getPb().collection('users').requestPasswordReset(email),
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
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
      }}
    >
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 2 }}>
        <ThemeToggle />
      </div>
      <div style={authStyles.card}>
        <h1 style={authStyles.title}>Reset password</h1>
        {sent ? (
          <>
            <p style={forgotStyles.message}>We sent a password reset link to</p>
            <p style={forgotStyles.email}>{email}</p>
            <p style={forgotStyles.message}>
              Check your inbox and follow the link to set a new password.
            </p>
            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                ...formStyles.primaryButton,
                opacity: 1,
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'block',
              }}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p style={forgotStyles.message}>
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </p>
            <form onSubmit={handleSubmit} style={authStyles.form}>
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                variant="auth"
              />
              {error && <p style={formStyles.error}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={formStyles.primaryButton}
              >
                {loading ? 'Sending…' : 'Send reset link'}
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
          </>
        )}
      </div>
    </div>
  )
}

const forgotStyles = {
  message: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0 0 8px 0',
  } as const,
  email: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    fontWeight: '600',
    margin: '0 0 8px 0',
  } as const,
}
