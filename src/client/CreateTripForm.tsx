import { useState } from 'react'
import type { User } from '../shared/types.d'
import pb, { createTrip as _createTrip } from './backend'
import Field from './Field'
import { borders, colors, formStyles } from './theme'

interface CreateTripFormProps {
  user: User
  onCreated: (trip: unknown) => void
  onDismiss: () => void
  createTrip?: (
    userId: string,
    userName: string,
    data: { description: string }
  ) => Promise<unknown>
  accountGet?: () => Promise<User>
}

export default function CreateTripForm({
  user,
  onCreated,
  onDismiss,
  createTrip = _createTrip,
  accountGet = () => {
    const record = pb.authStore.record as Record<string, unknown> | null
    if (!record) return Promise.reject(new Error('Not authenticated'))
    return Promise.resolve({
      id: record.id as string,
      name: (record.name as string) || '',
      email: record.email as string,
      emailVerification: record.verified as boolean,
    } as User)
  },
}: CreateTripFormProps) {
  const [form, setForm] = useState({ description: '' })
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
      const userAccount = await accountGet()
      const trip = await createTrip(user.id, userAccount.name, form)
      onCreated(trip)
      setForm({ description: '' })
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
        label="Description"
        name="description"
        value={form.description}
        onChange={handleChange}
        placeholder="e.g. 5 days in Val d'Isère, late February, intermediate+ skiers"
        required
      />
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type="submit" disabled={saving} style={formStyles.saveButton}>
          {saving ? 'Saving…' : 'Save Trip'}
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
