import { colors, fonts } from './theme'

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

  const bars = [
    { label: 'Beginner', pct: beginnerPct, colour: colors.pisteBeginner },
    {
      label: 'Intermediate',
      pct: intermediatePct,
      colour: colors.pisteIntermediate,
    },
    { label: 'Advanced', pct: advancedPct, colour: colors.pisteAdvanced },
  ]

  return (
    <div style={compact ? compactStyles.container : defaultStyles.container}>
      {bars.map((bar) => {
        const widthPct = (bar.pct / total) * 100
        const tooltip = `${bar.label}: ${bar.pct}%`
        return (
          <div key={bar.label} style={defaultStyles.barRow} title={tooltip}>
            <div
              style={{
                ...(compact ? compactStyles.bar : defaultStyles.bar),
                width: `${widthPct}%`,
                background: bar.colour,
              }}
            />
            {!compact && bar.pct > 0 && (
              <span
                style={{
                  ...defaultStyles.pctLabel,
                  color: bar.colour,
                }}
              >
                {bar.pct}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const defaultStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    width: '100%',
  },
  barRow: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '4px',
  },
  bar: {
    height: '5px',
    borderRadius: '2px',
    minWidth: '1px',
    transition: 'width 0.2s ease',
  },
  pctLabel: {
    fontFamily: fonts.body,
    fontSize: '10px',
  },
}

const compactStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1px',
    width: '100%',
  },
  bar: {
    height: '3px',
    borderRadius: '1px',
    minWidth: '1px',
    transition: 'width 0.2s ease',
  },
}
