import { useEffect, useState, useRef } from 'react'
import {
  listTripParticipants as _listTripParticipants,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  updateTrip as _updateTrip,
  deleteTrip as _deleteTrip,
  leaveTrip as _leaveTrip,
} from './backend'
import type { Models } from 'appwrite'
import EditTripForm from './EditTripForm'
import ParticipantList from './ParticipantList'
import { colors, fonts, borders } from './theme'

interface Trip {
  $id: string
  code?: string
  description?: string
}

interface TripOverviewProps {
  trip: Trip
  user: Models.User
  listTripParticipants?: (tripId: string) => Promise<{
    documents: Array<{
      $id: string
      ParticipantUserName: string
      role: 'coordinator' | 'participant'
    }>
  }>
  getCoordinatorParticipant?: (tripId: string) => Promise<{
    documents: Array<{
      ParticipantUserId: string
      ParticipantUserName: string
    }>
  }>
  updateTrip?: (
    tripId: string,
    data: { description: string },
    userId: string
  ) => Promise<unknown>
  deleteTrip?: (tripId: string, userId: string) => Promise<void>
  leaveTrip?: (userId: string, tripId: string) => Promise<void>
  onLeft?: () => void
  onUpdated?: (trip: unknown) => void
  onDeleted?: () => void
}

export default function TripOverview({
  trip,
  user,
  listTripParticipants = _listTripParticipants,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  updateTrip = _updateTrip,
  deleteTrip = _deleteTrip,
  leaveTrip = _leaveTrip,
  onLeft,
  onUpdated,
  onDeleted,
}: TripOverviewProps) {
  const [coordinator, setCoordinator] = useState<{ name: string } | null>(null)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeCopyError, setCodeCopyError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!trip) return
    getCoordinatorParticipant(trip.$id)
      .then(({ documents }) => {
        if (!mountedRef.current || documents.length === 0) return
        const cid = documents[0].ParticipantUserId
        if (mountedRef.current) {
          setIsCoordinator(cid === user.$id)
          setCoordinator({ name: documents[0].ParticipantUserName })
        }
      })
      .catch((err) => console.error('Failed to load coordinator:', err))
  }, [trip, user.$id, getCoordinatorParticipant])

  function handleCopyCode() {
    if (!trip.code) return
    navigator.clipboard
      .writeText(trip.code)
      .then(() => {
        if (!mountedRef.current) return
        setCodeCopied(true)
        setCodeCopyError('')
        setTimeout(() => {
          if (mountedRef.current) setCodeCopied(false)
        }, 1500)
      })
      .catch(() => {
        if (!mountedRef.current) return
        setCodeCopyError('Failed to copy')
      })
  }

  async function handleLeave() {
    setLeaveError('')
    setLeaving(true)
    try {
      await leaveTrip(user.$id, trip.$id)
      onLeft?.()
    } catch (err: unknown) {
      setLeaveError(err instanceof Error ? err.message : String(err))
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
            onUpdated={(updated) => {
              setIsEditing(false)
              onUpdated?.(updated)
            }}
            onDeleted={() => onDeleted?.()}
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
              <button
                type="button"
                onClick={handleLeave}
                disabled={leaving}
                style={styles.leaveButton}
              >
                {leaving ? 'Leaving…' : 'Leave Trip'}
              </button>
            )}
            {isCoordinator && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={styles.editButton}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        {leaveError && <p style={styles.leaveError}>{leaveError}</p>}
        <div style={styles.details}>
          {trip.description && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Description</span>
              <span style={styles.detailValue}>{trip.description}</span>
            </div>
          )}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Coordinator</span>
            <span style={styles.detailValue}>
              {coordinator ? `${coordinator.name}` : '…'}
            </span>
          </div>
          {trip.code && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Code</span>
              <span style={styles.codeWithCopy}>
                <span style={styles.mono}>{trip.code}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  style={styles.copyButton}
                  title="Copy invite code"
                  aria-label="Copy invite code"
                >
                  {codeCopied ? '✓' : '⧉'}
                </button>
                <span style={styles.copyFeedback}>
                  {codeCopied
                    ? 'Copied!'
                    : codeCopyError ||
                      '(share this code with others so they can join)'}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Participants</h3>
        <ParticipantList
          tripId={trip.$id}
          listTripParticipants={listTripParticipants}
        />
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
    gap: '24px',
  },
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: '18px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
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
    letterSpacing: '0.03em',
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
    letterSpacing: '0.03em',
  },
  leaveError: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '0 0 12px',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    minWidth: '100px',
  },
  detailValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: '13px',
    color: colors.accent,
    letterSpacing: '0.05em',
  },
  codeWithCopy: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
  },
  copyButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
    fontSize: '14px',
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.7,
  },
  copyFeedback: {
    fontFamily: fonts.body,
    fontSize: '11px',
    color: colors.textSecondary,
    marginLeft: '4px',
    textAlign: 'right',
    flex: 1,
  },
  participantList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  participantItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: borders.subtle,
  },
  participantName: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
  },
  participantRole: {
    fontFamily: fonts.body,
    fontSize: '12px',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  loading: {
    color: colors.textSecondary,
    fontSize: '14px',
  },
} as const
