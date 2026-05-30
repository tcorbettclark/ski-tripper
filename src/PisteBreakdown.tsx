import { fonts } from './theme'

const PISTE_COLOURS = {
  beginner: '#4A90D9',
  intermediate: '#E53935',
  advanced: '#212121',
} as const

interface PisteBreakdownProps {
  beginnerKm: number
  intermediateKm: number
  advancedKm: number
  compact?: boolean
}

export default function PisteBreakdown({
  beginnerKm,
  intermediateKm,
  advancedKm,
  compact = false,
}: PisteBreakdownProps) {
  const total = beginnerKm + intermediateKm + advancedKm
  if (total === 0) return null

  const bars = [
    { label: 'Beginner', km: beginnerKm, colour: PISTE_COLOURS.beginner },
    {
      label: 'Intermediate',
      km: intermediateKm,
      colour: PISTE_COLOURS.intermediate,
    },
    { label: 'Advanced', km: advancedKm, colour: PISTE_COLOURS.advanced },
  ]

  return (
    <div style={compact ? compactStyles.container : defaultStyles.container}>
      {bars.map((bar) => {
        const pct = (bar.km / total) * 100
        const tooltip = `${bar.label}: ${bar.km} km (${pct.toFixed(0)}%)`
        const isBlackBar = bar.label === 'Advanced'
        return (
          <div key={bar.label} style={defaultStyles.barRow} title={tooltip}>
            <div
              style={{
                ...(compact ? compactStyles.bar : defaultStyles.bar),
                width: `${pct}%`,
                background: bar.colour,
                border: isBlackBar
                  ? '1px solid rgba(255, 255, 255, 0.6)'
                  : 'none',
              }}
            />
            {!compact && bar.km > 0 && (
              <span
                style={{
                  ...defaultStyles.kmLabel,
                  color: isBlackBar ? 'rgba(255, 255, 255, 0.6)' : bar.colour,
                }}
              >
                {bar.km}
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
  kmLabel: {
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
