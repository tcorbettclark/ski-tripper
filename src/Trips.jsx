import { useEffect, useState, useCallback, useRef } from 'react'
import {
  listTrips as _listTrips,
  listParticipatedTrips as _listParticipatedTrips,
  createTrip as _createTrip,
  getTripByCode as _getTripByCode,
  joinTrip as _joinTrip,
  updateTrip as _updateTrip,
  deleteTrip as _deleteTrip,
  leaveTrip as _leaveTrip,
  getUserById as _getUserById,
  getCoordinatorParticipant as _getCoordinatorParticipant
} from './backend'
import CreateTripForm from './CreateTripForm'
import JoinTripForm from './JoinTripForm'
import TripTable from './TripTable'
import { colors, fonts, borders } from './theme'

export default function Trips ({
  user,
  onJoinedTrip,
  onViewProposals,
  listTrips = _listTrips,
  listParticipatedTrips = _listParticipatedTrips,
  createTrip = _createTrip,
  getTripByCode = _getTripByCode,
  joinTrip = _joinTrip,
  updateTrip = _updateTrip,
  deleteTrip = _deleteTrip,
  leaveTrip = _leaveTrip,
  getUserById = _getUserById,
  getCoordinatorParticipant = _getCoordinatorParticipant
}) {
  const [trips, setTrips] = useState([])
  const [participatedTrips, setParticipatedTrips] = useState([])
  const [coordinatorUserIds, setCoordinatorUserIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    Promise.all([
      listTrips(user.$id),
      listParticipatedTrips(user.$id)
    ])
      .then(([ownRes, participatedRes]) => {
        if (!mountedRef.current) return
        setTrips(ownRes.documents)
        setCoordinatorUserIds(ownRes.coordinatorUserIds)
        setParticipatedTrips(participatedRes.documents)
      })
      .catch((err) => { if (mountedRef.current) setError(err.message) })
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [user.$id])

  const handleCreated = useCallback((trip) => {
    setTrips((t) => [trip, ...t])
    setCoordinatorUserIds((m) => ({ ...m, [trip.$id]: user.$id }))
  }, [user.$id])

  const handleUpdated = useCallback((updated) => {
    setTrips((t) =>
      t.map((trip) => (trip.$id === updated.$id ? updated : trip))
    )
  }, [])

  const handleDeleted = useCallback((id) => {
    setTrips((t) => t.filter((trip) => trip.$id !== id))
    setParticipatedTrips((t) => t.filter((trip) => trip.$id !== id))
    setCoordinatorUserIds((m) => {
      const copy = { ...m }
      delete copy[id]
      return copy
    })
  }, [])

  const handleJoined = useCallback((trip) => {
    setParticipatedTrips((t) => [trip, ...t])
    onJoinedTrip?.()
  }, [onJoinedTrip])

  const handleLeft = useCallback((tripId) => {
    setParticipatedTrips((t) => t.filter((trip) => trip.$id !== tripId))
  }, [])

  if (loading) return <p style={styles.message}>Loading trips…</p>
  if (error) { return <p style={{ ...styles.message, color: colors.error }}>{error}</p> }

  const coordinatedIds = new Set(trips.map((t) => t.$id))
  const allTrips = [...trips, ...participatedTrips.filter((t) => !coordinatedIds.has(t.$id))]

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Trips</h2>
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
        trips={allTrips}
        userId={user.$id}
        coordinatorUserIds={coordinatorUserIds}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onLeft={handleLeft}
        onViewProposals={onViewProposals}
        emptyMessage='No trips yet. Create one or join one above.'
        updateTrip={updateTrip}
        deleteTrip={deleteTrip}
        leaveTrip={leaveTrip}
        getUserById={getUserById}
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
