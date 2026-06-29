import { useState } from 'react'
import type { Trip } from '../shared/types.d'
import { updateTrip as _updateTrip } from './backend'
import { fieldStyles, formStyles } from './theme'
import { toast } from './toast'
import { getErrorMessage } from './utils'

interface EditTripDescriptionFormProps {
  trip: Trip
  userId: string
  onUpdated: (trip: Trip) => void
  onCancel: () => void
  updateTrip?: (
    tripId: string,
    data: Partial<Trip>,
    user: string
  ) => Promise<Trip>
}

export default function EditTripDescriptionForm({
  trip,
  userId,
  onUpdated,
  onCancel,
  updateTrip = _updateTrip,
}: EditTripDescriptionFormProps) {
  const [description, setDescription] = useState(trip.description || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateTrip(trip.id, { description }, userId)
      onUpdated(updated)
    } catch (err: unknown) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={editTripDescriptionFormStyles.form}>
      <div style={fieldStyles.default.field}>
        <label htmlFor="description" style={fieldStyles.default.label}>
          Description
        </label>
        <input
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="e.g. 5 days in Val d'Isère, late February, intermediate+ skiers"
          style={fieldStyles.default.input}
        />
      </div>
      <div style={editTripDescriptionFormStyles.actions}>
        <button type="submit" disabled={saving} style={formStyles.saveButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={formStyles.cancelButton}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

const editTripDescriptionFormStyles = {
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    padding: '8px 0',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
} as const
