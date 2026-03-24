import { colors, fonts, borders } from './theme'

export default function Field ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        style={styles.input}
      />
    </div>
  )
}

const styles = {
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px'
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  input: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none'
  }
}
