import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import StyledMarkdown from './StyledMarkdown'
import { colors, fontSizes, fonts, overlayStyles } from './theme'

const README_URL =
  'https://raw.githubusercontent.com/tcorbettclark/ski-tripper/main/README.md'

interface AboutModalProps {
  open: boolean
  onClose: () => void
  readmeUrl?: string
}

export default function AboutModal({
  open,
  onClose,
  readmeUrl = README_URL,
}: AboutModalProps) {
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
        const firstHeadingIndex = text.search(/^# /m)
        const content =
          firstHeadingIndex >= 0 ? text.slice(firstHeadingIndex) : text
        setContent(content)
      })
      .catch((err) => setError(err.message))
  }, [open, readmeUrl])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

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
        style={{ ...overlayStyles.panel, maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={overlayStyles.panelHeader}>
          <h3 style={overlayStyles.panelTitle}>About</h3>
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
          {error && <p style={aboutModalStyles.error}>{error}</p>}
          {!content && !error && (
            <p style={aboutModalStyles.loading}>Loading…</p>
          )}
          {content && (
            <div style={aboutModalStyles.content}>
              <StyledMarkdown>{content}</StyledMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const aboutModalStyles = {
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
