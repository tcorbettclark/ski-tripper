import { colors, fontSizes, fonts } from './theme'

interface DetailFieldProps {
  label: string
  value?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export default function DetailField({
  label,
  value,
  children,
  style,
}: DetailFieldProps) {
  return (
    <div style={style}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{children ?? (value || '—')}</div>
    </div>
  )
}

const styles = {
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  fieldValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textData,
    lineHeight: '1.5',
  },
} as const
