import { useState, useCallback } from 'react'
import {
  createTrip as _createTrip,
  getTripByCode as _getTripByCode,
  joinTrip as _joinTrip,
  updateTrip as _updateTrip,
  deleteTrip as _deleteTrip,
  leaveTrip as _leaveTrip,
  getCoordinatorParticipant as _getCoordinatorParticipant
} from './backend'
import CreateTripForm from './CreateTripForm'
import JoinTripForm from './JoinTripForm'
import TripTable from './TripTable'
import { colors, fonts, borders } from './theme'

export default function Trips ({
  user,
  trips,
  onSelectTrip,
  onJoinedTrip,
  createTrip = _createTrip,
  getTripByCode = _getTripByCode,
  joinTrip = _joinTrip,
  updateTrip = _updateTrip,
  deleteTrip = _deleteTrip,
  leaveTrip = _leaveTrip,
  getCoordinatorParticipant = _getCoordinatorParticipant
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)

  const handleCreated = useCallback((trip) => {
    onJoinedTrip?.()
  }, [onJoinedTrip])

  const handleJoined = useCallback((trip) => {
    onJoinedTrip?.()
  }, [onJoinedTrip])

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>My Trips</h2>
        <div style={styles.buttons}>
          <button
            onClick={() => { setShowCreateForm((v) => !v); setShowJoinForm(false) }}
            style={styles.actionButton}
          >
            {showCreateForm ? 'Cancel' : '+ New Trip'}
          </button>
          <button
            onClick={() => { setShowJoinForm((v) => !v); setShowCreateForm(false) }}
            style={styles.actionButton}
          >
            {showJoinForm ? 'Cancel' : '+ Join Trip'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <CreateTripForm
          user={user}
          onCreated={handleCreated}
          onDismiss={() => setShowCreateForm(false)}
          createTrip={createTrip}
        />
      )}
      {showJoinForm && (
        <JoinTripForm
          user={user}
          onJoined={handleJoined}
          onDismiss={() => setShowJoinForm(false)}
          getTripByCode={getTripByCode}
          joinTrip={joinTrip}
        />
      )}

      <TripTable
        trips={trips}
        onSelectTrip={onSelectTrip}
        emptyMessage='No trips yet. Create one or join one above.'
        getCoordinatorParticipant={getCoordinatorParticipant}
      />
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em'
  },
  buttons: {
    display: 'flex',
    gap: '10px'
  },
  actionButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  }
}
