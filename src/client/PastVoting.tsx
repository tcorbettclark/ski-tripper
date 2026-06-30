import { Gavel } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Poll, Proposal, Vote } from '../shared/types.d'
import { borders, colors, fontSizes, fonts, mix } from './theme'
import { toast } from './toast'
import { formatDate, formatDateTime, getErrorMessage } from './utils'
import VotingResults from './VotingResults'

interface PastVotingProps {
  poll: Poll
  proposals: Proposal[]
  userId: string
  listVotes: (pollId: string, userId: string) => Promise<{ votes: Vote[] }>
}

export default function PastVoting({
  poll,
  proposals,
  userId,
  listVotes,
}: PastVotingProps) {
  const [expanded, setExpanded] = useState(false)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(false)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    listVotes(poll.id, userId)
      .then((result) => {
        if (!mountedRef.current) return
        setVotes(result.votes)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        toast(getErrorMessage(err), 'error')
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
    return () => {
      mountedRef.current = false
    }
  }, [poll.id, userId, listVotes])

  function handleToggle() {
    setExpanded((prev) => !prev)
  }

  const voterCount = votes.length
  const voterLabel = voterCount === 1 ? '1 voter' : `${voterCount} voters`

  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={handleToggle}
        style={styles.headerButton}
        aria-expanded={expanded}
      >
        <div style={styles.headerLeft}>
          <span style={styles.status}>Voting · CLOSED</span>
          <span style={styles.dates}>
            {formatDate(poll.startDate)} – {formatDate(poll.endDate)}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.voterCount}>{voterLabel}</span>
          <span style={styles.chevron}>{expanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {expanded && (
        <div style={styles.content}>
          {poll.outcome && (
            <div style={styles.outcomeBox}>
              <Gavel size={16} style={styles.outcomeIcon} />
              <div style={styles.outcomeContent}>
                <span style={styles.outcomeLabel}>Outcome</span>
                <p style={styles.outcomeText}>{poll.outcome}</p>
              </div>
              <span style={styles.outcomeMeta}>
                Closed by {poll.pollCreatorUserName} ·{' '}
                {formatDateTime(poll.updated)}
              </span>
            </div>
          )}
          {loading && votes.length === 0 ? (
            <p style={styles.loading}>Loading…</p>
          ) : (
            <VotingResults poll={poll} proposals={proposals} votes={votes} />
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    marginBottom: '16px',
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    boxShadow: '0 2px 12px var(--color-shadow)',
    overflow: 'hidden',
  },
  headerButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: fonts.body,
    textAlign: 'left',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  status: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  dates: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  voterCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  content: {
    padding: '0 20px 20px',
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    margin: '10px 0 0',
  },
  outcomeBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '16px',
    padding: '10px 14px',
    borderRadius: '6px',
    borderLeft: `3px solid ${colors.accent}`,
    background: mix('--color-accent', 0.06),
  },
  outcomeContent: {
    flex: 1,
    minWidth: 0,
  },
  outcomeIcon: {
    fontSize: fontSizes.md,
    color: colors.accent,
    lineHeight: '1.5',
    flexShrink: 0,
  },
  outcomeLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  outcomeText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    margin: 0,
    lineHeight: '1.5',
  },
  outcomeMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    alignSelf: 'flex-end',
    whiteSpace: 'nowrap',
    marginLeft: 'auto',
    paddingLeft: '12px',
  },
} as const
