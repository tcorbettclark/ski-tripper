import { useState, useEffect, useCallback } from 'react'
import EditTripForm from './EditTripForm'
import {
  leaveTrip as _leaveTrip,
  getUserById as _getUserById,
  updateTrip as _updateTrip,
  deleteTrip as _deleteTrip,
  getCoordinatorParticipant as _getCoordinatorParticipant
} from './backend'
import { colors, fonts, borders } from './theme'

export default function TripRow ({
  trip,
  userId,
  coordinatorUserId,
  onUpdated,
  onDeleted,
  onLeft,
  leaveTrip = _leaveTrip,
  getUserById = _getUserById,
  updateTrip = _updateTrip,
  deleteTrip = _deleteTrip,
  getCoordinatorParticipant = _getCoordinatorParticipant
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [coordinator, setCoordinator] = useState(null)
  const [copied, setCopied] = useState(false)
  const [coordinatorUserIdResolved, setCoordinatorUserIdResolved] = useState(coordinatorUserId)

  const handleCopy = useCallback(() => {
    if (!trip.code) return
    navigator.clipboard.writeText(trip.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [trip.code])

  useEffect(() => {
    if (coordinatorUserIdResolved) {
      getUserById(coordinatorUserIdResolved)
        .then(setCoordinator)
        .catch(() => {})
    } else {
      getCoordinatorParticipant(trip.$id)
        .then(({ documents }) => {
          if (documents.length === 0) return
          const cid = documents[0].userId
          setCoordinatorUserIdResolved(cid)
          return getUserById(cid)
        })
        .then((c) => { if (c) setCoordinator(c) })
        .catch(() => {})
    }
  }, [coordinatorUserIdResolved])

  async function handleLeave () {
    setLeaveError('')
    setLeaving(true)
    try {
      await leaveTrip(userId, trip.$id)
      onLeft(trip.$id)
    } catch (err) {
      setLeaveError(err.message)
      setLeaving(false)
    }
  }

  if (isEditing) {
    return (
      <tr style={styles.editingTr}>
        <td style={styles.editingTd} colSpan={4}>
          <EditTripForm
            trip={trip}
            userId={userId}
            onUpdated={(updated) => {
              onUpdated(updated)
              setIsEditing(false)
            }}
            onDeleted={() => { setIsEditing(false); onDeleted(trip.$id) }}
            onCancel={() => setIsEditing(false)}
            updateTrip={updateTrip}
            deleteTrip={deleteTrip}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr style={styles.tr}>
      <td style={styles.codeCell}>
        <span style={styles.codeWrapper}>
          {trip.code || '—'}
          {trip.code && (
            <button
              onClick={handleCopy}
              style={styles.copyButton}
              title='Copy code'
              aria-label='Copy trip code'
            >
              {copied ? '✓' : '⧉'}
            </button>
          )}
        </span>
      </td>
      <td style={{ ...styles.td, color: colors.textSecondary }}>{trip.description || '—'}</td>
      <td style={{ ...styles.td, color: colors.textSecondary }} title={coordinator?.email || undefined}>
        {coordinatorUserIdResolved === userId
          ? `${coordinator?.name || coordinator?.email || '—'} (me)`
          : coordinator?.name || coordinator?.email || '—'}
      </td>
      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
        {coordinatorUserIdResolved === userId
          ? (
            <button onClick={() => setIsEditing(true)} style={styles.editButton}>
              Edit
            </button>
            )
          : (
            <div>
              <button onClick={handleLeave} disabled={leaving} style={styles.leaveButton}>
                {leaving ? 'Leaving…' : 'Leave'}
              </button>
              {leaveError && <p style={styles.leaveError}>{leaveError}</p>}
            </div>
            )}
      </td>
    </tr>
  )
}

const styles = {
  codeCell: {
    padding: '14px 16px',
    color: colors.textSecondary,
    verticalAlign: 'top',
    fontFamily: fonts.mono,
    fontSize: '13px',
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap'
  },
  codeWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  copyButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.textSecondary,
    fontSize: '13px',
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.6
  },
  tr: {
    borderBottom: '1px solid rgba(100,190,230,0.07)'
  },
  td: {
    padding: '14px 16px',
    color: colors.textData,
    verticalAlign: 'top',
    fontFamily: fonts.body,
    fontSize: '14px',
    lineHeight: '1.5'
  },
  editingTr: {
    borderBottom: '1px solid rgba(59,189,232,0.2)',
    borderTop: '1px solid rgba(59,189,232,0.2)',
    background: 'rgba(59,189,232,0.04)'
  },
  editingTd: {
    padding: '20px 24px',
    verticalAlign: 'top',
    borderLeft: `2px solid ${colors.accent}`
  },
  editButton: {
    padding: '5px 16px',
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
    padding: '5px 16px',
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
    fontSize: '11px',
    margin: '4px 0 0',
    whiteSpace: 'normal'
  }
}
