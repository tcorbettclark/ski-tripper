import { colors, fontSizes, fonts, mix } from './theme'
import type { Poll, Proposal, Vote } from './types.d.ts'

interface PollResultsProps {
  poll: Poll
  proposals: Proposal[]
  votes: Vote[]
}

export default function PollResults({
  poll,
  proposals,
  votes,
}: PollResultsProps) {
  const proposalMap = Object.fromEntries(proposals.map((p) => [p.id, p]))

  const totals: Record<string, number> = {}
  poll.proposalIds.forEach((id) => {
    totals[id] = 0
  })
  votes.forEach((vote) => {
    vote.proposalIds.forEach((proposalId, i) => {
      if (totals[proposalId] !== undefined) {
        totals[proposalId] += vote.tokenCounts[i] || 0
      }
    })
  })

  const sorted = [...poll.proposalIds].sort((a, b) =>
    (proposalMap[a]?.resortName || '').localeCompare(
      proposalMap[b]?.resortName || ''
    )
  )
  const maxTotal = Math.max(...Object.values(totals), 1)
  const voterCount = votes.length

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {voterCount} {voterCount === 1 ? 'vote' : 'votes'}
      </div>
      {sorted.map((proposalId) => {
        const proposal = proposalMap[proposalId]
        const total = totals[proposalId]
        const barWidth = `${Math.round((total / maxTotal) * 100)}%`
        return (
          <div key={proposalId} style={styles.row}>
            <div style={styles.label} data-testid="proposal-label">
              {proposal?.resortName || proposalId}
            </div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.bar, width: barWidth }} />
            </div>
            <div style={styles.total}>{total}</div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  container: { fontFamily: fonts.body },
  header: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '12px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr auto',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  label: { fontSize: fontSizes.base, color: colors.textData },
  barTrack: {
    background: mix('--color-accent', 0.1),
    borderRadius: '3px',
    height: '6px',
    overflow: 'hidden',
  },
  bar: {
    background: colors.accent,
    height: '100%',
    borderRadius: '3px',
  },
  total: {
    fontSize: fontSizes.base,
    color: colors.accent,
    fontWeight: '600',
    minWidth: '24px',
    textAlign: 'right',
  },
} as const
