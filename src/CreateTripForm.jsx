import { useState } from 'react'
import { createTrip as _createTrip } from './backend'
import Field from './Field'
import { colors, fonts, borders } from './theme'

const EMPTY_FORM = { description: '' }

export default function CreateTripForm ({ user, onCreated, onDismiss, createTrip = _createTrip }) {
  const [form, setForm] = useState(EMPTY_FORM)
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
      const trip = await createTrip(user.$id, form)
      onCreated(trip)
      setForm(EMPTY_FORM)
      onDismiss()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <Field
        label='Description'
        name='description'
        value={form.description}
        onChange={handleChange}
        placeholder="e.g. 5 days in Val d'Isère, late February, intermediate+ skiers"
        required
      />
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type='submit' disabled={saving} style={styles.saveButton}>
          {saving ? 'Saving…' : 'Save Trip'}
        </button>
        <button type='button' onClick={onDismiss} style={styles.cancelButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}

const styles = {
  form: {
    background: colors.bgCard,
    border: borders.subtle,
    borderRadius: '12px',
    padding: '28px',
    marginBottom: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
    margin: 0
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  saveButton: {
    padding: '10px 24px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '10px 16px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    cursor: 'pointer'
  }
}
