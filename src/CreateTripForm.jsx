import { useState } from 'react'
import { createTrip } from './database'
import Field from './Field'

const EMPTY_FORM = { name: '', description: '' }

export default function CreateTripForm ({ userId, onCreated }) {
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
      const trip = await createTrip(userId, form)
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
        <h2 style={styles.heading}>My Trips</h2>
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
    borderBottom: '1px solid rgba(100,190,230,0.1)'
  },
  heading: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: '30px',
    fontWeight: '600',
    color: '#edf6fc',
    margin: 0,
    letterSpacing: '-0.01em'
  },
  newButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: 'none',
    background: '#3bbde8',
    color: '#07111f',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  form: {
    background: '#0d1e30',
    border: '1px solid rgba(100,190,230,0.1)',
    borderRadius: '12px',
    padding: '28px',
    marginBottom: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  error: {
    color: '#ff6b6b',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: 0
  },
  saveButton: {
    alignSelf: 'flex-start',
    padding: '10px 24px',
    borderRadius: '7px',
    border: 'none',
    background: '#3bbde8',
    color: '#07111f',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
}
