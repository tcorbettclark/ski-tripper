import type { CSSProperties } from 'react'

interface ParagraphsProps {
  text: string
  style?: CSSProperties
}

export default function Paragraphs({ text, style }: ParagraphsProps) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length === 0) return null

  return (
    <>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)} style={style}>
          {paragraph}
        </p>
      ))}
    </>
  )
}
