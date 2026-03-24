import { useState, useEffect } from 'react'
import EditTripForm from './EditTripForm'
import { leaveTrip, getUserById } from './database'
import { colors, fonts, borders } from './theme'

export default function TripRow ({ trip, userId, onUpdated, onDeleted, onLeft, showCoordinator = true }) {
  const [isEditing, setIsEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [coordinator, setCoordinator] = useState(null)

  useEffect(() => {
    if (!showCoordinator) return
    getUserById(trip.userId)
      .then(setCoordinator)
      .catch(() => {})
  }, [trip.userId, showCoordinator])

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
        <td style={styles.editingTd} colSpan={showCoordinator ? 4 : 3}>
          <EditTripForm
            trip={trip}
            onUpdated={(updated) => {
              onUpdated(updated)
              setIsEditing(false)
            }}
            onDeleted={() => onDeleted(trip.$id)}
            onCancel={() => setIsEditing(false)}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr style={styles.tr}>
      <td style={styles.codeCell}>{trip.code || '—'}</td>
      <td style={{ ...styles.td, color: colors.textSecondary }}>{trip.description || '—'}</td>
      {showCoordinator && (
        <td style={{ ...styles.td, color: colors.textSecondary }} title={coordinator?.email || undefined}>
          {coordinator?.name || coordinator?.email || '—'}
        </td>
      )}
      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
        {onLeft
          ? (
            <div>
              <button onClick={handleLeave} disabled={leaving} style={styles.leaveButton}>
                {leaving ? 'Leaving…' : 'Leave'}
              </button>
              {leaveError && <p style={styles.leaveError}>{leaveError}</p>}
            </div>
            )
          : (
            <button onClick={() => setIsEditing(true)} style={styles.editButton}>
              Edit
            </button>
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
