import { useState } from 'react'
import type { User } from '../shared/types.d'
import pb from './backend'
import Field from './Field'
import { BrandTitle } from './Icons'
import InfoBanner from './InfoBanner'
import ThemeToggle from './ThemeToggle'
import { authStyles, fontSizes, formStyles } from './theme'

interface AuthFormProps {
  mode?: 'login' | 'signup'
  onSuccess: (user: User) => void
  onSwitchMode: () => void
  onForgotPassword?: () => void
  createUser?: (
    email: string,
    password: string,
    name: string
  ) => Promise<unknown>
  authWithPassword?: (email: string, password: string) => Promise<User>
  requestVerification?: (email: string) => Promise<unknown>
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
  onSwitchMode,
  onForgotPassword,
  createUser = (email, password, name) =>
    pb.collection('users').create({ email, password, name }),
  authWithPassword = async (email, password) => {
    await pb.collection('users').authWithPassword(email, password)
    return mapUser(pb.authStore.record as unknown as Record<string, unknown>)
  },
  requestVerification = (email) =>
    pb.collection('users').requestVerification(email),
  sessionExpiredMessage = null,
}: AuthFormProps) {
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
        await createUser(email, password, name)
        const user = await authWithPassword(email, password)
        try {
          if (navigator.credentials?.store) {
            const credential = new PasswordCredential({
              id: email,
              name,
              password,
            })
            await navigator.credentials.store(credential)
          }
        } catch {
          // Credential Management API not supported or blocked
        }
        if (!user.emailVerification) {
          await requestVerification(email)
        }
        onSuccess(user)
        window.location.reload()
      } else {
        const user = await authWithPassword(email, password)
        onSuccess(user)
      }
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
        <BrandTitle fontSize="24px" />
      </p>
      <div style={authStyles.card}>
        {sessionExpiredMessage && (
          <p style={formStyles.error}>{sessionExpiredMessage}</p>
        )}
        <h1 style={authStyles.title}>
          {isSignup ? 'Create Account' : 'Sign In'}
        </h1>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          {isSignup && (
            <Field
              label="Name"
              name="name"
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
            type="email"
            autoComplete={isSignup ? 'email' : 'username'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            variant="auth"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={isSignup}
            minLength={isSignup ? 8 : undefined}
            placeholder="••••••••"
            variant="auth"
          />
          {!isSignup && onForgotPassword && (
            <div style={{ textAlign: 'right', marginTop: '-12px' }}>
              <button
                type="button"
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
