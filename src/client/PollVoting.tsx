import { useEffect, useMemo, useState } from 'react'
import { getCountryFlagUrl } from '../shared/countries'
import type { Poll, Proposal, Vote } from '../shared/types.d'
import { upsertVote as _upsertVote } from './backend'
import ProposalCard from './ProposalCard'
import { borders, colors, fontSizes, fonts, mix } from './theme'
import { toast } from './toast'
import { getErrorMessage } from './utils'

interface PollVotingProps {
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

export default function PollVoting({
  poll,
  proposals,
  myVote,
  userId,
  userName,
  onVoteSaved,
  upsertVote = _upsertVote,
}: PollVotingProps) {
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
          const name = proposal?.resortName || proposalId
          return (
            <ProposalRow
              key={proposalId}
              proposal={proposal}
              name={name}
              count={count}
              remaining={remaining}
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
            {remaining} of {maxTokens} votes remaining
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
          {saving ? 'Saving…' : 'Save Vote'}
        </button>
      </div>
    </div>
  )
}

function ProposalRow({
  proposal,
  name,
  count,
  remaining,
  onAdd,
  onRemove,
}: {
  proposal?: Proposal
  name: string
  count: number
  remaining: number
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [showPopup, setShowPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  if (!proposal) return null

  const flagUrl = proposal.country && getCountryFlagUrl(proposal.country)

  function handleMouseEnter(e: React.MouseEvent) {
    const x = e.clientX
    const y = e.clientY
    const spaceRight = window.innerWidth - x
    const spaceBelow = window.innerHeight - y
    setPopupPosition({
      x: spaceRight < 630 ? x - 630 : x + 10,
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

  const tokens = []
  for (let i = 0; i < count; i++) {
    tokens.push(i)
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
        {flagUrl && (
          <img src={flagUrl} alt={proposal.country} style={styles.flag} />
        )}
        <span style={styles.proposalName}>{name}</span>
      </div>
      <div style={styles.tokenRow} data-testid={`count-${proposal.id}`}>
        {tokens.map((i) => (
          <span key={`p-${i}`} style={styles.tokenFilled}>
            🍺
          </span>
        ))}
      </div>
      <div style={styles.stepper}>
        <button
          type="button"
          aria-label={`Remove vote from ${name}`}
          onClick={() => onRemove(proposal.id)}
          disabled={count === 0}
          style={{
            ...styles.stepperButton,
            ...(count === 0 ? styles.stepperButtonDisabled : {}),
          }}
        >
          −
        </button>
        <span
          data-testid={`count-text-${proposal.id}`}
          style={count > 0 ? styles.count : styles.countZero}
        >
          {count}
        </span>
        <button
          type="button"
          aria-label={`Add vote to ${name}`}
          onClick={() => onAdd(proposal.id)}
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
    border: borders.card,
    borderRadius: '10px',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 12px var(--color-shadow)',
  },
  proposalName: {
    fontSize: fontSizes.base,
    color: colors.textData,
    whiteSpace: 'nowrap' as const,
  },
  flag: {
    display: 'inline-block',
    width: '18px',
    height: '13px',
    objectFit: 'contain' as const,
    verticalAlign: 'middle',
  },
  infoButtonWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  infoButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    cursor: 'pointer',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.15s',
  },
  tokenRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
  },
  tokenFilled: {
    fontSize: fontSizes.base,
    lineHeight: '1',
  },
  stepper: { display: 'flex', alignItems: 'center', gap: '10px' },
  stepperButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: `1.5px solid ${mix('--color-accent', 0.5)}`,
    background: mix('--color-accent', 0.15),
    color: colors.accent,
    fontSize: fontSizes.md,
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
    fontSize: fontSizes.base,
    color: colors.accent,
    fontWeight: '600',
    minWidth: '16px',
    textAlign: 'center',
  },
  countZero: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
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
    background: 'var(--color-overlay)',
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
    maxWidth: '800px',
    width: 'min(90vw, 800px)',
    maxHeight: '70vh',
    overflow: 'auto',
    boxShadow: '0 16px 48px var(--color-shadow)',
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
    fontSize: fontSizes.xl,
    cursor: 'pointer',
    lineHeight: '1',
    padding: '0',
    zIndex: 1,
  },
} as const
