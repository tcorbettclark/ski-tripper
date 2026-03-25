import { fieldStyles } from './theme'

export default function Field ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  variant = 'default'
}) {
  const styles = fieldStyles[variant] || fieldStyles.default

  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  )
}
