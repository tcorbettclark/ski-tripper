import { ChevronDown, ChevronRight, RotateCw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import {
  getPreferences as _getPreferences,
  listTripParticipants as _listTripParticipants,
  triggerPreferenceSearch as _triggerPreferenceSearch,
} from './backend'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import type { Participant, Preferences } from './types.d'
import type { UseSSEStreamResult } from './useSSEStream'
import useSSEStream from './useSSEStream'

interface PreferenceSearchPopupProps {
  tripId: string
  onClose: () => void
  onSearch: (query: string) => void
  onAuthError?: (err: unknown) => void
  triggerPreferenceSearch?: (tripId: string) => Promise<void>
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  getPreferences?: (userId: string) => Promise<Preferences | null>
  streamResult?: UseSSEStreamResult
}

const NOOP_AUTH_ERROR = () => {}

export default function PreferenceSearchPopup({
  tripId,
  onClose,
  onSearch,
  onAuthError = NOOP_AUTH_ERROR,
  triggerPreferenceSearch = _triggerPreferenceSearch,
  listTripParticipants = _listTripParticipants,
  getPreferences = _getPreferences,
  streamResult,
}: PreferenceSearchPopupProps) {
  const hookResult = useSSEStream({
    type: 'preference-search',
    tripId,
  })
  const { status, thinking, content, model, error } = streamResult ?? hookResult

  const [participants, setParticipants] = useState<Participant[]>([])
  const [preferencesMap, setPreferencesMap] = useState<
    Record<string, Preferences | null>
  >({})
  const [participantsLoaded, setParticipantsLoaded] = useState(false)
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  if (!participantsLoaded) {
    setParticipantsLoaded(true)
    listTripParticipants(tripId)
      .then(({ participants: p }) => {
        setParticipants(p)
        return Promise.all(
          p.map((participant) =>
            getPreferences(participant.participantUserId)
              .then((prefs) => [participant.participantUserId, prefs] as const)
              .catch(() => [participant.participantUserId, null] as const)
          )
        ).then((entries) => {
          const map: Record<string, Preferences | null> = {}
          for (const [userId, prefs] of entries) {
            map[userId] = prefs
          }
          setPreferencesMap(map)
        })
      })
      .catch(onAuthError)
  }

  const included = participants.filter(
    (p) => preferencesMap[p.participantUserId] != null
  )
  const excluded = participants.filter(
    (p) =>
      p.participantUserId in preferencesMap &&
      preferencesMap[p.participantUserId] == null
  )

  async function handleTrigger() {
    setTriggering(true)
    setTriggerError(null)
    try {
      await triggerPreferenceSearch(tripId)
    } catch (err) {
      setTriggerError(
        err instanceof Error ? err.message : 'Failed to trigger search'
      )
    } finally {
      setTriggering(false)
    }
  }

  function handleSearch() {
    if (content) {
      onSearch(content)
      onClose()
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const showRetry = (status === 'error' && error) || triggerError

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={popupStyles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="document"
        style={popupStyles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={popupStyles.header}>
          <div style={popupStyles.headerLeft}>
            <Sparkles size={18} style={{ color: colors.accent }} />
            <h3 style={popupStyles.title}>Search from preferences</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={popupStyles.closeButton}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={popupStyles.participantsSection}>
          {included.length > 0 && (
            <div style={popupStyles.participantGroup}>
              <span style={popupStyles.participantLabel}>Included: </span>
              {included.map((p) => (
                <span key={p.$id} style={popupStyles.participantName}>
                  {p.participantUserName}
                </span>
              ))}
            </div>
          )}
          {excluded.length > 0 && (
            <div style={popupStyles.participantGroup}>
              <span style={popupStyles.participantLabelExcluded}>
                No preferences:{' '}
              </span>
              {excluded.map((p) => (
                <span key={p.$id} style={popupStyles.participantNameExcluded}>
                  {p.participantUserName}
                </span>
              ))}
            </div>
          )}
        </div>

        {status === 'generating' && (
          <div style={popupStyles.loadingContainer}>
            <div style={popupStyles.spinner} />
            <p style={popupStyles.loadingText}>Generating search query…</p>
          </div>
        )}

        {thinking && (
          <div style={popupStyles.thinkingSection}>
            <button
              type="button"
              onClick={() => setThinkingExpanded(!thinkingExpanded)}
              style={popupStyles.thinkingToggle}
            >
              {thinkingExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span>{status === 'generating' ? 'Thinking…' : 'Thinking'}</span>
            </button>
            {thinkingExpanded && (
              <div style={popupStyles.thinkingContent}>
                <Markdown>{thinking}</Markdown>
              </div>
            )}
          </div>
        )}

        {content && (
          <div style={popupStyles.contentSection}>
            <Markdown>{content}</Markdown>
          </div>
        )}

        {status === null && !content && !thinking && (
          <div style={popupStyles.emptyState}>
            <p style={popupStyles.emptyText}>
              No preference search available yet.
            </p>
            <button
              type="button"
              onClick={handleTrigger}
              disabled={triggering}
              style={popupStyles.triggerButton}
            >
              <Sparkles size={14} />
              {triggering ? 'Starting…' : 'Search from preferences'}
            </button>
          </div>
        )}

        {showRetry && (
          <div style={popupStyles.errorSection}>
            {error && <p style={formStyles.error}>{error}</p>}
            {triggerError && <p style={formStyles.error}>{triggerError}</p>}
            <button
              type="button"
              onClick={handleTrigger}
              disabled={triggering}
              style={popupStyles.retryButton}
            >
              <RotateCw size={14} />
              {triggering ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {status === 'complete' && content && (
          <div style={popupStyles.searchActions}>
            <button
              type="button"
              onClick={handleSearch}
              style={popupStyles.searchButton}
            >
              Search
            </button>
          </div>
        )}

        {model && status === 'complete' && (
          <p style={popupStyles.modelLabel}>Model: {model}</p>
        )}
      </div>
    </div>
  )
}

const popupStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--color-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  panel: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 80px var(--color-shadow)',
    margin: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes['2xl'],
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
  participantsSection: {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  participantGroup: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '4px',
  },
  participantLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  participantLabelExcluded: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500' as const,
    color: colors.error,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  participantName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    background: mix('--color-accent', 0.08),
    padding: '2px 8px',
    borderRadius: '4px',
  },
  participantNameExcluded: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    background: mix('--color-textSecondary', 0.08),
    padding: '2px 8px',
    borderRadius: '4px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '32px 0',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: `3px solid ${mix('--color-accent', 0.2)}`,
    borderTopColor: colors.accent,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    margin: 0,
  },
  thinkingSection: {
    marginBottom: '12px',
    borderRadius: '8px',
    border: borders.subtle,
    overflow: 'hidden',
  },
  thinkingToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
  },
  thinkingContent: {
    padding: '8px 12px 12px',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: '1.5',
    borderTop: borders.subtle,
  },
  contentSection: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textData,
    lineHeight: '1.7',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '24px 0',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    margin: 0,
  },
  triggerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  errorSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '8px',
    marginTop: '12px',
  },
  retryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '5px',
    border: `1px solid ${mix('--color-accent', 0.3)}`,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500' as const,
    cursor: 'pointer',
  },
  searchActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px',
  },
  searchButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  modelLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    margin: '8px 0 0',
    fontStyle: 'italic' as const,
  },
} as const
