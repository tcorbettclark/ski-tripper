import { useEffect, useState, useRef } from 'react'
import {
  listParticipatedTrips as _listParticipatedTrips,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  getUserById as _getUserById,
  updateTrip as _updateTrip,
  deleteTrip as _deleteTrip,
  leaveTrip as _leaveTrip
} from './backend'
import EditTripForm from './EditTripForm'
import { colors, fonts, borders } from './theme'

export default function TripOverview ({
  trip,
  user,
  listParticipatedTrips = _listParticipatedTrips,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  getUserById = _getUserById,
  updateTrip = _updateTrip,
  deleteTrip = _deleteTrip,
  leaveTrip = _leaveTrip,
  onLeft,
  onUpdated
}) {
  const [participants, setParticipants] = useState([])
  const [coordinator, setCoordinator] = useState(null)
  const [coordinatorUserId, setCoordinatorUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeCopyError, setCodeCopyError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!trip) return
    getCoordinatorParticipant(trip.$id)
      .then(({ documents }) => {
        if (!mountedRef.current || documents.length === 0) return
        const cid = documents[0].userId
        if (mountedRef.current) {
          setCoordinatorUserId(cid)
          setIsCoordinator(cid === user.$id)
        }
        return getUserById(cid)
      })
      .then((c) => { if (mountedRef.current && c) setCoordinator(c) })
      .catch((err) => console.error('Failed to load coordinator:', err))
  }, [trip, user.$id])

  useEffect(() => {
    if (!trip) return
    listParticipatedTrips(user.$id)
      .then(({ documents }) => {
        if (!mountedRef.current) return
        const tripParticipants = documents.filter((p) => p.tripId === trip.$id)
        const userIds = tripParticipants.map((p) => p.userId)
        return Promise.all(userIds.map((id) => getUserById(id)))
          .then((users) => ({ tripParticipants, users }))
      })
      .then(({ tripParticipants, users }) => {
        if (!mountedRef.current || !users) return
        const withRoles = users.map((u, i) => ({
          ...u,
          role: tripParticipants[i]?.role,
          userId: tripParticipants[i]?.userId
        }))
        setParticipants(withRoles)
      })
      .catch((err) => console.error('Failed to load participants:', err))
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [trip, user.$id])

  function handleCopyCode () {
    if (!trip.code) return
    navigator.clipboard.writeText(trip.code).then(() => {
      if (!mountedRef.current) return
      setCodeCopied(true)
      setCodeCopyError('')
      setTimeout(() => { if (mountedRef.current) setCodeCopied(false) }, 1500)
    }).catch(() => {
      if (!mountedRef.current) return
      setCodeCopyError('Failed to copy')
    })
  }

  async function handleLeave () {
    setLeaveError('')
    setLeaving(true)
    try {
      await leaveTrip(user.$id, trip.$id)
      onLeft?.()
    } catch (err) {
      setLeaveError(err.message)
      setLeaving(false)
    }
  }

  if (!trip) return null

  if (isEditing) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Edit Trip</h3>
          <EditTripForm
            trip={trip}
            userId={user.$id}
            onUpdated={(updated) => { setIsEditing(false); onUpdated?.(updated) }}
            onDeleted={() => {}}
            onCancel={() => setIsEditing(false)}
            updateTrip={updateTrip}
            deleteTrip={deleteTrip}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Trip Details</h3>
          <div style={styles.actions}>
            {!isCoordinator && (
              <button onClick={handleLeave} disabled={leaving} style={styles.leaveButton}>
                {leaving ? 'Leaving…' : 'Leave Trip'}
              </button>
            )}
            {isCoordinator && (
              <button onClick={() => setIsEditing(true)} style={styles.editButton}>
                Edit
              </button>
            )}
          </div>
        </div>
        {leaveError && <p style={styles.leaveError}>{leaveError}</p>}
        <div style={styles.details}>
          {trip.code && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Code</span>
              <span style={styles.mono}>{trip.code}</span>
            </div>
          )}
          {trip.description && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Description</span>
              <span style={styles.detailValue}>{trip.description}</span>
            </div>
          )}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Coordinator</span>
            <span style={styles.detailValue}>
              {coordinator
                ? `${coordinator.name || coordinator.email}${coordinatorUserId === user.$id ? ' (me)' : ''}`
                : '…'}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Participants ({participants.length})</h3>
        {trip.code && (
          <div style={styles.inviteRow}>
            <span style={styles.inviteLabel}>Share this code to invite more participants:</span>
            <span style={styles.inviteCode}>
              <span style={styles.mono}>{trip.code}</span>
              <button
                onClick={handleCopyCode}
                style={styles.copyButton}
                title='Copy invite code'
                aria-label='Copy invite code'
              >
                {codeCopied ? '✓' : '⧉'}
              </button>
              {codeCopyError && <span style={styles.copyError}>{codeCopyError}</span>}
            </span>
          </div>
        )}
        {loading
          ? <p style={styles.loading}>Loading participants…</p>
          : (
            <ul style={styles.participantList}>
              {participants.map((p) => (
                <li key={p.$id || p.email} style={styles.participantItem}>
                  <span style={styles.participantName}>
                    {p.name || p.email}
                    {p.userId === user.$id && ' (me)'}
                  </span>
                  <span style={styles.participantRole}>{p.role}</span>
                </li>
              ))}
            </ul>
            )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    padding: '24px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: '18px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0
  },
  editButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  leaveButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(255,107,107,0.3)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  leaveError: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '0 0 12px'
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  detailRow: {
    display: 'flex',
    gap: '16px'
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    minWidth: '100px'
  },
  detailValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: '13px',
    color: colors.accent,
    letterSpacing: '0.05em'
  },
  inviteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '12px 0 16px',
    padding: '10px 14px',
    background: 'rgba(59,189,232,0.05)',
    border: '1px solid rgba(59,189,232,0.15)',
    borderRadius: '8px'
  },
  inviteLabel: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary
  },
  inviteCode: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  copyButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
    fontSize: '14px',
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.7
  },
  copyError: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '11px'
  },
  participantList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  participantItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: borders.subtle
  },
  participantName: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData
  },
  participantRole: {
    fontFamily: fonts.body,
    fontSize: '12px',
    color: colors.textSecondary,
    textTransform: 'capitalize'
  },
  loading: {
    color: colors.textSecondary,
    fontSize: '14px'
  }
}
