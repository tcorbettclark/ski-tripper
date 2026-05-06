import { useEffect, useRef, useState } from 'react'
import PollResults from './PollResults'
import { borders, colors, fonts, formStyles } from './theme'
import type { Poll, Proposal, Vote } from './types.d.ts'
import { formatDate } from './utils'

interface PastPollProps {
  poll: Poll
  proposals: Proposal[]
  tripId: string
  userId: string
  listVotes: (
    pollId: string,
    tripId: string,
    userId: string
  ) => Promise<{ votes: Vote[] }>
}

export default function PastPoll({
  poll,
  proposals,
  tripId,
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
    listVotes(poll.$id, tripId, userId)
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
  }, [poll.$id, tripId, userId, listVotes])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.status}>Poll · CLOSED</span>
        <span style={styles.dates}>
          {formatDate(poll.startDate)} – {formatDate(poll.endDate)}
        </span>
      </div>
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
} as const
