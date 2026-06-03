import { ID, type Models } from 'appwrite'
import { useState } from 'react'
import { account as _account } from './backend'
import Field from './Field'
import { BrandTitle } from './Icons'
import InfoBanner from './InfoBanner'
import SnowflakeParticles from './SnowflakeParticles'
import { authStyles, formStyles } from './theme'

interface AuthFormProps {
  mode?: 'login' | 'signup'
  onSuccess: (session: Models.Session, user: Models.User) => void
  onSwitchMode: () => void
  onForgotPassword?: () => void
  accountCreate?: (
    id: string,
    email: string,
    password: string,
    name: string
  ) => Promise<Models.User>
  createEmailPasswordSession?: (
    email: string,
    password: string
  ) => Promise<Models.Session>
  createEmailVerification?: (url: string) => Promise<unknown>
  accountGet?: () => Promise<Models.User>
  generateId?: () => string
  sessionExpiredMessage?: string | null
}

export default function AuthForm({
  mode = 'login',
  onSuccess,
  onSwitchMode,
  onForgotPassword,
  accountCreate = (id, email, password, name) =>
    _account.create(id, email, password, name),
  createEmailPasswordSession = (email, password) =>
    _account.createEmailPasswordSession(email, password),
  createEmailVerification = (url) => _account.createVerification(url),
  accountGet = () => _account.get(),
  generateId = () => ID.unique(),
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
        await accountCreate(generateId(), email, password, name)
        const session = await createEmailPasswordSession(email, password)
        const user = await accountGet()
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
          const baseUrl = window.location.origin
          await createEmailVerification(`${baseUrl}/verify`)
        }
        onSuccess(session, user)
        window.location.reload()
      } else {
        const session = await createEmailPasswordSession(email, password)
        const user = await accountGet()
        onSuccess(session, user)
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
      <SnowflakeParticles />
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
                style={{ ...authStyles.switchLink, fontSize: '12px' }}
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
