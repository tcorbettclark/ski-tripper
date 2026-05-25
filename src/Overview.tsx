import type { Models } from 'appwrite'
import { Check, Copy, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  getCoordinatorParticipant as _getCoordinatorParticipant,
  listPolls as _listPolls,
  listProposals as _listProposals,
  listTripParticipants as _listTripParticipants,
  listVotes as _listVotes,
  updateTrip as _updateTrip,
} from './backend'
import EditTripDescriptionForm from './EditTripDescriptionForm'
import NextActions from './NextActions'
import { borders, colors, fonts, formStyles } from './theme'
import type {
  Participant,
  Poll,
  Proposal,
  Resort,
  Trip,
  Vote,
} from './types.d.ts'

interface OverviewProps {
  user: Models.User
  trip: Trip
  tripId: string
  resorts: Resort[]
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: 'DRAFT' | 'SUBMITTED' | 'REJECTED'
  ) => void
  onTripUpdated?: (trip: Trip) => void
  onAuthError?: (err: unknown) => void
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ proposals: Proposal[] }>
  listPolls?: (tripId: string, userId: string) => Promise<{ polls: Poll[] }>
  listVotes?: (pollId: string, userId: string) => Promise<{ votes: Vote[] }>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  updateTrip?: (
    tripId: string,
    data: Partial<Trip>,
    participantUserId: string
  ) => Promise<Trip>
}

const noopAuthError = () => {}

