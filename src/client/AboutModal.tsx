import { X } from 'lucide-react'
import { useEffect } from 'react'
import { aboutContent } from './about-content'
import StyledMarkdown from './StyledMarkdown'
import { colors, fontSizes, fonts, overlayStyles } from './theme'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{
        ...overlayStyles.overlay,
        display: open ? 'flex' : 'none',
      }}
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
          <div style={aboutModalStyles.content}>
            <StyledMarkdown>{aboutContent}</StyledMarkdown>
          </div>
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
} as const
