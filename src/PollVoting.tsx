import { useState } from 'react'
import { upsertVote as _upsertVote } from './backend'
import ProposalCard from './ProposalCard'
import { borders, colors, fonts, formStyles } from './theme'
import type { Accommodation, Poll, Proposal, Vote } from './types.d.ts'

interface PollVotingProps {
  poll: Poll
  proposals: Proposal[]
  accommodations?: Record<string, Accommodation[]>
  myVote: Vote | null
  userId: string
  onVoteSaved: (vote: unknown) => void
  upsertVote?: (
    pollId: string,
    tripId: string,
    userId: string,
    proposalIds: string[],
    tokenCounts: number[]
  ) => Promise<unknown>
}

export default function PollVoting({
  poll,
  proposals,
  accommodations = {},
  myVote,
  userId,
  onVoteSaved,
  upsertVote = _upsertVote,
}: PollVotingProps) {
  const proposalMap = Object.fromEntries(proposals.map((p) => [p.$id, p]))
  const sortedProposalIds = [...poll.proposalIds].sort((a, b) =>
    (proposalMap[a]?.resortName || '').localeCompare(
      proposalMap[b]?.resortName || ''
    )
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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
    setSaveError(null)
    const nonZeroIds = sortedProposalIds.filter((id) => allocations[id] > 0)
    try {
      const result = await upsertVote(
        poll.$id,
        poll.tripId,
        userId,
        nonZeroIds,
        nonZeroIds.map((id) => allocations[id])
      )
      onVoteSaved(result)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.proposals}>
        {sortedProposalIds.map((proposalId) => {
          const count = allocations[proposalId]
          const proposal = proposalMap[proposalId]
          const name = proposal?.resortName || proposalId
          return (
            <ProposalRow
              key={proposalId}
              proposal={proposal}
              name={name}
              count={count}
              remaining={remaining}
              accommodations={accommodations[proposalId] || []}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          )
        })}
      </div>

      <div style={styles.footer}>
        <span style={styles.footerText}>
          {totalUsed} of {maxTokens} votes placed
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !!isUnchanged}
          style={{
            ...styles.saveButton,
            ...(isUnchanged ? styles.saveButtonDisabled : {}),
          }}
        >
          {saving ? 'Saving…' : 'Save Vote'}
        </button>
      </div>
      {saveError && <p style={formStyles.error}>{saveError}</p>}
    </div>
  )
}

function ProposalRow({
  proposal,
  name,
  count,
  remaining,
  accommodations,
  onAdd,
  onRemove,
}: {
  proposal?: Proposal
  name: string
  count: number
  remaining: number
  accommodations: Accommodation[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [showPopup, setShowPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  if (!proposal) return null

  function handleMouseEnter(e: React.MouseEvent) {
    const x = e.clientX
    const y = e.clientY
    const spaceRight = window.innerWidth - x
    const spaceBelow = window.innerHeight - y
    setPopupPosition({
      x: spaceRight < 315 ? x - 315 : x + 10,
      y: spaceBelow < 375 ? y - 10 : y + 20,
    })
    setShowPopup(true)
  }

  function handleMouseLeave() {
    setShowPopup(false)
  }

  function handleTouchShow() {
    setIsTouchDevice(true)
    setPopupPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    setShowPopup(true)
  }

  function closePopup() {
    setShowPopup(false)
  }

  return (
    <div style={styles.proposalCard}>
      <div style={styles.infoButtonWrap}>
        <button
          type="button"
          aria-label={`View details for ${name}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchShow}
          style={styles.infoButton}
        >
          ⓘ
        </button>
        <span style={styles.proposalName}>{name}</span>
      </div>
      <div style={styles.stepper}>
        <button
          type="button"
          aria-label={`Remove vote from ${name}`}
          onClick={() => onRemove(proposal.$id)}
          disabled={count === 0}
          style={{
            ...styles.stepperButton,
            ...(count === 0 ? styles.stepperButtonDisabled : {}),
          }}
        >
          −
        </button>
        <span
          data-testid={`count-${proposal.$id}`}
          style={count > 0 ? styles.count : styles.countZero}
        >
          {count}
        </span>
        <button
          type="button"
          aria-label={`Add vote to ${name}`}
          onClick={() => onAdd(proposal.$id)}
          disabled={remaining === 0}
          style={{
            ...styles.stepperButton,
            ...(remaining === 0 ? styles.stepperButtonDisabled : {}),
          }}
        >
          +
        </button>
      </div>

      {showPopup && (
        <div
          role="dialog"
          aria-modal="true"
          style={
            isTouchDevice
              ? popupStyles.touchBackdrop
              : popupStyles.popoverBackdrop
          }
          onClick={isTouchDevice ? closePopup : undefined}
          onMouseLeave={isTouchDevice ? undefined : () => setShowPopup(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closePopup()
          }}
        >
          <div
            role="document"
            style={{
              ...popupStyles.popup,
              ...(isTouchDevice
                ? { transformOrigin: 'center center' }
                : {
                    left: popupPosition.x,
                    top: popupPosition.y,
                  }),
            }}
          >
            {isTouchDevice && (
              <button
                type="button"
                onClick={closePopup}
                style={popupStyles.closeButton}
                aria-label="Close"
              >
                ×
              </button>
            )}
            <ProposalCard
              proposal={proposal}
              userId=""
              previewMode
              accommodations={accommodations}
              onUpdated={() => {}}
              onDeleted={() => {}}
              onSubmitted={() => {}}
            />
          </div>
        </div>
      )}
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
  proposalCard: {
    padding: '12px 14px',
    background: colors.bgCard,
    border: '1px solid rgba(100,190,230,0.12)',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proposalName: { fontSize: '14px', color: colors.textData },
  infoButtonWrap: { display: 'flex', alignItems: 'center', gap: '4px' },
  infoButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.15s',
  },
  stepper: { display: 'flex', alignItems: 'center', gap: '10px' },
  stepperButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1.5px solid rgba(59,189,232,0.5)',
    background: 'rgba(59,189,232,0.08)',
    color: colors.accent,
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    fontFamily: fonts.body,
  },
  stepperButtonDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
  count: {
    fontSize: '14px',
    color: colors.accent,
    fontWeight: '600',
    minWidth: '16px',
    textAlign: 'center',
  },
  countZero: {
    fontSize: '14px',
    color: 'rgba(106,148,174,0.4)',
    fontWeight: '600',
    minWidth: '16px',
    textAlign: 'center',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '14px',
    borderTop: borders.subtle,
  },
  footerText: { fontSize: '12px', color: colors.textSecondary },
  saveButton: {
    padding: '7px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  saveButtonDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
} as const

const popupStyles = {
  popoverBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'transparent',
    pointerEvents: 'none' as const,
    zIndex: 1000,
  },
  touchBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(4,12,24,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  popup: {
    position: 'fixed' as const,
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '20px 24px',
    maxWidth: '400px',
    width: '90%',
    maxHeight: '70vh',
    overflow: 'auto',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    pointerEvents: 'auto' as const,
    transform: 'scale(0.75)',
    transformOrigin: 'top left',
  },
  closeButton: {
    position: 'absolute' as const,
    top: '12px',
    right: '16px',
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1',
    padding: '0',
    zIndex: 1,
  },
} as const
