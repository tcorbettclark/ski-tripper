import { useState } from 'react'
import { borders, colors, fontSizes, fonts, mix } from './theme'

interface TagCloudItem {
  key: string
  label: string
  imageUrl?: string
}

interface TagCloudProps {
  commonItems: TagCloudItem[]
  uncommonItems: TagCloudItem[]
  selectedKeys: Set<string>
  onToggle: (key: string) => void
}

export default function TagCloud({
  commonItems,
  uncommonItems,
  selectedKeys,
  onToggle,
}: TagCloudProps) {
  const [showMore, setShowMore] = useState(false)

  const visibleItems = showMore
    ? [...commonItems, ...uncommonItems]
    : commonItems

  if (visibleItems.length === 0) return null

  return (
    <div style={tagCloudStyles.container}>
      {visibleItems.map((item) => {
        const isSelected = selectedKeys.has(item.key)
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            title={item.label}
            style={{
              ...tagCloudStyles.tag,
              ...(isSelected ? tagCloudStyles.tagSelected : {}),
            }}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.label}
                style={tagCloudStyles.tagImage}
              />
            )}
            {!item.imageUrl && (
              <span style={tagCloudStyles.tagLabel}>{item.label}</span>
            )}
          </button>
        )
      })}
      {uncommonItems.length > 0 && (
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          style={tagCloudStyles.moreLink}
        >
          {showMore ? 'less' : `+${uncommonItems.length} more`}
        </button>
      )}
    </div>
  )
}

const tagCloudStyles = {
  container: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: '6px',
  },
  tag: {
    padding: '4px 6px',
    borderRadius: '6px',
    border: borders.card,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    lineHeight: 1,
  },
  tagSelected: {
    background: mix('--color-accent', 0.2),
    color: colors.textPrimary,
    border: `1px solid ${colors.accent}`,
  },
  tagImage: {
    display: 'inline-block',
    width: '22px',
    height: '15px',
    verticalAlign: 'middle',
  },
  tagLabel: {
    whiteSpace: 'nowrap' as const,
  },
  moreLink: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    padding: '0',
    whiteSpace: 'nowrap' as const,
  },
}
