import { useState } from 'react'
import { updateProposal as _updateProposal } from './backend'
import { COUNTRIES } from './countries'
import DateRangeField from './DateRangeField'
import Field from './Field'
import { borders, colors, fieldStyles, fonts, formStyles } from './theme'
import type { Proposal } from './types.d'
import { ensureUrlScheme, isValidUrl } from './utils'

const SUITABILITY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const

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
    summitAltitude: proposal.summitAltitude?.toString() || '',
    baseAltitude: proposal.baseAltitude?.toString() || '',
    nearestAirport: proposal.nearestAirport || '',
    transferTime: proposal.transferTime || '',
    pisteKm: proposal.pisteKm?.toString() || '',
    suitableFor: proposal.suitableFor || [],
    liftCount: proposal.liftCount?.toString() || '',
    snowReliability: proposal.snowReliability || '',
    skiSeasonMonths: proposal.skiSeasonMonths || '',
    websites: proposal.websites ? proposal.websites.join(', ') : '',
    latitude: proposal.latitude || '',
    longitude: proposal.longitude || '',
    linkedResortsDescription: proposal.linkedResortsDescription || '',
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
        websites: form.websites
          ? form.websites
              .split(/[,\s]+/)
              .map((u) => u.trim())
              .filter((u) => u && isValidUrl(ensureUrlScheme(u)))
          : [],
        summitAltitude: Number(form.summitAltitude),
        baseAltitude: Number(form.baseAltitude),
        pisteKm: Number(form.pisteKm),
        liftCount: Number(form.liftCount),
        suitableFor: form.suitableFor,
        linkedResortsDescription: form.linkedResortsDescription,
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
        label="Summit Altitude (m)"
        name="summitAltitude"
        type="number"
        value={form.summitAltitude}
        onChange={handleChange}
        required
        placeholder="e.g. 3330"
      />
      <Field
        label="Base Altitude (m)"
        name="baseAltitude"
        type="number"
        value={form.baseAltitude}
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
      <div style={fieldStyles.default.field}>
        <span style={fieldStyles.default.label}>Suitable For</span>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {SUITABILITY_LEVELS.map((level) => (
            <label
              key={level}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={form.suitableFor.includes(level)}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    suitableFor: e.target.checked
                      ? [...f.suitableFor, level].sort(
                          (a, b) =>
                            SUITABILITY_LEVELS.indexOf(
                              a as (typeof SUITABILITY_LEVELS)[number]
                            ) -
                            SUITABILITY_LEVELS.indexOf(
                              b as (typeof SUITABILITY_LEVELS)[number]
                            )
                        )
                      : f.suitableFor.filter((l) => l !== level),
                  }))
                }}
              />
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </label>
          ))}
        </div>
      </div>
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
        label="Websites"
        name="websites"
        type="text"
        value={form.websites}
        onChange={handleChange}
        required
        placeholder="e.g. example.com, ski-resort.com"
      />
      <Field
        label="Linked Resorts"
        name="linkedResortsDescription"
        value={form.linkedResortsDescription}
        onChange={handleChange}
        placeholder="e.g. Part of the 3 Vallées with Méribel and Courchevel"
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
      <DateRangeField
        startDate={form.startDate}
        endDate={form.endDate}
        onChange={(startDate, endDate) =>
          setForm((f) => ({ ...f, startDate, endDate }))
        }
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
