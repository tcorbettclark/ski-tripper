import { X } from 'lucide-react'
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }}
    >
      <div
        role="document"
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>My preferences</h3>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <PreferencesForm
          userId={userId}
          initial={savedPreferences ?? initial}
          onSaved={(prefs) => {
            setSavedPreferences(prefs)
            onSaved(prefs)
            onClose()
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
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
} as const
