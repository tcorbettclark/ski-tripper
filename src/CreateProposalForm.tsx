import type { Models } from 'appwrite'
import { useState } from 'react'
import {
  account as _account,
  createAccommodation as _createAccommodation,
  createProposal as _createProposal,
} from './backend'
import { COUNTRIES } from './countries'
import Field from './Field'
import { borders, colors, fieldStyles, fonts, formStyles } from './theme'
import { isValidUrl } from './utils'

interface AccommodationInput {
  tempId: string
  name: string
  url: string
  cost: string
  description: string
}

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
      startDate: string
      endDate: string
    }
  ) => Promise<unknown>
  createAccommodation?: (
    proposalId: string,
    userId: string,
    data: { name: string; url?: string; cost?: string; description?: string }
  ) => Promise<unknown>
  accountGet?: () => Promise<Models.User>
}

const EMPTY_FORM = {
  resortName: '',
  country: '',
  altitudeRange: '',
  nearestAirport: '',
  transferTime: '',
  description: '',
  startDate: '',
  endDate: '',
}

function createEmptyAccommodation(): AccommodationInput {
  return {
    tempId: crypto.randomUUID(),
    name: '',
    url: '',
    cost: '',
    description: '',
  }
}

export default function CreateProposalForm({
  tripId,
  userId,
  onCreated,
  onDismiss,
  createProposal = _createProposal,
  createAccommodation = _createAccommodation,
  accountGet = _account.get.bind(_account),
}: CreateProposalFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [accommodations, setAccommodations] = useState<
    Record<string, AccommodationInput>
  >({
    [crypto.randomUUID()]: createEmptyAccommodation(),
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

  function updateAccommodation(
    tempId: string,
    field: keyof AccommodationInput,
    value: string
  ) {
    setAccommodations((prev) => ({
      ...prev,
      [tempId]: { ...prev[tempId], [field]: value },
    }))
  }

  function addAccommodation() {
    if (Object.keys(accommodations).length >= 5) return
    const newId = crypto.randomUUID()
    setAccommodations((prev) => ({
      ...prev,
      [newId]: createEmptyAccommodation(),
    }))
  }

  function removeAccommodation(tempId: string) {
    if (Object.keys(accommodations).length <= 1) return
    setAccommodations((prev) => {
      const next = { ...prev }
      delete next[tempId]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    for (const acc of Object.values(accommodations)) {
      if (acc.url && !isValidUrl(acc.url)) {
        setError('Invalid URL: only http and https schemes are allowed.')
        return
      }
    }
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
        startDate: form.startDate,
        endDate: form.endDate,
      })
      const typedProposal = proposal as { $id: string }
      for (const acc of Object.values(accommodations)) {
        if (acc.name.trim()) {
          await createAccommodation(typedProposal.$id, userId, {
            name: acc.name,
            url: acc.url || undefined,
            cost: acc.cost || undefined,
            description: acc.description || undefined,
          })
        }
      }
      onCreated(proposal)
      setForm(EMPTY_FORM)
      setAccommodations({ [crypto.randomUUID()]: createEmptyAccommodation() })
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
        options={COUNTRIES}
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
      <div style={styles.accommodationsSection}>
        <div style={styles.accommodationsHeader}>
          <h4 style={styles.sectionTitle}>Accommodations</h4>
          <button
            type="button"
            onClick={addAccommodation}
            disabled={Object.keys(accommodations).length >= 5}
            style={styles.addButton}
          >
            + Add Accommodation
          </button>
        </div>
        {Object.entries(accommodations).map(([tempId, acc], index) => (
          <div key={tempId} style={styles.accommodationCard}>
            <div style={styles.accommodationCardHeader}>
              <span style={styles.accommodationLabel}>
                Accommodation {index + 1}
              </span>
              {Object.keys(accommodations).length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAccommodation(tempId)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              )}
            </div>
            <Field
              label="Name"
              name={`acc-name-${tempId}`}
              value={acc.name}
              onChange={(e) =>
                updateAccommodation(tempId, 'name', e.target.value)
              }
              required
              placeholder="e.g. Hotel Mont Blanc"
            />
            <Field
              label="URL"
              name={`acc-url-${tempId}`}
              type="url"
              value={acc.url}
              onChange={(e) =>
                updateAccommodation(tempId, 'url', e.target.value)
              }
              placeholder="https://..."
            />
            <Field
              label="Cost"
              name={`acc-cost-${tempId}`}
              value={acc.cost}
              onChange={(e) =>
                updateAccommodation(tempId, 'cost', e.target.value)
              }
              placeholder="e.g. €150/night"
            />
            <Field
              label="Description"
              name={`acc-desc-${tempId}`}
              value={acc.description}
              onChange={(e) =>
                updateAccommodation(tempId, 'description', e.target.value)
              }
              placeholder="Short description of the accommodation"
            />
          </div>
        ))}
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
  accommodationsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    background: colors.bgInput,
    borderRadius: '8px',
  },
  accommodationsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontSize: '14px',
    cursor: 'pointer',
  },
  accommodationCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: colors.bgCard,
    borderRadius: '8px',
    border: borders.card,
  },
  accommodationCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accommodationLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  removeButton: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: borders.card,
    background: 'transparent',
    color: colors.error,
    fontSize: '12px',
    cursor: 'pointer',
  },
} as const
