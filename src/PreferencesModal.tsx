import { useState } from 'react'
import PreferencesForm from './PreferencesForm'
import { borders, colors, fonts } from './theme'
import type { Preferences } from './types.d'

interface PreferencesModalProps {
  userId: string
  initial: Preferences | null
  open: boolean
  onClose: () => void
  onSaved: (preferences: Preferences) => void
  createPreferences?: (
    userId: string,
    data: Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>
  ) => Promise<Preferences>
  updatePreferences?: (
    userId: string,
    data: Partial<
      Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>
    >
  ) => Promise<Preferences>
}

export default function PreferencesModal({
  userId,
  initial,
  open,
  onClose,
  onSaved,
  createPreferences,
  updatePreferences,
}: PreferencesModalProps) {
  const [savedPreferences, setSavedPreferences] = useState<Preferences | null>(
    initial
  )

  if (!open) return null

  const display = savedPreferences ?? initial

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="document"
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>Preferences</h3>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {display && (
          <div style={styles.readOnly}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Ski / Snowboard</span>
              <span style={styles.detailValue}>
                {display.skiSnowboard
                  ? JSON.parse(display.skiSnowboard).join(', ')
                  : '—'}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Difficulty</span>
              <span style={styles.detailValue}>
                {display.difficulty
                  ? JSON.parse(display.difficulty).join(', ')
                  : '—'}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Piste</span>
              <span style={styles.detailValue}>
                {display.piste ? JSON.parse(display.piste).join(', ') : '—'}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Time Allocation</span>
              <span style={styles.detailValue}>
                Slopes {display.timeSlopes}%, Eating {display.timeEating}%,
                Après {display.timeApres}%, Hotel Chill {display.timeHotel}%
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Accommodation</span>
              <span style={styles.detailValue}>
                {display.accommodation
                  ? JSON.parse(display.accommodation).join(', ')
                  : '—'}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Most Important</span>
              <span style={styles.detailValue}>
                {display.mostImportantAspect || '—'}
              </span>
            </div>
          </div>
        )}
        <PreferencesForm
          userId={userId}
          initial={savedPreferences ?? initial}
          onSaved={(prefs) => {
            setSavedPreferences(prefs)
            onSaved(prefs)
          }}
          onCancel={onClose}
          createPreferences={createPreferences}
          updatePreferences={updatePreferences}
        />
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    padding: '28px',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: '18px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  readOnly: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: borders.subtle,
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    minWidth: '130px',
  },
  detailValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
    lineHeight: '1.4',
  },
} as const
