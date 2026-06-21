import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { borders, colors, fontSizes, fonts, mix } from './theme'

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
      .then((text) => setContent(text))
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
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {content}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  )
}

const mdComponents = {
  h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 style={mdStyles.h1}>{children}</h1>
  ),
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 style={mdStyles.h2}>{children}</h2>
  ),
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 style={mdStyles.h3}>{children}</h3>
  ),
  p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p style={mdStyles.p}>{children}</p>
  ),
  ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul style={mdStyles.ul}>{children}</ul>
  ),
  ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol style={mdStyles.ol}>{children}</ol>
  ),
  li: ({ children }: React.HTMLAttributes<HTMLLIElement>) => (
    <li style={mdStyles.li}>{children}</li>
  ),
  a: ({ children, href }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a style={mdStyles.a} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote style={mdStyles.blockquote}>{children}</blockquote>
  ),
  code: ({ children, className }: React.HTMLAttributes<HTMLElement>) => {
    const isInline = !className
    return isInline ? (
      <code style={mdStyles.inlineCode}>{children}</code>
    ) : (
      <code style={mdStyles.codeBlock}>{children}</code>
    )
  },
  pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre style={mdStyles.pre}>{children}</pre>
  ),
  table: ({ children }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <table style={mdStyles.table}>{children}</table>
  ),
  th: ({ children }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th style={mdStyles.th}>{children}</th>
  ),
  td: ({ children }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td style={mdStyles.td}>{children}</td>
  ),
  hr: () => <hr style={mdStyles.hr} />,
}

const mdStyles = {
  h1: {
    fontFamily: fonts.display,
    fontSize: fontSizes['2xl'],
    fontWeight: '600' as const,
    color: colors.textPrimary,
    margin: '0 0 16px',
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    margin: '24px 0 12px',
    lineHeight: 1.3,
  },
  h3: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    margin: '20px 0 8px',
    lineHeight: 1.4,
  },
  p: {
    margin: '0 0 12px',
  },
  ul: {
    margin: '0 0 12px',
    paddingLeft: '24px',
    listStyleType: 'disc' as const,
  },
  ol: {
    margin: '0 0 12px',
    paddingLeft: '24px',
    listStyleType: 'decimal' as const,
  },
  li: {
    marginBottom: '4px',
  },
  a: {
    color: colors.accent,
    textDecoration: 'underline' as const,
  },
  blockquote: {
    margin: '0 0 12px',
    paddingLeft: '16px',
    borderLeft: `3px solid ${colors.accent}`,
    color: colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  inlineCode: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    padding: '2px 4px',
    borderRadius: '3px',
  },
  codeBlock: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
  },
  pre: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    background: colors.bgInput,
    padding: '16px',
    borderRadius: '8px',
    overflowX: 'auto' as const,
    margin: '0 0 12px',
  },
  table: {
    borderCollapse: 'collapse' as const,
    width: '100%',
    margin: '0 0 12px',
    fontSize: fontSizes.sm,
  },
  th: {
    border: `1px solid ${mix('--color-textSecondary', 0.3)}`,
    padding: '8px 12px',
    textAlign: 'left' as const,
    fontWeight: '600' as const,
  },
  td: {
    border: `1px solid ${mix('--color-textSecondary', 0.3)}`,
    padding: '8px 12px',
  },
  hr: {
    border: 'none',
    borderTop: `1px solid ${mix('--color-textSecondary', 0.3)}`,
    margin: '16px 0',
  },
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
