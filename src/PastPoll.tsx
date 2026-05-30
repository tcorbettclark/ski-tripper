import { useEffect, useRef, useState } from 'react'
import PollResults from './PollResults'
import { borders, colors, fonts, formStyles } from './theme'
import type { Poll, Proposal, Vote } from './types.d.ts'
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
    listVotes(poll.$id, userId)
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
  }, [poll.$id, userId, listVotes])

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
          <span style={styles.outcomeIcon}>✔</span>
          <div style={styles.outcomeContent}>
            <span style={styles.outcomeLabel}>Outcome</span>
            <p style={styles.outcomeText}>{poll.outcome}</p>
          </div>
          <span style={styles.outcomeMeta}>
            Closed by {poll.pollCreatorUserName} ·{' '}
            {formatDateTime(poll.$updatedAt)}
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
    border: borders.subtle,
    borderRadius: '8px',
    padding: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  status: {
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  dates: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    margin: '10px 0 0',
  },
  outcomeBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginTop: '8px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(59,189,232,0.08)',
    border: borders.accent,
    marginBottom: '12px',
    position: 'relative' as const,
  },
  outcomeContent: {
    flex: 1,
    minWidth: 0,
  },
  outcomeIcon: {
    fontSize: '16px',
    color: colors.accent,
    lineHeight: '1.5',
    flexShrink: 0,
  },
  outcomeLabel: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  outcomeText: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textPrimary,
    margin: 0,
    lineHeight: '1.5',
  },
  outcomeMeta: {
    fontFamily: fonts.body,
    fontSize: '11px',
    color: colors.textSecondary,
    alignSelf: 'flex-end',
    whiteSpace: 'nowrap',
    marginLeft: 'auto',
    paddingLeft: '12px',
  },
} as const
