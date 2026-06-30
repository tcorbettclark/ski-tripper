import { useCallback, useEffect, useRef, useState } from 'react'
import type { Poll as PollType, Proposal, User, Vote } from '../shared/types.d'
import {
  closePoll as _closePoll,
  createPoll as _createPoll,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  listPolls as _listPolls,
  listProposals as _listProposals,
  listVotes as _listVotes,
  upsertVote as _upsertVote,
} from './backend'
import PastVoting from './PastVoting'
import { borders, colors, fontSizes, fonts, mix } from './theme'
import { toast } from './toast'
import useIsSmallScreen from './useIsSmallScreen'
import { formatCountdown, formatDate, getErrorMessage } from './utils'
import VotingActive from './VotingActive'
import VotingResults from './VotingResults'

interface VotingProps {
  user: User
  tripId: string
  onActivePollChange?: (endDate: string | null) => void
  listPolls?: (tripId: string, userId: string) => Promise<{ polls: PollType[] }>
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ proposals: Proposal[] }>
  listVotes?: (pollId: string, userId: string) => Promise<{ votes: Vote[] }>
  createPoll?: (
    tripId: string,
    userId: string,
    userName: string,
    durationDays: number
  ) => Promise<PollType>
  closePoll?: (
    pollId: string,
    userId: string,
    outcome: string
  ) => Promise<PollType>
  upsertVote?: (
    pollId: string,
    userId: string,
    userName: string,
    proposalIds: string[],
    tokenCounts: number[]
  ) => Promise<Vote>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ user: string }> }>
}

