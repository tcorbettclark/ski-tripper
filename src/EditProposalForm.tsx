import { useState } from 'react'
import { updateProposal as _updateProposal } from './backend'
import { COUNTRIES } from './countries'
import Field from './Field'
import { borders, colors, fieldStyles, fonts, formStyles } from './theme'
import type { Proposal } from './types.d.ts'
import { ensureUrlScheme } from './utils'

interface EditProposalFormProps {
  proposal: Proposal
  userId: string
  onUpdated: (proposal: unknown) => void
  onCancel: () => void
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
}

export default function EditProposalForm({
  proposal,
  userId,
  onUpdated,
  onCancel,
  updateProposal = _updateProposal,
}: EditProposalFormProps) {
  const [form, setForm] = useState({
    resortName: proposal.resortName || '',
    country: proposal.country || '',
    region: proposal.region || '',
    topAltitude: proposal.topAltitude?.toString() || '',
    bottomAltitude: proposal.bottomAltitude?.toString() || '',
    nearestAirport: proposal.nearestAirport || '',
    transferTime: proposal.transferTime || '',
    pisteKm: proposal.pisteKm?.toString() || '',
    difficulty: proposal.difficulty || '',
    liftCount: proposal.liftCount?.toString() || '',
    snowReliability: proposal.snowReliability || '',
    skiSeasonMonths: proposal.skiSeasonMonths || '',
    websiteUrl: proposal.websiteUrl || '',
    latitude: proposal.latitude || '',
    longitude: proposal.longitude || '',
    description: proposal.description || '',
    startDate: proposal.startDate || '',
    endDate: proposal.endDate || '',
  })
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
      const updatedProposal = await updateProposal(proposal.$id, userId, {
        ...form,
        websiteUrl: ensureUrlScheme(form.websiteUrl),
        topAltitude: Number(form.topAltitude),
        bottomAltitude: Number(form.bottomAltitude),
        pisteKm: Number(form.pisteKm),
        liftCount: Number(form.liftCount),
      })
      onUpdated(updatedProposal)
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
        options={COUNTRIES}
        placeholder="Select a country…"
      />
      <Field
        label="Region"
        name="region"
        value={form.region}
        onChange={handleChange}
        required
        placeholder="e.g. Alps"
      />
      <Field
        label="Top Altitude (m)"
        name="topAltitude"
        type="number"
        value={form.topAltitude}
        onChange={handleChange}
        required
        placeholder="e.g. 3330"
      />
      <Field
        label="Bottom Altitude (m)"
        name="bottomAltitude"
        type="number"
        value={form.bottomAltitude}
        onChange={handleChange}
        required
        placeholder="e.g. 1500"
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
        label="Piste Km"
        name="pisteKm"
        type="number"
        value={form.pisteKm}
        onChange={handleChange}
        required
        placeholder="e.g. 600"
      />
      <Field
        label="Difficulty"
        name="difficulty"
        value={form.difficulty}
        onChange={handleChange}
        required
        options={['beginner', 'intermediate', 'advanced']}
        placeholder="Select a difficulty…"
      />
      <Field
        label="Lift Count"
        name="liftCount"
        type="number"
        value={form.liftCount}
        onChange={handleChange}
        required
        placeholder="e.g. 50"
      />
      <Field
        label="Snow Reliability"
        name="snowReliability"
        value={form.snowReliability}
        onChange={handleChange}
        required
        options={['high', 'medium', 'low']}
        placeholder="Select snow reliability…"
      />
      <Field
        label="Ski Season Months"
        name="skiSeasonMonths"
        value={form.skiSeasonMonths}
        onChange={handleChange}
        required
        placeholder="e.g. Dec-Apr"
      />
      <Field
        label="Website URL"
        name="websiteUrl"
        type="text"
        value={form.websiteUrl}
        onChange={handleChange}
        required
        placeholder="e.g. example.com"
      />
      <Field
        label="Latitude"
        name="latitude"
        value={form.latitude}
        onChange={handleChange}
        required
        placeholder="e.g. 45.9163"
      />
      <Field
        label="Longitude"
        name="longitude"
        value={form.longitude}
        onChange={handleChange}
        required
        placeholder="e.g. 7.7554"
      />
      <Field
        label="Start Date"
        name="startDate"
        type="date"
        value={form.startDate}
        onChange={handleChange}
        required
      />
      <Field
        label="End Date"
        name="endDate"
        type="date"
        value={form.endDate}
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
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
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
} as const
