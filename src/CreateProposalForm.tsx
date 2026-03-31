import { useState } from 'react'
import {
  createProposal as _createProposal,
  account as _account,
} from './backend'
import type { Models } from 'appwrite'
import Field from './Field'
import { colors, fonts, borders, formStyles, fieldStyles } from './theme'

interface CreateProposalFormProps {
  tripId: string
  userId: string
  onCreated: (proposal: unknown) => void
  onDismiss: () => void
  createProposal?: (
    tripId: string,
    userId: string,
    userName: string,
    data: {
      title: string
      description: string
      resortName: string
      country: string
      altitudeRange: string
      nearestAirport: string
      transferTime: string
      accommodationName: string
      accommodationUrl: string
      approximateCost: string
    }
  ) => Promise<unknown>
  accountGet?: () => Promise<Models.User>
}

const EMPTY_FORM = {
  resortName: '',
  country: '',
  altitudeRange: '',
  nearestAirport: '',
  transferTime: '',
  accommodationName: '',
  accommodationUrl: '',
  approximateCost: '',
  description: '',
}

export default function CreateProposalForm({
  tripId,
  userId,
  onCreated,
  onDismiss,
  createProposal = _createProposal,
  accountGet = _account.get.bind(_account),
}: CreateProposalFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const userAccount = await accountGet()
      const proposal = await createProposal(tripId, userId, userAccount.name, {
        title: form.resortName,
        description: form.description,
        resortName: form.resortName,
        country: form.country,
        altitudeRange: form.altitudeRange,
        nearestAirport: form.nearestAirport,
        transferTime: form.transferTime,
        accommodationName: form.accommodationName,
        accommodationUrl: form.accommodationUrl,
        approximateCost: form.approximateCost,
      })
      onCreated(proposal)
      setForm(EMPTY_FORM)
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
        label="Resort Name"
        name="resortName"
        value={form.resortName}
        onChange={handleChange}
        required
      />
      <Field
        label="Country"
        name="country"
        value={form.country}
        onChange={handleChange}
        required
      />
      <Field
        label="Altitude Range"
        name="altitudeRange"
        value={form.altitudeRange}
        onChange={handleChange}
        required
        placeholder="e.g. 1800m - 3200m"
      />
      <Field
        label="Nearest Airport"
        name="nearestAirport"
        value={form.nearestAirport}
        onChange={handleChange}
        required
        placeholder="e.g. GVA"
      />
      <Field
        label="Transfer Time"
        name="transferTime"
        value={form.transferTime}
        onChange={handleChange}
        required
        placeholder="e.g. 1h 30m"
      />
      <Field
        label="Accommodation Name"
        name="accommodationName"
        value={form.accommodationName}
        onChange={handleChange}
        required
      />
      <Field
        label="Accommodation URL"
        name="accommodationUrl"
        type="url"
        value={form.accommodationUrl}
        onChange={handleChange}
      />
      <Field
        label="Approximate Cost"
        name="approximateCost"
        value={form.approximateCost}
        onChange={handleChange}
        required
      />
      <div style={fieldStyles.default.field}>
        <label htmlFor="description" style={fieldStyles.default.label}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          required
          style={styles.textarea}
        />
      </div>
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={styles.actions}>
        <button type="submit" disabled={saving} style={formStyles.saveButton}>
          {saving ? 'Saving…' : 'Create Proposal'}
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
  textarea: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
} as const
