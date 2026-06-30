import { useEffect, useMemo, useState } from 'react'
import type { Poll, Proposal, Vote } from '../shared/types.d'
import { upsertVote as _upsertVote } from './backend'
import ProposalRow from './ProposalRow'
import { borders, colors, fontSizes, fonts } from './theme'
import { toast } from './toast'
import { getErrorMessage } from './utils'

interface VotingActiveProps {
  poll: Poll
  proposals: Proposal[]
  myVote: Vote | null
  userId: string
  userName: string
  onVoteSaved: (vote: unknown) => void
  upsertVote?: (
    pollId: string,
    userId: string,
    userName: string,
    proposalIds: string[],
    tokenCounts: number[]
  ) => Promise<unknown>
}

export default function VotingActive({
  poll,
  proposals,
  myVote,
  userId,
  userName,
  onVoteSaved,
  upsertVote = _upsertVote,
}: VotingActiveProps) {
  const proposalMap = useMemo(
    () => Object.fromEntries(proposals.map((p) => [p.id, p])),
    [proposals]
  )
  const sortedProposalIds = useMemo(
    () =>
      [...poll.proposalIds].sort((a, b) =>
        (proposalMap[a]?.resortName || '').localeCompare(
          proposalMap[b]?.resortName || ''
        )
      ),
    [poll.proposalIds, proposalMap]
  )

  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    sortedProposalIds.forEach((id) => {
      init[id] = 0
    })
    if (myVote) {
      myVote.proposalIds.forEach((id, i) => {
        init[id] = myVote.tokenCounts[i] || 0
      })
    }
    return init
  })
  useEffect(() => {
    if (!myVote) return
    setAllocations((prev) => {
      const next: Record<string, number> = {}
      sortedProposalIds.forEach((id) => {
        next[id] =
          myVote.tokenCounts[myVote.proposalIds.indexOf(id)] ?? prev[id] ?? 0
      })
      return next
    })
  }, [myVote, sortedProposalIds])
  const [saving, setSaving] = useState(false)

  const maxTokens = sortedProposalIds.length
  const totalUsed = Object.values(allocations).reduce((a, b) => a + b, 0)
  const remaining = maxTokens - totalUsed

  const savedAllocations: Record<string, number> = {}
  if (myVote) {
    myVote.proposalIds.forEach((id, i) => {
      savedAllocations[id] = myVote.tokenCounts[i] || 0
    })
  }
  const isUnchanged =
    myVote &&
    sortedProposalIds.every(
      (id) => allocations[id] === (savedAllocations[id] || 0)
    )

  function handleAdd(proposalId: string) {
    setAllocations((prev) => ({ ...prev, [proposalId]: prev[proposalId] + 1 }))
  }

  function handleRemove(proposalId: string) {
    setAllocations((prev) => ({ ...prev, [proposalId]: prev[proposalId] - 1 }))
  }

  async function handleSave() {
    setSaving(true)
    const nonZeroIds = sortedProposalIds.filter((id) => allocations[id] > 0)
    try {
      const result = await upsertVote(
        poll.id,
        userId,
        userName,
        nonZeroIds,
        nonZeroIds.map((id) => allocations[id])
      )
      onVoteSaved(result)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const footerTokens = []
  for (let i = 0; i < maxTokens; i++) {
    footerTokens.push({ full: i >= totalUsed, slot: i })
  }

  return (
    <div style={styles.container}>
      <div style={styles.proposals}>
        {sortedProposalIds.map((proposalId) => {
          const count = allocations[proposalId]
          const proposal = proposalMap[proposalId]
          if (!proposal) return null
          return (
            <ProposalRow
              key={proposalId}
              proposal={proposal}
              count={count}
              remaining={remaining}
              saving={saving}
              showStepper
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          )
        })}
      </div>

      <div style={styles.footer}>
        <div style={styles.tokenBar}>
          {footerTokens.map((t) => (
            <span
              key={`f-${t.slot}`}
              style={t.full ? styles.tokenBarFull : styles.tokenBarEmpty}
            >
              🍺
            </span>
          ))}
          <span style={styles.footerText}>
            {remaining} of {maxTokens} tokens remaining
          </span>
        </div>
        <button
          type="button"
          data-testid="save-vote-btn"
          onClick={handleSave}
          disabled={saving || !!isUnchanged}
          style={{
            ...styles.saveButton,
            ...(isUnchanged ? styles.saveButtonDisabled : {}),
          }}
        >
          {saving ? 'Saving…' : 'Cast Vote'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { fontFamily: fonts.body },
  proposals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '14px',
    borderTop: borders.subtle,
  },
  tokenBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    flexWrap: 'wrap' as const,
  },
  tokenBarFull: {
    fontSize: fontSizes.md,
    lineHeight: '1',
  },
  tokenBarEmpty: {
    fontSize: fontSizes.md,
    lineHeight: '1',
    opacity: 0.5,
    filter: 'grayscale(0.5)',
  },
  footerText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginLeft: '8px',
  },
  saveButton: {
    padding: '7px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
  },
  saveButtonDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
} as const
