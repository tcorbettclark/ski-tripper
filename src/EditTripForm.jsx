import { useState } from 'react'
import { updateTrip, deleteTrip } from './database'
import Field from './Field'
import { colors, fonts, borders } from './theme'

export default function EditTripForm ({ trip, onUpdated, onDeleted, onCancel }) {
  const [form, setForm] = useState({
    name: trip.name,
    description: trip.description || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange (e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit (e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await updateTrip(trip.$id, form)
      onUpdated(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete () {
    if (!window.confirm('Delete this trip?')) return
    setSaving(true)
    try {
      await deleteTrip(trip.$id)
      onDeleted()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <Field
        label='Name'
        name='name'
        value={form.name}
        onChange={handleChange}
        required
      />
      <Field
        label='Description'
        name='description'
        value={form.description}
        onChange={handleChange}
      />
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type='submit' disabled={saving} style={styles.saveButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type='button' onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
        <button
          type='button'
          onClick={handleDelete}
          disabled={saving}
          style={styles.deleteButton}
        >
          Delete
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
    padding: '8px 0'
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
    margin: 0
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  saveButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: '1px solid rgba(255,107,107,0.25)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    marginLeft: 'auto'
  }
}
