import { useState } from 'react'
import type { User } from '../shared/types.d'
import { getPb } from './backend'
import Field from './Field'
import { BrandTitle } from './Icons'
import InfoBanner from './InfoBanner'
import ThemeToggle from './ThemeToggle'
import { authStyles, fontSizes, formStyles } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage, randomPassword } from './utils'

interface AuthFormProps {
  mode?: 'login' | 'signup'
  onSuccess: (user: User) => void
  onOtpRequested: (otpId: string, email: string) => void
  onSwitchMode: () => void
  onForgotPassword?: () => void
  createUser?: (
    email: string,
    password: string,
    name: string
  ) => Promise<unknown>
  authWithPassword?: (email: string, password: string) => Promise<User>
  requestOtp?: (email: string) => Promise<{ otpId: string }>
  sessionExpiredMessage?: string | null
}

function mapUser(record: Record<string, unknown>): User {
  return {
    id: record.id as string,
    name: (record.name as string) || '',
    email: record.email as string,
    emailVerification: record.verified as boolean,
  }
}

export default function AuthForm({
  mode = 'login',
  onSuccess,
  onOtpRequested,
  onSwitchMode,
  onForgotPassword,
  createUser = (email, password, name) =>
    getPb()
      .collection('users')
      .create({ email, password, passwordConfirm: password, name }),
  authWithPassword = async (email, password) => {
    await getPb().collection('users').authWithPassword(email, password)
    return mapUser(
      getPb().authStore.record as unknown as Record<string, unknown>
    )
  },
  requestOtp = (email) =>
    getPb().collection('users').requestOTP(email) as Promise<{ otpId: string }>,
  sessionExpiredMessage = null,
}: AuthFormProps) {
  const isSmall = useIsSmallScreen()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignup) {
        const generatedPassword = randomPassword()
        await createUser(email, generatedPassword, name)
        const result = await requestOtp(email)
        onOtpRequested(result.otpId, email)
      } else {
        const user = await authWithPassword(email, password)
        onSuccess(user)
      }
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
      <p
        style={{
          ...authStyles.brandName,
          marginBottom: '14px',
          textAlign: 'center',
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <BrandTitle fontSize={isSmall ? '18px' : '24px'} />
      </p>
      <div
        style={{
          ...authStyles.card,
          padding: isSmall ? '28px 20px' : '48px 44px',
        }}
      >
        {sessionExpiredMessage && (
          <p style={formStyles.error}>{sessionExpiredMessage}</p>
        )}
        <h2 style={authStyles.title}>
          {isSignup ? 'Create Account' : 'Sign In'}
        </h2>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          {isSignup && (
            <Field
              label="Name"
              name="name"
              data-testid="auth-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Smith"
              variant="auth"
            />
          )}
          <Field
            label="Email"
            name="email"
            data-testid="auth-email"
            type="email"
            autoComplete={isSignup ? 'email' : 'username'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            variant="auth"
          />
          {!isSignup && (
            <Field
              label="Password"
              name="password"
              data-testid="auth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              variant="auth"
            />
          )}
          {!isSignup && onForgotPassword && (
            <div style={{ textAlign: 'right', marginTop: '-12px' }}>
              <button
                type="button"
                data-testid="auth-forgot-password"
                onClick={onForgotPassword}
                style={{ ...authStyles.switchLink, fontSize: fontSizes.sm }}
              >
                Forgot password?
              </button>
            </div>
          )}
          {error && <p style={formStyles.error}>{error}</p>}
          <button
            type="submit"
            data-testid="auth-submit"
            disabled={loading}
            style={formStyles.primaryButton}
          >
            {loading
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Sign Up'
                : 'Sign In'}
          </button>
        </form>
        <p style={authStyles.switchText}>
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            data-testid="auth-switch-mode"
            onClick={onSwitchMode}
            style={authStyles.switchLink}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
      <InfoBanner />
    </div>
  )
}
