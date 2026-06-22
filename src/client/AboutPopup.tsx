import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import StyledMarkdown from './StyledMarkdown'
import { borders, colors, fontSizes, fonts } from './theme'

const README_URL =
  'https://raw.githubusercontent.com/tcorbettclark/ski-tripper/main/README.md'

interface AboutPopupProps {
  open: boolean
  onClose: () => void
  readmeUrl?: string
}

export default function AboutPopup({
  open,
  onClose,
  readmeUrl = README_URL,
}: AboutPopupProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setContent(null)
    setError('')
    fetch(readmeUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load README (${res.status})`)
        return res.text()
      })
      .then((text) => {
        const trimmed = text.replace(/^.*?(#\s*Ski\s+Tripper)/s, '$1')
        setContent(trimmed)
      })
      .catch((err) => setError(err.message))
  }, [open, readmeUrl])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={aboutStyles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="document"
        style={aboutStyles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={aboutStyles.header}>
          <div />
          <button
            type="button"
            onClick={onClose}
            style={aboutStyles.closeButton}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {error && <p style={aboutStyles.error}>{error}</p>}
        {!content && !error && <p style={aboutStyles.loading}>Loading…</p>}
        {content && (
          <div style={aboutStyles.content}>
            <StyledMarkdown>{content}</StyledMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

export const aboutStyles = {
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
    maxWidth: '640px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 80px var(--color-shadow)',
    margin: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: '8px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  content: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textData,
    lineHeight: '1.7',
  },
  loading: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.error,
  },
} as const
