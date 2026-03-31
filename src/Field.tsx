import { fieldStyles } from './theme'

interface FieldProps {
  label: string
  name?: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  placeholder?: string
  variant?: 'default' | 'auth'
  minLength?: number
}

export default function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  variant = 'default',
  minLength,
}: FieldProps) {
  const styles = fieldStyles[variant] || fieldStyles.default

  return (
    <div style={styles.field}>
      <label htmlFor={name} style={styles.label}>
        {label}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        style={styles.input}
      />
    </div>
  )
}
