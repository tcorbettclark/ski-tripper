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
    <div style={{ fontFamily: 'sans-serif' }}>
      <header style={headerStyles.bar}>
        <span style={headerStyles.wordmark}>⛷️ Ski Tripper</span>
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
    padding: '14px 40px',
    borderBottom: '1px solid #eee',
    background: '#fff'
  },
  wordmark: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fd366e'
  },
  userGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  name: {
    fontSize: '14px',
    color: '#444'
  },
  button: {
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    background: '#fd366e',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
}

export default App
