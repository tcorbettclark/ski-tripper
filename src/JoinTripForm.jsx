import { useState } from 'react'
import { getTripByCode, joinTrip } from './database'
import Field from './Field'
import { colors, fonts, borders } from './theme'

export default function JoinTripForm ({ user, onJoined }) {
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit (e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await getTripByCode(code.trim().toLowerCase())
      if (res.documents.length === 0) throw new Error('No trip found with that code.')
      const trip = res.documents[0]
      await joinTrip(user.$id, trip.$id)
      onJoined(trip)
      setCode('')
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
        <h2 style={styles.heading}>Trips I am joining</h2>
        <button
          onClick={() => {
            setShowForm((v) => !v)
            setError('')
          }}
          style={styles.joinButton}
        >
          {showForm ? 'Cancel' : '+ Join Trip'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <Field
            label='Trip Code'
            name='code'
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type='submit' disabled={saving} style={styles.saveButton}>
            {saving ? 'Joining…' : 'Join Trip'}
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
  joinButton: {
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
