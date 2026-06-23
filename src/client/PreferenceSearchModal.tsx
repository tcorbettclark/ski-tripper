import { RotateCw, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import StyledMarkdown from './StyledMarkdown'
import ThinkingContent from './ThinkingContent'
import {
  colors,
  fontSizes,
  fonts,
  formStyles,
  mix,
  overlayStyles,
} from './theme'
import type { UseSSEStreamResult } from './useSSEStream'
import useSSEStream from './useSSEStream'

interface PreferenceSearchModalProps {
  tripId: string
  onClose: () => void
  onSearch: (query: string) => void
  onTrigger?: () => void
  onRetry?: () => void
  streamResult?: UseSSEStreamResult
}

export default function PreferenceSearchModal({
  tripId,
  onClose,
  onSearch,
  onTrigger,
  onRetry,
  streamResult,
}: PreferenceSearchModalProps) {
  const [triggered, setTriggered] = useState(false)
  const hookResult = useSSEStream({
    type: 'preference-search',
    tripId,
    enabled: !streamResult && triggered,
  })
  const { status, thinking, content, model, error } = streamResult ?? hookResult
  const hookRefetch = hookResult.refetch

  const isGenerating = status === 'generating'
  const hasContent = !!content?.trim()

  function handleSearch() {
    if (content) {
      onSearch(content)
      onClose()
    }
  }

  function handleTrigger() {
    setTriggered(true)
    onTrigger?.()
  }

  function handleRetry() {
    if (streamResult) {
      onRetry?.()
    } else {
      hookRefetch()
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const showRetry = status === 'error' && error
  const showFooter =
    (status === null && !content && !thinking && !triggered) ||
    showRetry ||
    (status === 'complete' && !!content)

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
        style={overlayStyles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={overlayStyles.panelHeader}>
          <div style={preferenceSearchModalStyles.headerLeft}>
            <Sparkles size={18} style={{ color: colors.accent }} />
            <h3 style={overlayStyles.panelTitle}>AI assist</h3>
          </div>
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
          {!triggered && (
            <p style={preferenceSearchModalStyles.description}>
              Generate resort search text from everyone's ski holiday
              preferences
            </p>
          )}

          <ThinkingContent
            thinking={thinking}
            isGenerating={isGenerating}
            hasContent={hasContent}
          />

          {content && (
            <div style={preferenceSearchModalStyles.contentSection}>
              <StyledMarkdown>{content}</StyledMarkdown>
            </div>
          )}

          {showRetry && (
            <div style={preferenceSearchModalStyles.errorSection}>
              {error && <p style={formStyles.error}>{error}</p>}
            </div>
          )}

          {model && status === 'complete' && (
            <p style={preferenceSearchModalStyles.modelLabel}>Model: {model}</p>
          )}
        </div>

        {showFooter && (
          <div style={overlayStyles.panelFooter}>
            {status === null && !content && !thinking && !triggered && (
              <button
                type="button"
                onClick={handleTrigger}
                style={preferenceSearchModalStyles.triggerButton}
              >
                <Sparkles size={14} />
                Generate search
              </button>
            )}
            {showRetry && (
              <button
                type="button"
                onClick={handleRetry}
                style={preferenceSearchModalStyles.retryButton}
              >
                <RotateCw size={14} />
                Retry
              </button>
            )}
            {status === 'complete' && content && (
              <button
                type="button"
                onClick={handleSearch}
                style={preferenceSearchModalStyles.searchButton}
              >
                Apply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const preferenceSearchModalStyles = {
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  errorSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '8px',
    marginTop: '12px',
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
