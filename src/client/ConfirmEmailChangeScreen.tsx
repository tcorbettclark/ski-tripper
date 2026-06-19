import { useState } from 'react'
import { getPb } from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, formStyles } from './theme'
import { getErrorMessage } from './utils'

interface ConfirmEmailChangeScreenProps {
  token: string
  onSuccess: () => void
  onBackToLogin: () => void
  confirmEmailChange?: (token: string, password: string) => Promise<unknown>
}

export default function ConfirmEmailChangeScreen({
  token,
  onSuccess,
  onBackToLogin,
  confirmEmailChange = (t, pw) =>
    getPb().collection('users').confirmEmailChange(t, pw),
}: ConfirmEmailChangeScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmEmailChange(token, password)
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
      }}
    >
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 2 }}>
        <ThemeToggle />
      </div>
      <div style={authStyles.card}>
        <h1 style={authStyles.title}>Confirm email change</h1>
        <p style={authStyles.switchText}>
          Enter your password to confirm your new email address.
        </p>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Confirming…' : 'Confirm email change'}
          </button>
        </form>
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
