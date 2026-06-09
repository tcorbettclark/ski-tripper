import { ChevronDown, ChevronRight, RotateCw } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import {
  getPreferences as _getPreferences,
  listTripParticipants as _listTripParticipants,
  triggerAnalysis as _triggerAnalysis,
} from './backend'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import type { Participant, Preferences } from './types.d'
import useLLMCacheStream from './useLLMCacheStream'

interface AnalysisTabProps {
  proposalId: string
  tripId: string
  onAuthError?: (err: unknown) => void
  triggerAnalysis?: (proposalId: string, tripId: string) => Promise<void>
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  getPreferences?: (userId: string) => Promise<Preferences | null>
}

const noopAuthError = () => {}

export default function AnalysisTab({
  proposalId,
  tripId,
  onAuthError = noopAuthError,
  triggerAnalysis = _triggerAnalysis,
  listTripParticipants = _listTripParticipants,
  getPreferences = _getPreferences,
}: AnalysisTabProps) {
  const { status, thinking, content, model, error } = useLLMCacheStream({
    type: 'analysis',
    proposalId,
    tripId,
  })
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
      await triggerAnalysis(proposalId, tripId)
    } catch (err) {
      setTriggerError(
        err instanceof Error ? err.message : 'Failed to trigger analysis'
      )
    } finally {
      setTriggering(false)
    }
  }

  const showRetry = (status === 'error' && error) || triggerError

  return (
    <div style={analysisStyles.container}>
      <div style={analysisStyles.participantsSection}>
        {included.length > 0 && (
          <div style={analysisStyles.participantGroup}>
            <span style={analysisStyles.participantLabel}>Included: </span>
            {included.map((p) => (
              <span key={p.$id} style={analysisStyles.participantName}>
                {p.participantUserName}
              </span>
            ))}
          </div>
        )}
        {excluded.length > 0 && (
          <div style={analysisStyles.participantGroup}>
            <span style={analysisStyles.participantLabelExcluded}>
              No preferences:{' '}
            </span>
            {excluded.map((p) => (
              <span key={p.$id} style={analysisStyles.participantNameExcluded}>
                {p.participantUserName}
              </span>
            ))}
          </div>
        )}
      </div>

      {status === 'generating' && (
        <div style={analysisStyles.loadingContainer}>
          <div style={analysisStyles.spinner} />
          <p style={analysisStyles.loadingText}>Generating analysis…</p>
        </div>
      )}

      {thinking && (
        <div style={analysisStyles.thinkingSection}>
          <button
            type="button"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            style={analysisStyles.thinkingToggle}
          >
            {thinkingExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            <span>{status === 'generating' ? 'Thinking…' : 'Thinking'}</span>
          </button>
          {thinkingExpanded && (
            <div style={analysisStyles.thinkingContent}>
              <Markdown>{thinking}</Markdown>
            </div>
          )}
        </div>
      )}

      {content && (
        <div style={analysisStyles.contentSection}>
          <Markdown>{content}</Markdown>
        </div>
      )}

      {status === null && !content && !thinking && (
        <div style={analysisStyles.emptyState}>
          <p style={analysisStyles.emptyText}>No analysis available yet.</p>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggering}
            style={analysisStyles.triggerButton}
          >
            {triggering ? 'Starting…' : 'Generate Analysis'}
          </button>
        </div>
      )}

      {showRetry && (
        <div style={analysisStyles.errorSection}>
          {error && <p style={formStyles.error}>{error}</p>}
          {triggerError && <p style={formStyles.error}>{triggerError}</p>}
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggering}
            style={analysisStyles.retryButton}
          >
            <RotateCw size={14} />
            {triggering ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {model && status === 'complete' && (
        <p style={analysisStyles.modelLabel}>Model: {model}</p>
      )}
    </div>
  )
}

const analysisStyles = {
  container: {
    paddingTop: '10px',
    paddingBottom: '10px',
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
  modelLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    margin: '8px 0 0',
    fontStyle: 'italic' as const,
  },
} as const
