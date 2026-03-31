import { useEffect, useState, useCallback, useRef } from 'react'
import {
  listPolls as _listPolls,
  listProposals as _listProposals,
  listVotes as _listVotes,
  createPoll as _createPoll,
  closePoll as _closePoll,
  upsertVote as _upsertVote,
  getCoordinatorParticipant as _getCoordinatorParticipant,
} from './backend'
import type { Models } from 'appwrite'
import PollVoting from './PollVoting'
import PollResults from './PollResults'
import { colors, fonts, borders } from './theme'

interface Proposal {
  $id: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  resortName?: string
}

interface PollDoc {
  $id: string
  tripId: string
  state: 'OPEN' | 'CLOSED'
  proposalIds: string[]
}

interface Vote {
  $id: string
  VoterUserId: string
  proposalIds: string[]
  tokenCounts: number[]
}

interface PollProps {
  user: Models.User
  tripId: string
  listPolls?: (
    tripId: string,
    userId: string
  ) => Promise<{ documents: PollDoc[] }>
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ documents: Proposal[] }>
  listVotes?: (
    pollId: string,
    tripId: string,
    userId: string
  ) => Promise<{ documents: Vote[] }>
  createPoll?: (
    tripId: string,
    userId: string,
    userName: string
  ) => Promise<PollDoc>
  closePoll?: (pollId: string, userId: string) => Promise<PollDoc>
  upsertVote?: (
    pollId: string,
    tripId: string,
    userId: string,
    proposalIds: string[],
    tokenCounts: number[]
  ) => Promise<Vote>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ documents: Array<{ ParticipantUserId: string }> }>
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
}: PollProps) {
  const [loading, setLoading] = useState(true)
  const [activePoll, setActivePoll] = useState<PollDoc | null>(null)
  const [pastPolls, setPastPolls] = useState<PollDoc[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [pollsLoading, setPollsLoading] = useState(false)
  const [pollsError, setPollsError] = useState('')
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [createError, setCreateError] = useState('')
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
          coordResult.documents.length > 0 &&
            coordResult.documents[0].ParticipantUserId === user.$id
        )
        setProposals(proposalsResult.documents)
        const open =
          pollsResult.documents.find((p) => p.state === 'OPEN') || null
        const past = pollsResult.documents.filter((p) => p.state === 'CLOSED')
        setActivePoll(open)
        setPastPolls(past)
        if (open) {
          const votesResult = await listVotes(open.$id, tripId, user.$id)
          if (mountedRef.current) setVotes(votesResult.documents)
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
      const poll = await createPoll(tripId, user.$id, user.name || '')
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
  const myVote = votes.find((v) => v.VoterUserId === user.$id) || null

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
                <span style={styles.pollStatus}>Active Poll · OPEN</span>
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
              <button
                type="button"
                onClick={handleCreatePoll}
                disabled={creatingPoll}
                style={styles.createButton}
              >
                {creatingPoll ? 'Creating…' : 'Create Poll'}
              </button>
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

function PastPoll({
  poll,
  proposals,
  tripId,
  userId,
  listVotes,
}: {
  poll: PollDoc
  proposals: Proposal[]
  tripId: string
  userId: string
  listVotes: (
    pollId: string,
    tripId: string,
    userId: string
  ) => Promise<{ documents: Vote[] }>
}) {
  const [expanded, setExpanded] = useState(false)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (!expanded && votes.length === 0) {
      setLoading(true)
      try {
        const result = await listVotes(poll.$id, tripId, userId)
        setVotes(result.documents)
      } finally {
        setLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <div style={pastStyles.container}>
      <button type="button" onClick={handleToggle} style={pastStyles.toggle}>
        Poll · CLOSED {expanded ? '▲' : '▼'}
      </button>
      {expanded &&
        (loading ? (
          <p style={pastStyles.loading}>Loading…</p>
        ) : (
          <PollResults poll={poll} proposals={proposals} votes={votes} />
        ))}
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

const pastStyles = {
  container: {
    marginBottom: '16px',
    border: borders.subtle,
    borderRadius: '8px',
    padding: '14px',
  },
  toggle: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    margin: '10px 0 0',
  },
} as const
