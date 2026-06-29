import { useState } from 'react'
import type { User } from '../shared/types.d'
import { createTrip as _createTrip, getPb } from './backend'
import Field from './Field'
import { borders, colors, formStyles } from './theme'
import { toast } from './toast'
import { getErrorMessage } from './utils'

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
    const record = getPb().authStore.record as Record<string, unknown> | null
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

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const userAccount = await accountGet()
      const trip = await createTrip(user.id, userAccount.name, form)
      onCreated(trip)
      setForm({ description: '' })
      onDismiss()
    } catch (err: unknown) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <Field
        label="Description"
        name="description"
        data-testid="trip-description"
        value={form.description}
        onChange={handleChange}
        placeholder="e.g. 5 days in Val d'Isère, late February, intermediate+ skiers"
        required
      />
      <div style={styles.actions}>
        <button
          type="submit"
          disabled={saving}
          style={formStyles.saveButton}
          data-testid="trip-save"
        >
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
