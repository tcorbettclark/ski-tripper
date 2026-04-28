import type { Models } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  closePoll as _closePoll,
  createPoll as _createPoll,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  listAccommodations as _listAccommodations,
  listPolls as _listPolls,
  listProposals as _listProposals,
  listVotes as _listVotes,
  upsertVote as _upsertVote,
} from './backend'
import PastPoll from './PastPoll'
import PollResults from './PollResults'
import PollVoting from './PollVoting'
import { borders, colors, fonts } from './theme'
import type {
  Accommodation,
  Poll as PollType,
  Proposal,
  Vote,
} from './types.d.ts'
import { formatDate, getDaysRemaining } from './utils'

interface PollComponentProps {
  user: Models.User
  tripId: string
  listPolls?: (tripId: string, userId: string) => Promise<{ polls: PollType[] }>
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ proposals: Proposal[] }>
  listVotes?: (
    pollId: string,
    tripId: string,
    userId: string
  ) => Promise<{ votes: Vote[] }>
  createPoll?: (
    tripId: string,
    userId: string,
    userName: string,
    durationDays: number
  ) => Promise<PollType>
  closePoll?: (pollId: string, userId: string) => Promise<PollType>
  upsertVote?: (
    pollId: string,
    tripId: string,
    userId: string,
    proposalIds: string[],
    tokenCounts: number[]
  ) => Promise<Vote>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ participantUserId: string }> }>
  listAccommodations?: (proposalId: string) => Promise<Accommodation[]>
}

