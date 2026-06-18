import { type CSSProperties, Fragment } from 'react'

interface ParagraphsProps {
  text: string
  style?: CSSProperties
}

const paragraphsStyles = {
  paragraph: {
    margin: '0 0 0 0',
  } as CSSProperties,
  divider: {
    border: 'none',
    borderTop: '1px solid #ddd',
    width: '35%',
    margin: '8px auto',
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
        <Fragment key={paragraph.slice(0, 40)}>
          <p style={{ ...paragraphsStyles.paragraph, ...style }}>{paragraph}</p>
          {index < paragraphs.length - 1 && (
            <hr style={paragraphsStyles.divider} />
          )}
        </Fragment>
      ))}
    </>
  )
}
