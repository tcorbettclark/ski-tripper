import { useState } from 'react'
import { createTrip } from './database'
import Field from './Field'
import { colors, fonts, borders } from './theme'

const EMPTY_FORM = { name: '', description: '' }

export default function CreateTripForm ({ user, onCreated }) {
  const [showForm, setShowForm] = useState(false)
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
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Trips I am coordinating</h2>
        <button
          onClick={() => {
            setShowForm((v) => !v)
            setError('')
          }}
          style={styles.newButton}
        >
          {showForm ? 'Cancel' : '+ New Trip'}
        </button>
      </div>

      {showForm && (
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
          <button type='submit' disabled={saving} style={styles.saveButton}>
            {saving ? 'Saving…' : 'Save Trip'}
          </button>
        </form>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    marginBottom: '8px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em'
  },
  newButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
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
  saveButton: {
    alignSelf: 'flex-start',
    padding: '10px 24px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
}
