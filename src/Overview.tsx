import type { Models } from 'appwrite'
import { useEffect, useRef, useState } from 'react'
import {
  listPolls as _listPolls,
  listProposals as _listProposals,
  listTripParticipants as _listTripParticipants,
} from './backend'
import { borders, colors, fonts, formStyles } from './theme'
import type { Participant, Poll, Proposal, Resort, Trip } from './types.d.ts'
import { formatDate } from './utils'

interface OverviewProps {
  user: Models.User
  trip: Trip
  tripId: string
  resorts: Resort[]
  onNavigateToTab: (tab: 'resorts' | 'proposals' | 'poll') => void
  onAuthError?: (err: unknown) => void
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ proposals: Proposal[] }>
  listPolls?: (tripId: string, userId: string) => Promise<{ polls: Poll[] }>
}

const noopAuthError = () => {}

export default function Overview({
  user,
  trip,
  tripId,
  resorts,
  onNavigateToTab,
  onAuthError = noopAuthError,
  listTripParticipants = _listTripParticipants,
  listProposals = _listProposals,
  listPolls = _listPolls,
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
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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

  const draftCount = proposals.filter((p) => p.state === 'DRAFT').length
  const submittedCount = proposals.filter((p) => p.state === 'SUBMITTED').length
  const rejectedCount = proposals.filter((p) => p.state === 'REJECTED').length
  const approvedCount = proposals.filter((p) => p.state === 'APPROVED').length
  const activePoll = polls.find((p) => p.state === 'OPEN')
  const closedPollCount = polls.filter((p) => p.state === 'CLOSED').length

  const countryBreakdown = resorts.reduce<Record<string, number>>((acc, r) => {
    acc[r.country] = (acc[r.country] || 0) + 1
    return acc
  }, {})

  return (
    <div style={overviewStyles.container}>
      <div style={overviewStyles.toolbar}>
        <h2 style={overviewStyles.heading}>Overview</h2>
      </div>

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Trip</h3>
        <div style={overviewStyles.card}>
          <div style={overviewStyles.tripRow}>
            <span style={overviewStyles.label}>Description</span>
            <span style={overviewStyles.value}>{trip.description || '—'}</span>
          </div>
          <div style={overviewStyles.tripRow}>
            <span style={overviewStyles.label}>Invite code</span>
            <span style={overviewStyles.codeValue}>{trip.code}</span>
          </div>
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
                    <div style={overviewStyles.statusRow}>
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
                    </div>
                  )}
                  {activePoll && (
                    <div style={overviewStyles.statusRow}>
                      <span style={overviewStyles.label}>Active poll</span>
                      <span style={overviewStyles.value}>
                        Ends {formatDate(activePoll.endDate)}
                      </span>
                    </div>
                  )}
                  {closedPollCount > 0 && (
                    <div style={overviewStyles.statusRow}>
                      <span style={overviewStyles.label}>Closed polls</span>
                      <span style={overviewStyles.value}>
                        {closedPollCount}
                      </span>
                    </div>
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
            <p style={overviewStyles.resortSummary}>
              {resorts.length} resorts available
            </p>
            {Object.keys(countryBreakdown).length > 0 && (
              <div style={overviewStyles.countryBreakdown}>
                {Object.entries(countryBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([country, count]) => (
                    <span key={country} style={overviewStyles.countryTag}>
                      {country}: {count}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Quick Actions</h3>
        <div style={overviewStyles.quickActions}>
          <button
            type="button"
            onClick={() => onNavigateToTab('resorts')}
            style={overviewStyles.quickActionButton}
          >
            Browse Resorts
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('proposals')}
            style={overviewStyles.quickActionButton}
          >
            View Proposals
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('poll')}
            style={overviewStyles.quickActionButton}
          >
            {activePoll ? 'Go to Active Poll' : 'View Polls'}
          </button>
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
    textAlign: 'right' as const,
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
  },
  quickActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  quickActionButton: {
    padding: '10px 24px',
    borderRadius: '7px',
    border: borders.accent,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
} as const
