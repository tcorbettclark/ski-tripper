import { useState } from 'react'
import { createTrip as _createTrip, account as _account } from './backend'
import Field from './Field'
import { colors, borders, formStyles } from './theme'

const EMPTY_FORM = { description: '' }

export default function CreateTripForm ({ user, onCreated, onDismiss, createTrip = _createTrip, accountGet = _account.get.bind(_account) }) {
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
      const userAccount = await accountGet()
      const trip = await createTrip(user.$id, userAccount.name, form)
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
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type='submit' disabled={saving} style={formStyles.saveButton}>
          {saving ? 'Saving…' : 'Save Trip'}
        </button>
        <button type='button' onClick={onDismiss} style={formStyles.cancelButton}>
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
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }
}
