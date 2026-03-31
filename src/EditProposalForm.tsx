import { useState } from 'react'
import {
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
} from './backend'
import Field from './Field'
import { colors, fonts, borders, formStyles, fieldStyles } from './theme'

interface Proposal {
  $id: string
  resortName?: string
  country?: string
  altitudeRange?: string
  nearestAirport?: string
  transferTime?: string
  accommodationName?: string
  accommodationUrl?: string
  approximateCost?: string
  description?: string
}

interface EditProposalFormProps {
  proposal: Proposal
  userId: string
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onCancel: () => void
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
  deleteProposal?: (proposalId: string, userId: string) => Promise<void>
}

export default function EditProposalForm({
  proposal,
  userId,
  onUpdated,
  onDeleted,
  onCancel,
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
}: EditProposalFormProps) {
  const [form, setForm] = useState({
    resortName: proposal.resortName || '',
    country: proposal.country || '',
    altitudeRange: proposal.altitudeRange || '',
    nearestAirport: proposal.nearestAirport || '',
    transferTime: proposal.transferTime || '',
    accommodationName: proposal.accommodationName || '',
    accommodationUrl: proposal.accommodationUrl || '',
    approximateCost: proposal.approximateCost || '',
    description: proposal.description || '',
  })
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
      const updated = await updateProposal(proposal.$id, userId, form)
      onUpdated(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this proposal?')) return
    setSaving(true)
    try {
      await deleteProposal(proposal.$id, userId)
      onDeleted(proposal.$id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
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
        <button type="submit" disabled={saving} style={styles.saveButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving}
          style={styles.deleteButton}
        >
          Delete
        </button>
      </div>
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '8px 0',
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
  actions: { display: 'flex', gap: '8px', alignItems: 'center' },
  saveButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: formStyles.saveButton.fontFamily,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: formStyles.cancelButton.fontFamily,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: '1px solid rgba(255,107,107,0.25)',
    background: 'transparent',
    color: colors.error,
    fontFamily: formStyles.cancelButton.fontFamily,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
} as const