export default function Poll({
  user,
  tripId,
  listPolls = _listPolls,
  listProposals = _listProposals,
  listVotes = _listVotes,
  createPoll = _createPoll,
  closePoll = _closePoll,
  upsertVote = _upsertVote,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  listAccommodations = _listAccommodations,
}: PollComponentProps) {
  const [loading, setLoading] = useState(true)
  const [activePoll, setActivePoll] = useState<PollType | null>(null)
  const [pastPolls, setPastPolls] = useState<PollType[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [accommodations, setAccommodations] = useState<
    Record<string, Accommodation[]>
  >({})
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [pollsLoading, setPollsLoading] = useState(false)
  const [pollsError, setPollsError] = useState('')
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [createError, setCreateError] = useState('')
  const [pollDuration, setPollDuration] = useState(7)
  const [closingPoll, setClosingPoll] = useState(false)
  const [closeError, setCloseError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!tripId) {
      setActivePoll(null)
      setPastPolls([])
      setProposals([])
      setVotes([])
      setIsCoordinator(false)
      setLoading(false)
      return
    }
    setLoading(false)
    setPollsLoading(true)
    setPollsError('')
    setCreateError('')
    setCloseError('')
    Promise.all([
      getCoordinatorParticipant(tripId),
      listProposals(tripId, user.$id),
      listPolls(tripId, user.$id),
    ])
      .then(async ([coordResult, proposalsResult, pollsResult]) => {
        if (!mountedRef.current) return
        setIsCoordinator(
          coordResult.participants.length > 0 &&
            coordResult.participants[0].participantUserId === user.$id
        )
        setProposals(proposalsResult.proposals)
        const accMap: Record<string, Accommodation[]> = {}
        const accResults = await Promise.all(
          proposalsResult.proposals.map((p) =>
            listAccommodations(p.$id).catch(() => [])
          )
        )
        if (!mountedRef.current) return
        proposalsResult.proposals.forEach((p, i) => {
          accMap[p.$id] = accResults[i]
        })
        setAccommodations(accMap)
        const open = pollsResult.polls.find((p) => p.state === 'OPEN') || null
        const past = pollsResult.polls.filter((p) => p.state === 'CLOSED')
        setActivePoll(open)
        setPastPolls(past)
        if (open) {
          const votesResult = await listVotes(open.$id, tripId, user.$id)
          if (mountedRef.current) setVotes(votesResult.votes)
        }
      })
      .catch((err) => {
        if (mountedRef.current)
          setPollsError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mountedRef.current) setPollsLoading(false)
      })
  }, [
    tripId,
    user.$id,
    getCoordinatorParticipant,
    listProposals,
    listPolls,
    listVotes,
    listAccommodations,
  ])

  const handleVoteSaved = useCallback((vote: unknown) => {
    const v = vote as Vote
    setVotes((prev) => {
      const exists = prev.find((x) => x.$id === v.$id)
      return exists ? prev.map((x) => (x.$id === v.$id ? v : x)) : [...prev, v]
    })
  }, [])

  async function handleCreatePoll() {
    setCreatingPoll(true)
    setCreateError('')
    try {
      const poll = await createPoll(
        tripId,
        user.$id,
        user.name || '',
        pollDuration
      )
      setActivePoll(poll)
      setVotes([])
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreatingPoll(false)
    }
  }

  async function handleClosePoll() {
    if (!activePoll) return
    setClosingPoll(true)
    setCloseError('')
    try {
      const closed = await closePoll(activePoll.$id, user.$id)
      setActivePoll(null)
      setPastPolls((p) => [closed, ...p])
    } catch (err: unknown) {
      setCloseError(err instanceof Error ? err.message : String(err))
    } finally {
      setClosingPoll(false)
    }
  }

  const hasSubmittedProposals = proposals.some((p) => p.state === 'SUBMITTED')
  const myVote = votes.find((v) => v.voterUserId === user.$id) || null

  if (loading) return <p style={styles.message}>Loading…</p>

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Poll</h2>
      </div>

      {pollsLoading && <p style={styles.message}>Loading poll…</p>}
      {pollsError && (
        <p style={{ ...styles.message, color: colors.error }}>{pollsError}</p>
      )}

      {!pollsLoading && !pollsError && tripId && (
        <>
          {activePoll ? (
            <div style={styles.pollPanel}>
              <div style={styles.pollHeader}>
                <div>
                  <span style={styles.pollStatus}>Active Poll · OPEN</span>
                  <p style={styles.pollDates}>
                    {formatDate(activePoll.startDate)} –{' '}
                    {formatDate(activePoll.endDate)} ·{' '}
                    {getDaysRemaining(activePoll.endDate)} days left
                  </p>
                </div>
                {isCoordinator && (
                  <div>
                    <button
                      type="button"
                      onClick={handleClosePoll}
                      disabled={closingPoll}
                      style={styles.closePollButton}
                    >
                      {closingPoll ? 'Closing…' : 'Close Poll'}
                    </button>
                    {closeError && <p style={styles.errorText}>{closeError}</p>}
                  </div>
                )}
              </div>
              <PollVoting
                poll={activePoll}
                proposals={proposals}
                accommodations={accommodations}
                myVote={myVote}
                userId={user.$id}
                onVoteSaved={handleVoteSaved}
                upsertVote={upsertVote}
              />
              <div style={styles.activeVotesSection}>
                <h4 style={styles.activeVotesHeading}>Votes so far</h4>
                <PollResults
                  poll={activePoll}
                  proposals={proposals}
                  votes={votes}
                />
              </div>
            </div>
          ) : isCoordinator && hasSubmittedProposals ? (
            <div style={styles.createSection}>
              <div style={styles.durationRow}>
                <label style={styles.label} htmlFor="pollDuration">
                  Poll duration:
                </label>
                <input
                  id="pollDuration"
                  type="number"
                  min="1"
                  max="30"
                  value={pollDuration}
                  onChange={(e) => setPollDuration(Number(e.target.value))}
                  style={styles.durationInput}
                />
                <span style={styles.daysLabel}>days</span>
                <button
                  type="button"
                  onClick={handleCreatePoll}
                  disabled={creatingPoll}
                  style={styles.createButton}
                >
                  {creatingPoll ? 'Creating…' : 'Create Poll'}
                </button>
              </div>
              {createError && <p style={styles.errorText}>{createError}</p>}
            </div>
          ) : null}

          {pastPolls.length > 0 && (
            <div style={styles.pastSection}>
              <h3 style={styles.pastHeading}>Past Polls</h3>
              {pastPolls.map((poll) => (
                <PastPoll
                  key={poll.$id}
                  poll={poll}
                  proposals={proposals}
                  tripId={tripId}
                  userId={user.$id}
                  listVotes={listVotes}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px',
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
  promptMessage: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '40px',
    textAlign: 'center',
    fontSize: '15px',
  },
  pollPanel: {
    border: borders.card,
    borderRadius: '12px',
    padding: '24px',
    background: colors.bgCard,
    marginBottom: '24px',
  },
  pollHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  pollStatus: {
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  pollDates: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    margin: '4px 0 0',
  },
  closePollButton: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: '1px solid rgba(255,107,107,0.3)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  pollColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  pollLeft: {},
  pollRight: {},
  activeVotesSection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: borders.subtle,
  },
  activeVotesHeading: {
    fontFamily: fonts.display,
    fontSize: '16px',
    fontWeight: '600',
    color: colors.textSecondary,
    margin: '0 0 12px',
  },
  createSection: {
    marginBottom: '24px',
  },
  durationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  durationInput: {
    width: '60px',
    padding: '8px 10px',
    borderRadius: '6px',
    border: borders.subtle,
    fontFamily: fonts.body,
    fontSize: '14px',
    textAlign: 'center',
  },
  daysLabel: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textSecondary,
    marginRight: '16px',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textPrimary,
    marginRight: '8px',
  },
  createButton: {
    padding: '10px 28px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '6px 0 0',
  },
  pastSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: borders.subtle,
  },
  pastHeading: {
    fontFamily: fonts.display,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.textSecondary,
    margin: '0 0 16px',
  },
} as const
