import { useState } from 'react'
import { getPb } from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, formStyles } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface SetPasswordFormProps {
  userId: string
  onSuccess: () => void
  updatePassword?: (
    userId: string,
    password: string,
    passwordConfirm: string
  ) => Promise<unknown>
  title?: string
  submitLabel?: string
}

export default function SetPasswordForm({
  userId,
  onSuccess,
  updatePassword = (id, pw, pwc) =>
    getPb().collection('users').update(id, {
      password: pw,
      passwordConfirm: pwc,
    }),
  title = 'Set your password',
  submitLabel = 'Set password',
}: SetPasswordFormProps) {
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
      await updatePassword(userId, password, password)
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
        <h1 style={authStyles.title}>{title}</h1>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          <Field
            label="Password"
            name="password"
            data-testid="set-password"
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
            data-testid="set-confirm-password"
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
            data-testid="set-password-submit"
            disabled={loading}
            style={formStyles.primaryButton}
          >
            {loading ? 'Saving…' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
