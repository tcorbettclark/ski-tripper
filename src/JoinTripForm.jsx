import { useState } from 'react'
import { getTripByCode as _getTripByCode, joinTrip as _joinTrip } from './database'
import Field from './Field'
import { colors, fonts, borders } from './theme'

export default function JoinTripForm ({
  user,
  onJoined,
  onDismiss,
  getTripByCode = _getTripByCode,
  joinTrip = _joinTrip
}) {
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
        label='Trip Code'
        name='code'
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder='e.g. colourful-skinny-screwdriver'
        required
      />
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type='submit' disabled={saving} style={styles.saveButton}>
          {saving ? 'Joining…' : 'Join Trip'}
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
