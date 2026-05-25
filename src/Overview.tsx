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
import { borders, colors, fonts, formStyles } from './theme'
import type {
  Participant,
  Poll,
  Proposal,
  Resort,
  Trip,
  Vote,
} from './types.d.ts'
import { formatDate } from './utils'

function ClickableRow({
  onClick,
  label,
  children,
  style,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      style={{
        ...overviewStyles.statusRow,
        cursor: 'pointer',
        background: hovered ? 'rgba(59,189,232,0.04)' : 'transparent',
        borderRadius: '6px',
        margin: '0 -8px',
        padding: '6px 8px',
        transition: 'background 0.15s',
        border: 'none',
        width: '100%',
        textAlign: 'left' as const,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

interface OverviewProps {
  user: Models.User
  trip: Trip
  tripId: string
  resorts: Resort[]
  onNavigateToTab: (tab: 'resorts' | 'proposals' | 'poll') => void
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
  const [proposalsLoading, setProposalsLoading] = useState(true)
  const [pollsLoading, setPollsLoading] = useState(true)
  const [participantsError, setParticipantsError] = useState('')
  const [proposalsError, setProposalsError] = useState('')
  const [pollsError, setPollsError] = useState('')
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

    setProposalsLoading(true)
    setProposalsError('')
    listProposals(tripId, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setProposals(result.proposals)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setProposalsError(msg)
        onAuthError(err)
      })
      .finally(() => {
        if (mountedRef.current) setProposalsLoading(false)
      })
  }, [tripId, user.$id, listProposals, onAuthError])

  useEffect(() => {
    if (!tripId) return

    setPollsLoading(true)
    setPollsError('')
    listPolls(tripId, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setPolls(result.polls)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setPollsError(msg)
        onAuthError(err)
      })
      .finally(() => {
        if (mountedRef.current) setPollsLoading(false)
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

  const draftCount = proposals.filter((p) => p.state === 'DRAFT').length
  const submittedCount = proposals.filter((p) => p.state === 'SUBMITTED').length
  const rejectedCount = proposals.filter((p) => p.state === 'REJECTED').length
  const approvedCount = proposals.filter((p) => p.state === 'APPROVED').length

  const countryBreakdown = resorts.reduce<Record<string, number>>((acc, r) => {
    acc[r.country] = (acc[r.country] || 0) + 1
    return acc
  }, {})

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

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Status</h3>
        {proposalsLoading && pollsLoading && (
          <p style={overviewStyles.loading}>Loading...</p>
        )}
        {(proposalsError || pollsError) && (
          <p style={formStyles.error}>{proposalsError || pollsError}</p>
        )}
        {!proposalsLoading &&
          !pollsLoading &&
          !proposalsError &&
          !pollsError && (
            <div style={overviewStyles.card}>
              {proposals.length === 0 && polls.length === 0 ? (
                <p style={overviewStyles.empty}>No activity yet</p>
              ) : (
                <>
                  {proposals.length > 0 && (
                    <ClickableRow
                      onClick={() => onNavigateToTab('proposals')}
                      label="View proposals"
                    >
                      <span style={overviewStyles.label}>Proposals</span>
                      <div style={overviewStyles.statusCounts}>
                        {draftCount > 0 && (
                          <span style={overviewStyles.statusChip}>
                            {draftCount} draft
                          </span>
                        )}
                        {submittedCount > 0 && (
                          <span style={overviewStyles.statusChip}>
                            {submittedCount} submitted
                          </span>
                        )}
                        {rejectedCount > 0 && (
                          <span style={overviewStyles.statusChip}>
                            {rejectedCount} rejected
                          </span>
                        )}
                        {approvedCount > 0 && (
                          <span style={overviewStyles.statusChip}>
                            {approvedCount} approved
                          </span>
                        )}
                      </div>
                    </ClickableRow>
                  )}
                  {activePoll && (
                    <ClickableRow
                      onClick={() => onNavigateToTab('poll')}
                      label="Go to active poll"
                    >
                      <span style={overviewStyles.label}>Active poll</span>
                      <span style={overviewStyles.value}>
                        Ends {formatDate(activePoll.endDate)}
                      </span>
                    </ClickableRow>
                  )}
                  {closedPollCount > 0 && (
                    <ClickableRow
                      onClick={() => onNavigateToTab('poll')}
                      label="View closed polls"
                    >
                      <span style={overviewStyles.label}>Closed polls</span>
                      <span style={overviewStyles.value}>
                        {closedPollCount}
                      </span>
                    </ClickableRow>
                  )}
                </>
              )}
            </div>
          )}
      </section>

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Resort Catalog</h3>
        {resorts.length === 0 ? (
          <div style={overviewStyles.card}>
            <p style={overviewStyles.loading}>Loading resorts...</p>
          </div>
        ) : (
          <div style={overviewStyles.card}>
            <ClickableRow
              onClick={() => onNavigateToTab('resorts')}
              label="Browse resorts"
            >
              <span style={overviewStyles.resortSummary}>
                {resorts.length} resorts available
              </span>
            </ClickableRow>
            {Object.keys(countryBreakdown).length > 0 && (
              <div style={overviewStyles.countryBreakdown}>
                {Object.entries(countryBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([country, count]) => (
                    <button
                      key={country}
                      type="button"
                      onClick={() => onNavigateToTab('resorts')}
                      style={overviewStyles.countryTag}
                    >
                      {country}: {count}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Next Steps</h3>
        <div style={overviewStyles.card}>
          {proposals.length === 0 && (
            <button
              type="button"
              onClick={() => onNavigateToTab('resorts')}
              style={overviewStyles.nextStepButton}
            >
              No proposals yet — browse resorts to create one
            </button>
          )}
          {proposals.length > 0 && draftCount > 0 && !activePoll && (
            <button
              type="button"
              onClick={() => onNavigateToTab('proposals')}
              style={overviewStyles.nextStepButton}
            >
              You have {draftCount} draft proposal{draftCount !== 1 ? 's' : ''}{' '}
              — submit for voting
            </button>
          )}
          {activePoll && !userVotedInActivePoll && (
            <button
              type="button"
              onClick={() => onNavigateToTab('poll')}
              style={overviewStyles.nextStepButton}
            >
              An active poll needs your vote
            </button>
          )}
          {proposals.length > 0 &&
            rejectedCount > 0 &&
            draftCount === 0 &&
            !activePoll && (
              <button
                type="button"
                onClick={() => onNavigateToTab('resorts')}
                style={overviewStyles.nextStepButton}
              >
                Proposals were rejected — browse resorts for new ideas
              </button>
            )}
          {proposals.length > 0 &&
            submittedCount > 0 &&
            !activePoll &&
            isCoordinator && (
              <button
                type="button"
                onClick={() => onNavigateToTab('poll')}
                style={overviewStyles.nextStepButton}
              >
                {submittedCount} proposal{submittedCount !== 1 ? 's' : ''} ready
                — create a poll
              </button>
            )}
          {!(
            proposals.length === 0 ||
            (draftCount > 0 && !activePoll) ||
            (activePoll && !userVotedInActivePoll) ||
            (rejectedCount > 0 && draftCount === 0 && !activePoll) ||
            (submittedCount > 0 && !activePoll && isCoordinator)
          ) && <p style={overviewStyles.empty}>All caught up!</p>}
        </div>
      </section>
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
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '6px 0',
  },
  statusCounts: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  statusChip: {
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    color: colors.textData,
    background: 'rgba(100,190,230,0.08)',
    padding: '3px 10px',
    borderRadius: '4px',
    letterSpacing: '0.02em',
  },
  resortSummary: {
    fontFamily: fonts.body,
    fontSize: '15px',
    color: colors.textPrimary,
    margin: '0 0 8px',
  },
  countryBreakdown: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginTop: '8px',
  },
  countryTag: {
    fontFamily: fonts.body,
    fontSize: '12px',
    color: colors.textData,
    background: 'rgba(100,190,230,0.08)',
    padding: '3px 10px',
    borderRadius: '4px',
    letterSpacing: '0.02em',
    border: 'none',
    cursor: 'pointer',
  },
  nextStepButton: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    borderRadius: '7px',
    border: borders.accent,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    textAlign: 'left' as const,
  },
} as const
