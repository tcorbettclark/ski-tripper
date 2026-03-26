import { useEffect, useState, useCallback } from 'react'
import { account as _account } from './backend'
import AuthForm from './AuthForm'
import Trips from './Trips'
import Proposals from './Proposals'
import Poll from './Poll'
import ErrorBoundary from './ErrorBoundary'
import { colors, fonts, borders } from './theme'

const defaultAccountGet = _account.get.bind(_account)
const defaultDeleteSession = _account.deleteSession.bind(_account, 'current')

function App ({
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession
}) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('login')
  const [activePage, setActivePage] = useState('trips')
  const [proposalsSelectedTripId, setProposalsSelectedTripId] = useState(null)
  const [refreshProposalsKey, setRefreshProposalsKey] = useState(0)

  const handleJoinedTrip = useCallback(() => {
    setRefreshProposalsKey((k) => k + 1)
  }, [])

  useEffect(() => {
    accountGet()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [accountGet])

  async function handleLogout () {
    await deleteSession()
    setUser(null)
  }

  if (checking) return null

  if (!user) {
    return (
      <AuthForm
        mode={page}
        onSuccess={setUser}
        onSwitchMode={() => setPage(page === 'login' ? 'signup' : 'login')}
      />
    )
  }

  return (
    <div style={{ fontFamily: fonts.body, background: colors.bgPrimary, minHeight: '100vh' }}>
      <header style={headerStyles.bar}>
        <span style={headerStyles.wordmark}>⛷ Ski Tripper</span>
        <nav style={headerStyles.nav}>
          <button
            onClick={() => setActivePage('trips')}
            style={activePage === 'trips' ? headerStyles.navTabActive : headerStyles.navTab}
          >
            Trips
          </button>
          <button
            onClick={() => setActivePage('proposals')}
            style={activePage === 'proposals' ? headerStyles.navTabActive : headerStyles.navTab}
          >
            Proposals
          </button>
          <button
            onClick={() => setActivePage('poll')}
            style={
              activePage === 'poll'
                ? headerStyles.navTabActive
                : headerStyles.navTab
            }
          >
            Poll
          </button>
        </nav>
        <div style={headerStyles.userGroup}>
          <span style={headerStyles.name}>{user.name || user.email}</span>
          <button onClick={handleLogout} style={headerStyles.button}>
            Sign Out
          </button>
        </div>
      </header>
      {activePage === 'trips' && (
        <ErrorBoundary>
          <Trips
            user={user}
            onJoinedTrip={handleJoinedTrip}
            onViewProposals={(tripId) => {
              setProposalsSelectedTripId(tripId)
              setActivePage('proposals')
            }}
          />
        </ErrorBoundary>
      )}
      {activePage === 'proposals' && (
        <ErrorBoundary>
          <Proposals
            user={user}
            key={refreshProposalsKey}
            selectedTripId={proposalsSelectedTripId}
          />
        </ErrorBoundary>
      )}
      {activePage === 'poll' && (
        <ErrorBoundary>
          <Poll user={user} />
        </ErrorBoundary>
      )}
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
    borderBottom: borders.subtle,
    background: 'rgba(7,17,31,0.98)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: '22px',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.02em'
  },
  userGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  name: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    letterSpacing: '0.02em'
  },
  button: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: borders.accent,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  nav: {
    display: 'flex',
    gap: '4px'
  },
  navTab: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  navTabActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(59,189,232,0.12)',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  }
}

export default App
