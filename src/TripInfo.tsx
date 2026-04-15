import type { Models } from 'appwrite'
import { useEffect, useRef, useState } from 'react'
import {
  deleteTrip as _deleteTrip,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  leaveTrip as _leaveTrip,
  listTripParticipants as _listTripParticipants,
  updateTrip as _updateTrip,
} from './backend'
import EditTripForm from './EditTripForm'
import { borders, colors, fonts } from './theme'
import type { Trip } from './types.d.ts'

interface TripInfoProps {
  trip: Trip
  user: Models.User
  open: boolean
  onClose: () => void
  listTripParticipants?: (tripId: string) => Promise<{
    participants: Array<{
      $id: string
      participantUserName: string
      role: 'coordinator' | 'participant'
    }>
  }>
  getCoordinatorParticipant?: (tripId: string) => Promise<{
    participants: Array<{
      participantUserId: string
      participantUserName: string
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

export default function TripInfo({
  trip,
  user,
  open,
  onClose,
  listTripParticipants = _listTripParticipants,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  updateTrip = _updateTrip,
  deleteTrip = _deleteTrip,
  leaveTrip = _leaveTrip,
  onLeft,
  onUpdated,
  onDeleted,
}: TripInfoProps) {
  const [coordinator, setCoordinator] = useState<{ name: string } | null>(null)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeCopyError, setCodeCopyError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [participants, setParticipants] = useState<
    Array<{
      $id: string
      participantUserName: string
      role: 'coordinator' | 'participant'
    }>
  >([])
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
      .then(({ participants }) => {
        if (!mountedRef.current || participants.length === 0) return
        const cid = participants[0].participantUserId
        if (mountedRef.current) {
          setIsCoordinator(cid === user.$id)
          setCoordinator({ name: participants[0].participantUserName })
        }
      })
      .catch(() => {})
  }, [trip, user.$id, getCoordinatorParticipant])

  useEffect(() => {
    if (!open) {
      setIsEditing(false)
      setLeaveError('')
    }
  }, [open])

  useEffect(() => {
    if (!trip) return
    listTripParticipants(trip.$id)
      .then(({ participants }) => {
        if (!mountedRef.current) return
        setParticipants(participants)
      })
      .catch(() => {})
  }, [trip, listTripParticipants])

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

  async function handleDelete() {
    if (!window.confirm('Delete this trip?')) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteTrip(trip.$id, user.$id)
      onDeleted?.()
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  if (!open || !trip) return null

  if (isEditing) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={styles.overlay}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div
          role="document"
          style={styles.panel}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Edit Trip</h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={styles.closeButton}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <EditTripForm
            trip={trip}
            userId={user.$id}
            onUpdated={(updated) => {
              setIsEditing(false)
              onUpdated?.(updated)
            }}
            onCancel={() => setIsEditing(false)}
            updateTrip={updateTrip}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="document"
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>Trip Info</h3>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

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
              {coordinator ? coordinator.name : '…'}
            </span>
          </div>
          {trip.code && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Invite Code</span>
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
                {codeCopied && <span style={styles.copyFeedback}>Copied!</span>}
                {codeCopyError && (
                  <span style={styles.copyFeedback}>{codeCopyError}</span>
                )}
              </span>
            </div>
          )}
          <div style={styles.participantSection}>
            <span style={styles.detailLabel}>Participants</span>
            <div style={styles.participantList}>
              {participants.map((p) => (
                <div key={p.$id} style={styles.participantRow}>
                  <span style={styles.detailValue}>
                    {p.participantUserName}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {isCoordinator && (
            <div style={styles.bottomActions}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={styles.deleteButton}
              >
                {deleting ? 'Deleting…' : 'Delete Trip'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={styles.editButton}
              >
                Edit description
              </button>
            </div>
          )}
          {!isCoordinator && (
            <div style={styles.bottomActions}>
              <button
                type="button"
                onClick={handleLeave}
                disabled={leaving}
                style={styles.leaveButton}
              >
                {leaving ? 'Leaving…' : 'Leave Trip'}
              </button>
            </div>
          )}
          {leaveError && <p style={styles.leaveError}>{leaveError}</p>}
          {deleteError && <p style={styles.leaveError}>{deleteError}</p>}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    padding: '28px',
    width: '100%',
    maxWidth: '440px',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: '18px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  participantsCell: {
    flex: 1,
  },
  bottomActions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '4px',
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
  deleteButton: {
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
    margin: '8px 0 0',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    minWidth: '110px',
  },
  detailValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
  },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    alignSelf: 'flex-start',
  },
  participantSection: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  participantList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  participantRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: '11px',
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
  },
} as const
