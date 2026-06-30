import { useState } from 'react'
import { getCountryFlagUrl } from '../shared/countries'
import type { Proposal } from '../shared/types.d'
import ProposalCard from './ProposalCard'
import { borders, colors, fontSizes, fonts, mix } from './theme'

interface ProposalRowProps {
  proposal: Proposal
  count?: number
  remaining?: number
  saving?: boolean
  showStepper?: boolean
  onAdd?: (id: string) => void
  onRemove?: (id: string) => void
}

export default function ProposalRow({
  proposal,
  count = 0,
  remaining = 0,
  saving = false,
  showStepper = false,
  onAdd,
  onRemove,
}: ProposalRowProps) {
  const [showPopup, setShowPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const flagUrl = proposal.country && getCountryFlagUrl(proposal.country)
  const name = proposal.resortName

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
    <div style={styles.row}>
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
      {showStepper && (
        <div style={styles.stepper}>
          <button
            type="button"
            aria-label={`Remove token from ${name}`}
            onClick={() => onRemove?.(proposal.id)}
            disabled={saving || count === 0}
            style={{
              ...styles.stepperButton,
              ...(saving || count === 0 ? styles.stepperButtonDisabled : {}),
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
            aria-label={`Add token to ${name}`}
            onClick={() => onAdd?.(proposal.id)}
            disabled={saving || remaining === 0}
            style={{
              ...styles.stepperButton,
              ...(saving || remaining === 0
                ? styles.stepperButtonDisabled
                : {}),
            }}
          >
            +
          </button>
        </div>
      )}
      {!showStepper && <div style={styles.totalBadge}>{count}</div>}

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
  row: {
    padding: '12px 14px',
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
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
  totalBadge: {
    fontSize: fontSizes.base,
    color: colors.accent,
    fontWeight: '600',
    minWidth: '24px',
    textAlign: 'right',
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
    borderRadius: '12px',
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
