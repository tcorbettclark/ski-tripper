import { useState, useEffect } from 'react'
import { colors, fonts, borders } from './theme'

interface Proposal {
  $id: string
  resortName?: string
  country?: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  altitudeRange?: string
  nearestAirport?: string
  transferTime?: string
  approximateCost?: string
  accommodationName?: string
  accommodationUrl?: string
  description?: string
  ProposerUserName?: string
}

interface ProposalViewerProps {
  proposals: Proposal[]
  initialIndex: number
  onClose: () => void
}

export default function ProposalViewer({
  proposals,
  initialIndex,
  onClose,
}: ProposalViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const proposal = proposals[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === proposals.length - 1
  const isDraft = proposal.state === 'DRAFT'

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setCurrentIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') {
        setCurrentIndex((i) => Math.min(proposals.length - 1, i + 1))
      } else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [proposals.length, onClose])

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return
    const delta = e.changedTouches[0].clientX - touchStartX
    if (delta > 50) setCurrentIndex((i) => Math.max(0, i - 1))
    else if (delta < -50) {
      setCurrentIndex((i) => Math.min(proposals.length - 1, i + 1))
    }
    setTouchStartX(null)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      style={styles.backdrop}
    >
      <button
        type="button"
        aria-label="Previous proposal"
        onClick={(e) => {
          e.stopPropagation()
          setCurrentIndex((i) => Math.max(0, i - 1))
        }}
        disabled={isFirst}
        style={{
          ...styles.arrowButton,
          ...(isFirst ? styles.arrowDisabled : {}),
        }}
      >
        ‹
      </button>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops click propagation from backdrop */}
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={styles.card}
      >
        <div style={styles.headerRow}>
          <div>
            <div style={styles.counter}>
              {currentIndex + 1} of {proposals.length}
            </div>
            <div id="viewer-title" style={styles.resortName}>
              {proposal.resortName || '—'}
            </div>
            <div style={styles.subHeader}>
              <span>{proposal.country || '—'}</span>
              {proposal.country && proposal.state && ' · '}
              <span style={isDraft ? styles.badgeDraft : styles.badgeSubmitted}>
                {proposal.state}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>

        <div style={styles.grid}>
          <Field label="Altitude Range" value={proposal.altitudeRange} />
          <Field label="Nearest Airport" value={proposal.nearestAirport} />
          <Field label="Transfer Time" value={proposal.transferTime} />
          <Field label="Approx. Cost" value={proposal.approximateCost} />
          <div style={{ gridColumn: '1/-1' }}>
            <div style={styles.fieldLabel}>Accommodation</div>
            <div style={styles.fieldValue}>
              {proposal.accommodationName || '—'}
              {proposal.accommodationUrl && (
                <>
                  {' '}
                  <a
                    href={proposal.accommodationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    ↗ link
                  </a>
                </>
              )}
            </div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Description" value={proposal.description} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={styles.fieldLabel}>Proposed By</div>
            <div style={styles.fieldValue}>
              {proposal.ProposerUserName || '—'}
            </div>
          </div>
        </div>

        <div style={styles.dots}>
          {proposals.map((proposal, i) => (
            <div
              key={proposal.$id}
              aria-hidden="true"
              style={i === currentIndex ? styles.dotActive : styles.dotInactive}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Next proposal"
        onClick={(e) => {
          e.stopPropagation()
          setCurrentIndex((i) => Math.min(proposals.length - 1, i + 1))
        }}
        disabled={isLast}
        style={{
          ...styles.arrowButton,
          ...(isLast ? styles.arrowDisabled : {}),
        }}
      >
        ›
      </button>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value || '—'}</div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(4,12,24,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    gap: '16px',
  },
  arrowButton: {
    background: 'rgba(13,30,48,0.9)',
    border: borders.accent,
    color: colors.accent,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    fontSize: '22px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: fonts.body,
  },
  arrowDisabled: {
    opacity: 0.25,
    cursor: 'default',
  },
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '28px 32px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  counter: {
    fontFamily: fonts.body,
    fontSize: '11px',
    color: colors.textSecondary,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  resortName: {
    fontFamily: fonts.display,
    fontSize: '24px',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subHeader: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    marginTop: '4px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '22px',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '4px',
    fontFamily: fonts.body,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 24px',
    marginBottom: '20px',
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: '10px',
    color: colors.textSecondary,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  fieldValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
    lineHeight: '1.5',
  },
  link: {
    color: colors.accent,
    fontSize: '12px',
    textDecoration: 'none',
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    paddingTop: '4px',
  },
  dotActive: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: colors.accent,
  },
  dotInactive: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'rgba(59,189,232,0.25)',
  },
  badgeDraft: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.textSecondary,
    background: 'rgba(106,148,174,0.15)',
    border: '1px solid rgba(106,148,174,0.2)',
  },
  badgeSubmitted: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.accent,
    background: 'rgba(59,189,232,0.12)',
    border: '1px solid rgba(59,189,232,0.25)',
  },
} as const
