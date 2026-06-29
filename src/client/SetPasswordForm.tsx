import { useState } from 'react'
import {
  reauthenticate as _reauthenticate,
  setUserPassword as _setUserPassword,
} from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, formStyles } from './theme'
import { toast } from './toast'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface SetPasswordFormProps {
  email: string
  onSuccess: () => void
  onSignOut?: () => void
  setUserPassword?: (password: string, passwordConfirm: string) => Promise<void>
  reauthenticate?: (
    email: string,
    password: string
  ) => Promise<Record<string, unknown>>
}

export default function SetPasswordForm({
  email,
  onSuccess,
  onSignOut,
  setUserPassword = _setUserPassword,
  reauthenticate = _reauthenticate,
}: SetPasswordFormProps) {
  const isSmall = useIsSmallScreen()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    try {
      await setUserPassword(password, password)
      await reauthenticate(email, password)
      if (
        typeof PasswordCredential !== 'undefined' &&
        typeof navigator.credentials?.store === 'function'
      ) {
        try {
          const credential = new PasswordCredential({ id: email, password })
          await navigator.credentials.store(credential)
        } catch {
          // browser declined to store — non-critical
        }
      }
      setTimeout(() => onSuccess(), 0)
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
        <h1 style={authStyles.title}>Set your password</h1>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          <Field
            label="Email"
            name="email"
            data-testid="set-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={() => {}}
            readOnly
            variant="auth"
          />
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
          <button
            type="submit"
            data-testid="set-password-submit"
            disabled={loading}
            style={formStyles.primaryButton}
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
          {onSignOut && (
            <p style={authStyles.switchText}>
              <button
                type="button"
                onClick={onSignOut}
                style={authStyles.switchLink}
                data-testid="sign-out"
              >
                Sign out
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
