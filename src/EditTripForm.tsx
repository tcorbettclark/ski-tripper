import { useState } from 'react'
import { updateTrip as _updateTrip } from './backend'
import Field from './Field'
import { borders, colors, formStyles } from './theme'
import type { Trip } from './types.d.ts'

interface EditTripFormProps {
  trip: Trip
  userId: string
  onUpdated: (trip: unknown) => void
  onCancel: () => void
  updateTrip?: (
    tripId: string,
    data: { description: string },
    userId: string
  ) => Promise<unknown>
}

export default function EditTripForm({
  trip,
  userId,
  onUpdated,
  onCancel,
  updateTrip = _updateTrip,
}: EditTripFormProps) {
  const [form, setForm] = useState({
    description: trip.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await updateTrip(trip.$id, form, userId)
      onUpdated(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <Field
        label="Description"
        name="description"
        value={form.description}
        onChange={handleChange}
        required
      />
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type="submit" disabled={saving} style={styles.saveButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '8px 0',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  saveButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: formStyles.saveButton.fontFamily,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: formStyles.cancelButton.fontFamily,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
} as const
