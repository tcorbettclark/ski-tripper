import { useState } from 'react'
import { getPb } from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, formStyles } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface ResetPasswordFormProps {
  token: string
  onSuccess: () => void
  confirmPasswordReset?: (
    token: string,
    password: string,
    passwordConfirm: string
  ) => Promise<unknown>
}

export default function ResetPasswordForm({
  token,
  onSuccess,
  confirmPasswordReset = (t, pw, pwc) =>
    getPb().collection('users').confirmPasswordReset(t, pw, pwc),
}: ResetPasswordFormProps) {
  const isSmall = useIsSmallScreen()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setError('')
    setLoading(true)
    try {
      await confirmPasswordReset(token, password, password)
      onSuccess()
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
        <h1 style={authStyles.title}>Set new password</h1>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          <Field
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            variant="auth"
          />
          <Field
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            variant="auth"
          />
          {error && <p style={formStyles.error}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={formStyles.primaryButton}
          >
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}
