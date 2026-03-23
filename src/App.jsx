import { useEffect, useState } from 'react'
import { account } from './appwrite'
import Login from './Login'
import Signup from './Signup'
import Trips from './Trips'

function App () {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('login')

  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  async function handleLogout () {
    await account.deleteSession('current')
    setUser(null)
  }

  if (checking) return null

  if (!user) {
    if (page === 'signup') {
      return (
        <Signup onSignup={setUser} onSwitchToLogin={() => setPage('login')} />
      )
    }
    return (
      <Login onLogin={setUser} onSwitchToSignup={() => setPage('signup')} />
    )
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#07111f', minHeight: '100vh' }}>
      <header style={headerStyles.bar}>
        <span style={headerStyles.wordmark}>⛷ Ski Tripper</span>
        <div style={headerStyles.userGroup}>
          <span style={headerStyles.name}>{user.name || user.email}</span>
          <button onClick={handleLogout} style={headerStyles.button}>
            Sign Out
          </button>
        </div>
      </header>
      <Trips user={user} />
    </div>
  )
}

const headerStyles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 48px',
    height: '64px',
    borderBottom: '1px solid rgba(100,190,230,0.1)',
    background: 'rgba(7,17,31,0.98)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  wordmark: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: '22px',
    fontWeight: '600',
    color: '#3bbde8',
    letterSpacing: '0.02em'
  },
  userGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  name: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#6a94ae',
    letterSpacing: '0.02em'
  },
  button: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: '1px solid rgba(59,189,232,0.3)',
    background: 'transparent',
    color: '#3bbde8',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  }
}

export default App