export default function Overview({
  user,
  trip,
  tripId,
  resorts,
  onNavigateToTab,
  onTripUpdated,
  onAuthError = noopAuthError,
  listTripParticipants = _listTripParticipants,
  listProposals = _listProposals,
  listPolls = _listPolls,
  listVotes = _listVotes,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  updateTrip = _updateTrip,
}: OverviewProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(true)
  const [participantsError, setParticipantsError] = useState('')
  const [userVotedInActivePoll, setUserVotedInActivePoll] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeCopyError, setCodeCopyError] = useState('')
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    getCoordinatorParticipant(tripId)
      .then(({ participants }) => {
        if (!mountedRef.current) return
        setIsCoordinator(
          participants.length > 0 &&
            participants[0].participantUserId === user.$id
        )
      })
      .catch(() => {})
  }, [tripId, user.$id, getCoordinatorParticipant])

  useEffect(() => {
    if (!tripId) return

    setParticipantsLoading(true)
    setParticipantsError('')
    listTripParticipants(tripId)
      .then((result) => {
        if (!mountedRef.current) return
        setParticipants(result.participants)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setParticipantsError(msg)
        onAuthError(err)
      })
      .finally(() => {
        if (mountedRef.current) setParticipantsLoading(false)
      })
  }, [tripId, listTripParticipants, onAuthError])

  useEffect(() => {
    if (!tripId) return

    listProposals(tripId, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setProposals(result.proposals)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        onAuthError(err)
      })
  }, [tripId, user.$id, listProposals, onAuthError])

  useEffect(() => {
    if (!tripId) return

    listPolls(tripId, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setPolls(result.polls)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        onAuthError(err)
      })
  }, [tripId, user.$id, listPolls, onAuthError])

  const activePoll = polls.find((p) => p.state === 'OPEN')
  const closedPollCount = polls.filter((p) => p.state === 'CLOSED').length

  useEffect(() => {
    if (!activePoll) {
      setUserVotedInActivePoll(false)
      return
    }
    listVotes(activePoll.$id, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setUserVotedInActivePoll(result.votes.length > 0)
      })
      .catch(() => {
        if (!mountedRef.current) return
        setUserVotedInActivePoll(false)
      })
  }, [activePoll, user.$id, listVotes])

  const draftCount = proposals.filter(
    (p) => p.state === 'DRAFT' && p.proposerUserId === user.$id
  ).length
  const submittedCount = proposals.filter((p) => p.state === 'SUBMITTED').length
  const approvedCount = proposals.filter((p) => p.state === 'APPROVED').length

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

  return (
    <div style={overviewStyles.container}>
      <div style={overviewStyles.toolbar}>
        <h2 style={overviewStyles.heading}>Overview</h2>
      </div>

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Trip</h3>
        <div style={overviewStyles.card}>
          {editingDescription ? (
            <EditTripDescriptionForm
              trip={trip}
              userId={user.$id}
              onUpdated={(updatedTrip) => {
                setEditingDescription(false)
                onTripUpdated?.(updatedTrip)
              }}
              onCancel={() => setEditingDescription(false)}
              updateTrip={updateTrip}
            />
          ) : (
            <>
              <div style={overviewStyles.tripRow}>
                <span style={overviewStyles.label}>Description</span>
                <span style={overviewStyles.value}>
                  {trip.description || '—'}
                  {isCoordinator && (
                    <button
                      type="button"
                      onClick={() => setEditingDescription(true)}
                      style={overviewStyles.editButton}
                      title="Edit description"
                      aria-label="Edit description"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </span>
              </div>
              <div style={overviewStyles.tripRow}>
                <span style={overviewStyles.label}>Invite code</span>
                <span style={overviewStyles.codeWithCopy}>
                  <span style={overviewStyles.codeValue}>{trip.code}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={overviewStyles.copyButton}
                    title="Copy invite code"
                    aria-label="Copy invite code"
                  >
                    {codeCopied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  {codeCopied && (
                    <span style={overviewStyles.copyFeedback}>Copied!</span>
                  )}
                  {codeCopyError && (
                    <span style={overviewStyles.copyFeedback}>
                      {codeCopyError}
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Participants</h3>
        {participantsLoading && (
          <p style={overviewStyles.loading}>Loading...</p>
        )}
        {participantsError && (
          <p style={formStyles.error}>{participantsError}</p>
        )}
        {!participantsLoading && !participantsError && (
          <div style={overviewStyles.card}>
            {participants.length === 0 ? (
              <p style={overviewStyles.empty}>No participants</p>
            ) : (
              <div style={overviewStyles.participantList}>
                {participants.map((p) => (
                  <div key={p.$id} style={overviewStyles.participantRow}>
                    <span style={overviewStyles.participantName}>
                      {p.participantUserName}
                    </span>
                    {p.role === 'coordinator' && (
                      <span style={overviewStyles.badge}>Coordinator</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <NextActions
        resortCount={resorts.length}
        draftCount={draftCount}
        submittedCount={submittedCount}
        approvedCount={approvedCount}
        closedPollCount={closedPollCount}
        activePoll={activePoll}
        userVotedInActivePoll={userVotedInActivePoll}
        isCoordinator={isCoordinator}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  )
}

const overviewStyles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  section: {
    marginBottom: '32px',
  },
  sectionHeading: {
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    margin: '0 0 12px',
  },
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '10px',
    padding: '20px 24px',
  },

  tripRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '6px 0',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    letterSpacing: '0.02em',
    flexShrink: 0,
  },
  value: {
    fontFamily: fonts.body,
    fontSize: '15px',
    color: colors.textPrimary,
    textAlign: 'right' as const,
  },
  codeValue: {
    fontFamily: fonts.mono,
    fontSize: '14px',
    color: colors.accent,
    letterSpacing: '0.04em',
  },
  codeWithCopy: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'flex-end',
  },
  copyButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
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
  editButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
    padding: '0 2px',
    marginLeft: '6px',
    lineHeight: 1,
    opacity: 0.7,
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    margin: 0,
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    margin: 0,
  },
  participantList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  participantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  participantName: {
    fontFamily: fonts.body,
    fontSize: '15px',
    color: colors.textPrimary,
  },
  badge: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '600',
    color: colors.accent,
    background: 'rgba(59,189,232,0.12)',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
} as const
