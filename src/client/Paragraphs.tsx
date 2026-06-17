import type { CSSProperties } from 'react'

interface ParagraphsProps {
  text: string
  style?: CSSProperties
}

const paragraphsStyles = {
  paragraph: {
    margin: '0 0 16px 0',
  } as CSSProperties,
}

export default function Paragraphs({ text, style }: ParagraphsProps) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length === 0) return null

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={paragraph.slice(0, 40)}
          style={{
            ...paragraphsStyles.paragraph,
            ...(index === paragraphs.length - 1 ? { marginBottom: 0 } : {}),
            ...style,
          }}
        >
          {paragraph}
        </p>
      ))}
    </>
  )
}
