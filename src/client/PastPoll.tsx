import { Gavel } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Poll, Proposal, Vote } from '../shared/types.d'
import PollResults from './PollResults'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import { formatDate, formatDateTime } from './utils'

interface PastPollProps {
  poll: Poll
  proposals: Proposal[]
  userId: string
  listVotes: (pollId: string, userId: string) => Promise<{ votes: Vote[] }>
}

export default function PastPoll({
  poll,
  proposals,
  userId,
  listVotes,
}: PastPollProps) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    listVotes(poll.id, userId)
      .then(async (result) => {
        if (!mountedRef.current) return
        setVotes(result.votes)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [poll.id, userId, listVotes])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.status}>Poll · CLOSED</span>
        <span style={styles.dates}>
          {formatDate(poll.startDate)} – {formatDate(poll.endDate)}
        </span>
      </div>
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
      {error && <p style={formStyles.error}>{error}</p>}
      {loading ? (
        <p style={styles.loading}>Loading…</p>
      ) : !error ? (
        <PollResults poll={poll} proposals={proposals} votes={votes} />
      ) : null}
    </div>
  )
}

const styles = {
  container: {
    marginBottom: '16px',
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '24px',
    boxShadow: '0 2px 12px var(--color-shadow)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
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
    marginTop: '8px',
    padding: '10px 14px',
    borderRadius: '6px',
    borderLeft: `3px solid ${colors.accent}`,
    background: mix('--color-accent', 0.06),
    marginBottom: '12px',
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
