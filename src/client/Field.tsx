import { fieldStyles } from './theme'

interface FieldProps {
  label: string
  name?: string
  value: string
  onChange: (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void
  type?: string
  required?: boolean
  placeholder?: string
  variant?: 'default' | 'auth'
  minLength?: number
  autoComplete?: string
  inputMode?:
    | 'numeric'
    | 'tel'
    | 'url'
    | 'email'
    | 'decimal'
    | 'search'
    | 'text'
    | 'none'
  options?: string[]
  readOnly?: boolean
  'data-testid'?: string
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
  autoComplete,
  inputMode,
  options,
  readOnly,
  'data-testid': dataTestId,
}: FieldProps) {
  const styles = fieldStyles[variant] || fieldStyles.default

  if (options) {
    return (
      <div style={styles.field}>
        <label htmlFor={name} style={styles.label}>
          {label}
        </label>
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          style={styles.input}
          data-testid={dataTestId}
        >
          <option value="">{placeholder ?? 'Select an option…'}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

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
        autoComplete={autoComplete}
        inputMode={inputMode}
        readOnly={readOnly}
        style={styles.input}
        data-testid={dataTestId}
      />
    </div>
  )
}
