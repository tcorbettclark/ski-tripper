import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Preferences } from '../shared/types.d'
import PreferencesForm from './PreferencesForm'
import { formStyles, overlayStyles } from './theme'

const FORM_ID = 'preferences-form'

interface PreferencesModalProps {
  userId: string
  userName: string
  initial: Preferences | null
  open: boolean
  onClose: () => void
  onSaved: (preferences: Preferences) => void
  onNameUpdated?: () => void
  createPreferences?: (
    userId: string,
    data: Omit<Preferences, 'id' | 'created' | 'updated' | 'user'>
  ) => Promise<Preferences>
  updatePreferences?: (
    userId: string,
    data: Partial<Omit<Preferences, 'id' | 'created' | 'updated' | 'user'>>
  ) => Promise<Preferences>
  updateName?: (name: string) => Promise<unknown>
}

export default function PreferencesModal({
  userId,
  userName,
  initial,
  open,
  onClose,
  onSaved,
  onNameUpdated,
  createPreferences,
  updatePreferences,
  updateName,
}: PreferencesModalProps) {
  const [savedPreferences, setSavedPreferences] = useState<Preferences | null>(
    initial
  )

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isExisting = !!(savedPreferences ?? initial)

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={overlayStyles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="document"
        style={{ ...overlayStyles.panel, maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={overlayStyles.panelHeader}>
          <h3 style={overlayStyles.panelTitle}>My Preferences</h3>
          <button
            type="button"
            onClick={onClose}
            style={overlayStyles.closeButton}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div style={overlayStyles.panelContent}>
          <PreferencesForm
            formId={FORM_ID}
            hideActions
            userId={userId}
            userName={userName}
            initial={savedPreferences ?? initial}
            onSaved={(prefs) => {
              setSavedPreferences(prefs)
              onSaved(prefs)
              onClose()
            }}
            onNameUpdated={onNameUpdated}
            onCancel={onClose}
            createPreferences={createPreferences}
            updatePreferences={updatePreferences}
            updateName={updateName}
          />
        </div>
        <div style={overlayStyles.panelFooter}>
          <button
            type="button"
            onClick={onClose}
            style={formStyles.cancelButton}
          >
            Cancel
          </button>
          <button type="submit" form={FORM_ID} style={formStyles.saveButton}>
            {isExisting ? 'Update Preferences' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
