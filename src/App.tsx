import { useEffect, useState } from 'react'
import { account } from './appwrite'
import Login from './Login'
import Signup from './Signup'

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('login')

  useEffect(() => {
    account.get()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  async function handleLogout() {
    await account.deleteSession('current')
    setUser(null)
  }

  if (checking) return null

  if (!user) {
    if (page === 'signup') {
      return <Signup onSignup={setUser} onSwitchToLogin={() => setPage('login')} />
    }
    return <Login onLogin={setUser} onSwitchToSignup={() => setPage('signup')} />
  }

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Welcome, {user.name || user.email}</h1>
      <p style={{ color: '#666', marginTop: '8px' }}>{user.email}</p>
      <button
        onClick={handleLogout}
        style={{
          marginTop: '24px',
          padding: '10px 24px',
          borderRadius: '8px',
          border: 'none',
          background: '#fd366e',
          color: '#fff',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  )
}

export default App
