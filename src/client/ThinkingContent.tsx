import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)

  useEffect(() => {
    if (hasContent) {
      setCollapsed(true)
      userScrolledUpRef.current = false
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

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    userScrolledUpRef.current = !atBottom
  }, [])

  useEffect(() => {
    if (!isGenerating || collapsed) return
    const el = scrollRef.current
    if (!el || userScrolledUpRef.current) return
    void thinking.length
    el.scrollTop = el.scrollHeight
  }, [isGenerating, collapsed, thinking])

  const showThinking = thinking || isGenerating

  if (!showThinking) return null

  if (!hasContent) {
    return (
      <div style={thinkingStyles.section}>
        <div style={thinkingStyles.generatingLabel}>
          <span>Thinking…</span>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="thinking-content"
          style={thinkingStyles.generatingContent}
        >
          {thinking ? (
            <Markdown>{thinking}</Markdown>
          ) : (
            <p style={thinkingStyles.placeholder}>Starting…</p>
          )}
        </div>
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
  section: {
    marginBottom: '12px',
    borderRadius: '8px',
    border: borders.subtle,
  },
  generatingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'inherit',
  },
  generatingContent: {
    height: '200px',
    overflowY: 'auto' as const,
    padding: '8px 12px 12px',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: '1.5',
    borderTop: borders.subtle,
  },
  placeholder: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    margin: 0,
    fontStyle: 'italic' as const,
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
