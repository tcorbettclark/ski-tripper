import { useState } from 'react'
import { account as _account } from './appwrite'
import { colors, fonts, borders } from './theme'

export default function Login ({
  onLogin,
  onSwitchToSignup,
  createEmailPasswordSession = (email, password) => _account.createEmailPasswordSession(email, password),
  accountGet = () => _account.get()
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit (e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createEmailPasswordSession(email, password)
      const user = await accountGet()
      onLogin(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>⛷ Ski Tripper</p>
        <h1 style={styles.title}>Sign In</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder='you@example.com'
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder='••••••••'
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type='submit' disabled={loading} style={styles.button}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={styles.switchText}>
          Don't have an account?{' '}
          <button onClick={onSwitchToSignup} style={styles.switchLink}>
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #040c18 0%, #081626 35%, #0c1e32 65%, #07111f 100%)',
    padding: '24px'
  },
  card: {
    background: colors.bgCard,
    borderRadius: '16px',
    padding: '48px 44px',
    width: '100%',
    maxWidth: '420px',
    border: borders.card,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,189,232,0.04)'
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    letterSpacing: '0.14em',
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: '14px'
  },
  title: {
    fontFamily: fonts.display,
    marginBottom: '32px',
    fontSize: '38px',
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: '1.1'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textAlign: 'left'
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '15px',
    outline: 'none'
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
    margin: '0'
  },
  button: {
    marginTop: '4px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  switchText: {
    marginTop: '28px',
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    textAlign: 'center'
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: colors.accent,
    fontFamily: fonts.body,
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0'
  }
}
