import { useState } from 'react'
import {
  getTripByCode as _getTripByCode,
  joinTrip as _joinTrip,
  account as _account,
} from './backend'
import type { Models } from 'appwrite'
import Field from './Field'
import { colors, borders, formStyles } from './theme'

interface JoinTripFormProps {
  user: Models.User
  onJoined: (trip: unknown) => void
  onDismiss: () => void
  getTripByCode?: (code: string) => Promise<{ documents: unknown[] }>
  joinTrip?: (
    userId: string,
    userName: string,
    tripId: string
  ) => Promise<unknown>
  accountGet?: () => Promise<Models.User>
}

export default function JoinTripForm({
  user,
  onJoined,
  onDismiss,
  getTripByCode = _getTripByCode,
  joinTrip = _joinTrip,
  accountGet = _account.get.bind(_account),
}: JoinTripFormProps) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await getTripByCode(code.trim().toLowerCase())
      if (res.documents.length === 0)
        throw new Error('No trip found with that code.')
      const trip = res.documents[0]
      const userAccount = await accountGet()
      await joinTrip(user.$id, userAccount.name, (trip as { $id: string }).$id)
      onJoined(trip)
      setCode('')
      onDismiss()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <Field
        label="Trip Code"
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. colourful-skinny-screwdriver"
        required
      />
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type="submit" disabled={saving} style={formStyles.saveButton}>
          {saving ? 'Joining…' : 'Join Trip'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={formStyles.cancelButton}
        >
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
    gap: '20px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
} as const