export default function Voting({
  user,
  tripId,
  onActivePollChange,
  listPolls = _listPolls,
  listProposals = _listProposals,
  listVotes = _listVotes,
  createPoll = _createPoll,
  closePoll = _closePoll,
  upsertVote = _upsertVote,
  getCoordinatorParticipant = _getCoordinatorParticipant,
}: VotingProps) {
  const isSmall = useIsSmallScreen()
  const [loading, setLoading] = useState(true)
  const [activePoll, setActivePoll] = useState<PollType | null>(null)
  const [pastPolls, setPastPolls] = useState<PollType[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [pollDuration, setPollDuration] = useState(7)
  const [closingPoll, setClosingPoll] = useState(false)
  const [outcomeText, setOutcomeText] = useState('')
  const [showOutcomeForm, setShowOutcomeForm] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!activePoll) {
      setCountdown(null)
      return
    }
    function tick() {
      if (!mountedRef.current || !activePoll) return
      setCountdown(formatCountdown(activePoll.endDate))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activePoll])

  useEffect(() => {
    if (!tripId) {
      setActivePoll(null)
      setPastPolls([])
      setProposals([])
      setVotes([])
      setIsCoordinator(false)
      setLoading(false)
      onActivePollChange?.(null)
      return
    }
    setLoading(true)
    Promise.all([
      getCoordinatorParticipant(tripId),
      listProposals(tripId, user.id),
      listPolls(tripId, user.id),
    ])
      .then(async ([coordResult, proposalsResult, pollsResult]) => {
        if (!mountedRef.current) return
        setIsCoordinator(
          coordResult.participants.length > 0 &&
            coordResult.participants[0].user === user.id
        )
        setProposals(proposalsResult.proposals)
        const open = pollsResult.polls.find((p) => p.state === 'OPEN') || null
        const past = pollsResult.polls.filter((p) => p.state === 'CLOSED')
        setActivePoll(open)
        setPastPolls(past)
        onActivePollChange?.(open?.endDate || null)
        if (open) {
          const votesResult = await listVotes(open.id, user.id)
          if (mountedRef.current) setVotes(votesResult.votes)
        }
      })
      .catch((err) => {
        if (mountedRef.current) toast(getErrorMessage(err), 'error')
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [
    tripId,
    user.id,
    getCoordinatorParticipant,
    listProposals,
    listPolls,
    listVotes,
    onActivePollChange,
  ])

  const handleVoteSaved = useCallback((vote: unknown) => {
    const v = vote as Vote
    setVotes((prev) => {
      const exists = prev.find((x) => x.id === v.id)
      return exists ? prev.map((x) => (x.id === v.id ? v : x)) : [...prev, v]
    })
  }, [])

  async function handleCreatePoll() {
    setCreatingPoll(true)
    try {
      const poll = await createPoll(
        tripId,
        user.id,
        user.name || '',
        pollDuration
      )
      setActivePoll(poll)
      setVotes([])
      onActivePollChange?.(poll.endDate)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setCreatingPoll(false)
    }
  }

  async function handleClosePoll() {
    if (!activePoll) return
    setClosingPoll(true)
    try {
      const closed = await closePoll(activePoll.id, user.id, outcomeText)
      setActivePoll(null)
      setPastPolls((p) => [closed, ...p])
      onActivePollChange?.(null)
      setShowOutcomeForm(false)
      setOutcomeText('')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setClosingPoll(false)
    }
  }

  const hasSubmittedProposals = proposals.some((p) => p.state === 'SUBMITTED')
  const myVote = votes.find((v) => v.voter === user.id) || null

  if (loading) return <p style={styles.message}>Loading…</p>

  return (
    <div
      style={{
        ...styles.container,
        padding: isSmall ? '16px 20px' : '40px 48px',
      }}
    >
      <div style={styles.toolbar}>
        <h1 style={styles.heading}>Voting</h1>
      </div>

      {tripId && (
        <>
          {activePoll ? (
            <div style={styles.votingPanel}>
              <div style={styles.statusLine}>
                <div style={styles.statusInfo}>
                  <span style={styles.statusBadge}>OPEN</span>
                  <span style={styles.statusDates}>
                    {formatDate(activePoll.startDate)} –{' '}
                    {formatDate(activePoll.endDate)}
                  </span>
                  {countdown && (
                    <span style={styles.countdownText}>
                      closes in {countdown}
                    </span>
                  )}
                </div>
                {isCoordinator && !showOutcomeForm && (
                  <button
                    type="button"
                    data-testid="close-poll-btn"
                    onClick={() => setShowOutcomeForm(true)}
                    style={styles.closeButton}
                  >
                    Close Voting
                  </button>
                )}
              </div>

              {isCoordinator && showOutcomeForm && (
                <div style={styles.outcomeForm}>
                  <label htmlFor="outcome" style={styles.outcomeLabel}>
                    Outcome:
                  </label>
                  <textarea
                    id="outcome"
                    value={outcomeText}
                    onChange={(e) => setOutcomeText(e.target.value)}
                    placeholder="Which proposals are through and which are rejected..."
                    style={styles.outcomeTextarea}
                  />
                  <div style={styles.outcomeActions}>
                    <button
                      type="button"
                      data-testid="confirm-close-poll-btn"
                      onClick={handleClosePoll}
                      disabled={closingPoll || !outcomeText.trim()}
                      style={styles.outcomeSubmitButton}
                    >
                      {closingPoll ? 'Closing…' : 'Confirm Close'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOutcomeForm(false)
                        setOutcomeText('')
                      }}
                      disabled={closingPoll}
                      style={styles.outcomeCancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <VotingActive
                poll={activePoll}
                proposals={proposals}
                myVote={myVote}
                userId={user.id}
                userName={user.name}
                onVoteSaved={handleVoteSaved}
                upsertVote={upsertVote}
              />
              <div style={styles.activeResultsSection}>
                <h2 style={styles.activeResultsHeading}>Votes so far</h2>
                <VotingResults
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
                  Voting duration:
                </label>
                <input
                  id="pollDuration"
                  type="number"
                  min="1"
                  max="30"
                  data-testid="poll-duration"
                  value={pollDuration}
                  onChange={(e) => setPollDuration(Number(e.target.value))}
                  style={styles.durationInput}
                />
                <span style={styles.daysLabel}>days</span>
                <button
                  type="button"
                  data-testid="create-poll-btn"
                  onClick={handleCreatePoll}
                  disabled={creatingPoll}
                  style={styles.createButton}
                >
                  {creatingPoll ? 'Creating…' : 'Start Voting'}
                </button>
              </div>
            </div>
          ) : (
            <p style={styles.promptMessage}>
              {isCoordinator
                ? 'No open voting. Submit proposals to enable voting.'
                : 'No open voting yet. The coordinator will start one when ready.'}
            </p>
          )}

          {pastPolls.length > 0 && (
            <div style={styles.pastSection}>
              <h2 style={styles.pastHeading}>Past Voting Rounds</h2>
              {pastPolls.map((poll) => (
                <PastVoting
                  key={poll.id}
                  poll={poll}
                  proposals={proposals}
                  userId={user.id}
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
    fontSize: fontSizes.md,
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
    fontSize: fontSizes['2xl'],
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
    fontSize: fontSizes.md,
  },
  votingPanel: {
    border: borders.card,
    borderRadius: '12px',
    padding: '24px',
    background: colors.bgCard,
    marginBottom: '24px',
    boxShadow: '0 2px 12px var(--color-shadow)',
  },
  statusLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: borders.subtle,
  },
  statusInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  statusBadge: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.bgPrimary,
    background: colors.accent,
    padding: '3px 10px',
    borderRadius: '4px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  statusDates: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  countdownText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: '600',
  },
  closeButton: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: `1px solid ${mix('--color-error', 0.3)}`,
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
  },
  outcomeForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
    padding: '16px',
    background: mix('--color-accent', 0.04),
    borderRadius: '8px',
    border: borders.subtle,
  },
  outcomeLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  outcomeTextarea: {
    width: '100%',
    minHeight: '80px',
    padding: '8px 10px',
    borderRadius: '6px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    resize: 'vertical',
  },
  outcomeActions: {
    display: 'flex',
    gap: '8px',
  },
  outcomeSubmitButton: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
  },
  outcomeCancelButton: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: borders.subtle,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
  },
  activeResultsSection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: borders.subtle,
  },
  activeResultsHeading: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
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
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center',
  },
  daysLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginRight: '16px',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
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
    fontSize: fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
  },
  pastSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: borders.subtle,
  },
  pastHeading: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textSecondary,
    margin: '0 0 16px',
  },
} as const
