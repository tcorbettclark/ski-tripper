import type { Poll, Proposal, Vote } from '../shared/types.d'
import ProposalRow from './ProposalRow'
import { colors, fontSizes, fonts } from './theme'

interface VotingResultsProps {
  poll: Poll
  proposals: Proposal[]
  votes: Vote[]
}

export default function VotingResults({
  poll,
  proposals,
  votes,
}: VotingResultsProps) {
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
  const voterCount = votes.length

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {voterCount} {voterCount === 1 ? 'voter' : 'voters'}
      </div>
      <div style={styles.rows}>
        {sorted.map((proposalId) => {
          const proposal = proposalMap[proposalId]
          if (!proposal) return null
          const total = totals[proposalId]
          return (
            <ProposalRow key={proposalId} proposal={proposal} count={total} />
          )
        })}
      </div>
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
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
} as const
