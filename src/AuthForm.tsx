import { useState } from 'react'
import { ID, type Models } from 'appwrite'
import { account as _account } from './backend'
import Field from './Field'
import { authStyles, formStyles } from './theme'

interface AuthFormProps {
  mode?: 'login' | 'signup'
  onSuccess: (user: Models.User) => void
  onSwitchMode: () => void
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
  accountGet?: () => Promise<Models.User>
  generateId?: () => string
}

export default function AuthForm({
  mode = 'login',
  onSuccess,
  onSwitchMode,
  accountCreate = (id, email, password, name) =>
    _account.create(id, email, password, name),
  createEmailPasswordSession = (email, password) =>
    _account.createEmailPasswordSession(email, password),
  accountGet = () => _account.get(),
  generateId = () => ID.unique(),
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
      }
      await createEmailPasswordSession(email, password)
      const user = await accountGet()
      onSuccess(user)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...authStyles.container, flexDirection: 'column' }}>
      <div style={bannerStyles}>Work in progress - not live!</div>
      <div style={authStyles.card}>
        <p style={authStyles.eyebrow}>⛷ Ski Tripper</p>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={isSignup}
            minLength={isSignup ? 8 : undefined}
            placeholder="••••••••"
            variant="auth"
          />
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
    </div>
  )
}

const bannerStyles = {
  background: '#f59e0b',
  color: '#1a1a1a',
  fontWeight: '700',
  fontSize: '14px',
  textAlign: 'center',
  padding: '12px 24px',
  borderRadius: '12px',
  marginBottom: '20px',
  maxWidth: '420px',
  width: '100%',
} as const
