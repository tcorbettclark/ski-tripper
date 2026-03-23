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
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '500',
    color: '#6a94ae',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  input: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: '1px solid rgba(100,190,230,0.12)',
    background: '#060f1b',
    color: '#edf6fc',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    outline: 'none'
  }
}
