import { colors, fontSizes, fonts } from './theme'

interface PisteBreakdownProps {
  beginnerPct: number
  intermediatePct: number
  advancedPct: number
  compact?: boolean
}

export default function PisteBreakdown({
  beginnerPct,
  intermediatePct,
  advancedPct,
  compact = false,
}: PisteBreakdownProps) {
  const total = beginnerPct + intermediatePct + advancedPct
  if (total === 0) return null

  const segments = [
    { pct: beginnerPct, colour: colors.pisteBeginner, label: 'Beginner' },
    {
      pct: intermediatePct,
      colour: colors.pisteIntermediate,
      label: 'Intermediate',
    },
    { pct: advancedPct, colour: colors.pisteAdvanced, label: 'Advanced' },
  ]

  return (
    <div style={compact ? compactStyles.container : defaultStyles.container}>
      <div
        style={defaultStyles.bar}
        title={segments.map((s) => `${s.label}: ${s.pct}%`).join(' • ')}
      >
        {segments.map((seg) => {
          const widthPct = (seg.pct / total) * 100
          if (widthPct === 0) return null
          return (
            <div
              key={seg.label}
              style={{
                width: `${widthPct}%`,
                background: seg.colour,
                height: '100%',
                minWidth: '1px',
              }}
            />
          )
        })}
      </div>
      {!compact && (
        <span style={defaultStyles.pctLabel}>
          {segments
            .filter((seg) => seg.pct > 0)
            .map((seg) => `${seg.pct}%`)
            .join(' / ')}
        </span>
      )}
    </div>
  )
}

const defaultStyles = {
  container: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '8px',
    maxWidth: '200px',
  },
  bar: {
    display: 'flex',
    height: '6px',
    borderRadius: '3px',
    overflow: 'hidden' as const,
    flex: 1,
  },
  pctLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    whiteSpace: 'nowrap' as const,
  },
}

const compactStyles = {
  container: {
    display: 'flex',
    maxWidth: '160px',
  },
  bar: {
    display: 'flex',
    height: '4px',
    borderRadius: '2px',
    overflow: 'hidden' as const,
    width: '100%',
  },
}
