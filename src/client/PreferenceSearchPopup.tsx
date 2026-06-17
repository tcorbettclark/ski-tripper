import { RotateCw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import ThinkingContent from './ThinkingContent'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import type { UseSSEStreamResult } from './useSSEStream'
import useSSEStream from './useSSEStream'

interface PreferenceSearchPopupProps {
  tripId: string
  onClose: () => void
  onSearch: (query: string) => void
  streamResult?: UseSSEStreamResult & { refetch: () => void }
}

export default function PreferenceSearchPopup({
  tripId,
  onClose,
  onSearch,
  streamResult,
}: PreferenceSearchPopupProps) {
  const [triggered, setTriggered] = useState(false)
  const hookResult = useSSEStream({
    type: 'preference-search',
    tripId,
    enabled: !streamResult && triggered,
  })
  const { status, thinking, content, model, error, refetch } =
    streamResult ?? hookResult

  const isGenerating = status === 'generating'
  const hasContent = !!content?.trim()

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

  const showRetry = status === 'error' && error

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
            <h3 style={popupStyles.title}>AI assist</h3>
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

        {!triggered && (
          <p style={popupStyles.description}>
            Generate resort search text from everyone's ski holiday preferences
          </p>
        )}

        <ThinkingContent
          thinking={thinking}
          isGenerating={isGenerating}
          hasContent={hasContent}
        />

        {content && (
          <div style={popupStyles.contentSection}>
            <Markdown>{content}</Markdown>
          </div>
        )}

        {status === null && !content && !thinking && !triggered && (
          <div style={popupStyles.emptyState}>
            <button
              type="button"
              onClick={() => {
                setTriggered(true)
              }}
              style={popupStyles.triggerButton}
            >
              <Sparkles size={14} />
              Generate search
            </button>
          </div>
        )}

        {showRetry && (
          <div style={popupStyles.errorSection}>
            {error && <p style={formStyles.error}>{error}</p>}
            <button
              type="button"
              onClick={refetch}
              style={popupStyles.retryButton}
            >
              <RotateCw size={14} />
              Retry
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
              Apply
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
