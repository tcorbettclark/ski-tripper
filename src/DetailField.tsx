import { colors, fonts } from './theme'

interface DetailFieldProps {
  label: string
  value?: string
  children?: React.ReactNode
}

export default function DetailField({
  label,
  value,
  children,
}: DetailFieldProps) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{children ?? (value || '—')}</div>
    </div>
  )
}

const styles = {
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: '10px',
    color: colors.textSecondary,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  fieldValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
    lineHeight: '1.5',
  },
} as const
