import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { borders, fontSizes, fonts } from './theme'

interface ThinkingContentProps {
  thinking: string
  isGenerating: boolean
  hasContent: boolean
}

export default function ThinkingContent({
  thinking,
  isGenerating,
  hasContent,
}: ThinkingContentProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (hasContent) {
      setCollapsed(true)
    }
  }, [hasContent])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `.thinking-content ul, .thinking-content ol { margin: 0; padding-left: 1.5em; } .thinking-content p { margin: 0 0 0.5em; } .thinking-content p:last-child { margin-bottom: 0; }`
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const showThinking = thinking || isGenerating

  if (!showThinking) return null

  if (!hasContent) {
    return (
      <div style={thinkingStyles.inline}>
        {thinking ? (
          <Markdown>{thinking}</Markdown>
        ) : (
          <p style={thinkingStyles.placeholder}>Thinking…</p>
        )}
      </div>
    )
  }

  return (
    <div style={thinkingStyles.section}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={thinkingStyles.toggle}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span>Thinking</span>
      </button>
      {!collapsed && (
        <div className="thinking-content" style={thinkingStyles.content}>
          <Markdown>{thinking}</Markdown>
        </div>
      )}
    </div>
  )
}

const thinkingStyles = {
  inline: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: '1.5',
    marginBottom: '12px',
  },
  placeholder: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    margin: 0,
    fontStyle: 'italic' as const,
  },
  section: {
    marginBottom: '12px',
    borderRadius: '8px',
    border: borders.subtle,
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
  },
  content: {
    padding: '8px 12px 12px',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: '1.5',
    borderTop: borders.subtle,
  },
} as const
