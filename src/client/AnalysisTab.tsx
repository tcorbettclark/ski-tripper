import { RotateCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import ThinkingContent from './ThinkingContent'
import { colors, fontSizes, fonts, formStyles, mix } from './theme'
import type { UseSSEStreamResult } from './useSSEStream'
import useSSEStream from './useSSEStream'

interface AnalysisTabProps {
  proposalId: string
  tripId: string
  streamResult?: UseSSEStreamResult
}

export default function AnalysisTab({
  proposalId,
  tripId,
  streamResult,
}: AnalysisTabProps) {
  const [triggered, setTriggered] = useState(false)
  const hookResult = useSSEStream({
    type: 'analysis',
    proposalId,
    tripId,
    enabled: !streamResult && triggered,
  })
  const { status, thinking, content, model, error } = streamResult ?? hookResult
  const hookRefetch = hookResult.refetch

  const isGenerating = status === 'generating'
  const hasContent = !!content?.trim()

  function handleTrigger() {
    setTriggered(true)
  }

  function handleRetry() {
    if (streamResult) {
      return
    }
    hookRefetch()
  }

  const showRetry = status === 'error' && error

  return (
    <div style={analysisStyles.container}>
      {!triggered && !content && !thinking && status === null && (
        <p style={analysisStyles.description}>
          Generate an AI analysis of this proposal against everyone's ski
          holiday preferences
        </p>
      )}

      <ThinkingContent
        thinking={thinking}
        isGenerating={isGenerating}
        hasContent={hasContent}
      />

      {content && (
        <div style={analysisStyles.contentSection}>
          <Markdown>{content}</Markdown>
        </div>
      )}

      {status === null && !content && !thinking && !triggered && (
        <div style={analysisStyles.emptyState}>
          <button
            type="button"
            onClick={handleTrigger}
            style={analysisStyles.triggerButton}
          >
            <Sparkles size={14} />
            Generate Analysis
          </button>
        </div>
      )}

      {showRetry && (
        <div style={analysisStyles.errorSection}>
          {error && <p style={formStyles.error}>{error}</p>}
          <button
            type="button"
            onClick={handleRetry}
            style={analysisStyles.retryButton}
          >
            <RotateCw size={14} />
            Retry
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
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: '0 0 16px',
    lineHeight: '1.5',
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
  modelLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    margin: '8px 0 0',
    fontStyle: 'italic' as const,
  },
} as const
