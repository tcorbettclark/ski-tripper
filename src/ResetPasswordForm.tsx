import { useState } from 'react'
import { account as _account } from './backend'
import Field from './Field'
import { authStyles, formStyles } from './theme'

interface ResetPasswordFormProps {
  userId: string
  secret: string
  onSuccess: () => void
  updateRecovery?: (
    userId: string,
    secret: string,
    password: string
  ) => Promise<unknown>
}

export default function ResetPasswordForm({
  userId,
  secret,
  onSuccess,
  updateRecovery = (uid, s, pw) => _account.updateRecovery(uid, s, pw),
}: ResetPasswordFormProps) {
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
      await updateRecovery(userId, secret, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...authStyles.container, flexDirection: 'column' }}>
      <div style={authStyles.card}>
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

const resetStyles = {
  message: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    color: '#6a94ae',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  } as const,
}
