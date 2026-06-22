import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mdStyles } from './theme'

const components: Components = {
  h1: ({ children }) => <h1 style={mdStyles.h1}>{children}</h1>,
  h2: ({ children }) => <h2 style={mdStyles.h2}>{children}</h2>,
  h3: ({ children }) => <h3 style={mdStyles.h3}>{children}</h3>,
  p: ({ children }) => <p style={mdStyles.p}>{children}</p>,
  ul: ({ children }) => <ul style={mdStyles.ul}>{children}</ul>,
  ol: ({ children }) => <ol style={mdStyles.ol}>{children}</ol>,
  li: ({ children }) => <li style={mdStyles.li}>{children}</li>,
  a: ({ children, href }) => (
    <a style={mdStyles.a} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote style={mdStyles.blockquote}>{children}</blockquote>
  ),
  code: ({ children, className }) => {
    const isInline = !className
    return isInline ? (
      <code style={mdStyles.inlineCode}>{children}</code>
    ) : (
      <code style={mdStyles.codeBlock}>{children}</code>
    )
  },
  pre: ({ children }) => <pre style={mdStyles.pre}>{children}</pre>,
  table: ({ children }) => <table style={mdStyles.table}>{children}</table>,
  th: ({ children }) => <th style={mdStyles.th}>{children}</th>,
  td: ({ children }) => <td style={mdStyles.td}>{children}</td>,
  hr: () => <hr style={mdStyles.hr} />,
}

interface StyledMarkdownProps {
  children: string
  gfm?: boolean
}

export default function StyledMarkdown({
  children,
  gfm = true,
}: StyledMarkdownProps) {
  return (
    <Markdown remarkPlugins={gfm ? [remarkGfm] : []} components={components}>
      {children}
    </Markdown>
  )
}
