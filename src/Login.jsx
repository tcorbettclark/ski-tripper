import { useState } from 'react'
import { account } from './appwrite'

export default function Login ({ onLogin, onSwitchToSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit (e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await account.createEmailPasswordSession(email, password)
      const user = await account.get()
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
    background: 'linear-gradient(160deg, #091522 0%, #0f2236 35%, #152a42 65%, #0b1929 100%)',
    padding: '24px'
  },
  card: {
    background: '#122033',
    borderRadius: '16px',
    padding: '48px 44px',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(253,54,110,0.04)'
  },
  eyebrow: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '500',
    letterSpacing: '0.14em',
    color: '#fd366e',
    textTransform: 'uppercase',
    marginBottom: '14px'
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    marginBottom: '32px',
    fontSize: '38px',
    fontWeight: '600',
    color: '#e8f2f8',
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
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '500',
    color: '#7a9ab5',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#0b1929',
    color: '#e8f2f8',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '15px',
    outline: 'none'
  },
  error: {
    color: '#ff6b6b',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: '0'
  },
  button: {
    marginTop: '4px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: '#fd366e',
    color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  switchText: {
    marginTop: '28px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#7a9ab5',
    textAlign: 'center'
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#fd366e',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0'
  }
}
