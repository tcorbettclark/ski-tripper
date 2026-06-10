import { useState } from 'react'
import pb from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, formStyles } from './theme'

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
    pb.collection('users').confirmPasswordReset(t, pw, pwc),
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
      await confirmPasswordReset(token, password, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
