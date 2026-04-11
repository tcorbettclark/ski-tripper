import { useEffect, useState } from 'react'
import {
  createAccommodation as _createAccommodation,
  deleteAccommodation as _deleteAccommodation,
  listAccommodations as _listAccommodations,
  updateAccommodation as _updateAccommodation,
  updateProposal as _updateProposal,
} from './backend'
import { COUNTRIES } from './countries'
import Field from './Field'
import { borders, colors, fieldStyles, fonts, formStyles } from './theme'
import type { Accommodation, Proposal } from './types.d.ts'

interface AccommodationInput {
  id: string
  tempId: string
  name: string
  url: string
  cost: string
  description: string
}

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
  listAccommodations?: (proposalId: string) => Promise<Accommodation[]>
  createAccommodation?: (
    proposalId: string,
    userId: string,
    data: { name: string; url?: string; cost?: string; description?: string }
  ) => Promise<unknown>
  updateAccommodation?: (
    accommodationId: string,
    userId: string,
    data: { name?: string; url?: string; cost?: string; description?: string }
  ) => Promise<unknown>
  deleteAccommodation?: (
    accommodationId: string,
    userId: string
  ) => Promise<unknown>
}

function createEmptyAccommodation(tempId: string): AccommodationInput {
  return {
    id: '',
    tempId,
    name: '',
    url: '',
    cost: '',
    description: '',
  }
}

export default function EditProposalForm({
  proposal,
  userId,
  onUpdated,
  onCancel,
  updateProposal = _updateProposal,
  listAccommodations = _listAccommodations,
  createAccommodation = _createAccommodation,
  updateAccommodation = _updateAccommodation,
  deleteAccommodation = _deleteAccommodation,
}: EditProposalFormProps) {
  const [form, setForm] = useState({
    resortName: proposal.resortName || '',
    country: proposal.country || '',
    altitudeRange: proposal.altitudeRange || '',
    nearestAirport: proposal.nearestAirport || '',
    transferTime: proposal.transferTime || '',
    description: proposal.description || '',
    departureDate: proposal.departureDate || '',
    returnDate: proposal.returnDate || '',
  })
  const [accommodations, setAccommodations] = useState<
    Record<string, AccommodationInput>
  >({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAccommodations() {
      try {
        const existing = await listAccommodations(proposal.$id)
        if (existing.length === 0) {
          setAccommodations({
            [crypto.randomUUID()]: createEmptyAccommodation(
              crypto.randomUUID()
            ),
          })
        } else {
          const accMap: Record<string, AccommodationInput> = {}
          for (const acc of existing) {
            accMap[acc.$id] = {
              id: acc.$id,
              tempId: acc.$id,
              name: acc.name,
              url: acc.url,
              cost: acc.cost,
              description: acc.description,
            }
          }
          setAccommodations(accMap)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    loadAccommodations()
  }, [proposal.$id, listAccommodations])

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  function updateAccommodationField(
    tempId: string,
    field: keyof AccommodationInput,
    value: string
  ) {
    setAccommodations((prev) => ({
      ...prev,
      [tempId]: { ...prev[tempId], [field]: value },
    }))
  }

  async function addAccommodation() {
    if (Object.keys(accommodations).length >= 5) return
    const newId = crypto.randomUUID()
    setAccommodations((prev) => ({
      ...prev,
      [newId]: createEmptyAccommodation(newId),
    }))
  }

  async function removeAccommodation(tempId: string) {
    const acc = accommodations[tempId]
    if (!acc) return
    if (Object.keys(accommodations).length <= 1) return
    if (acc.id) {
      await deleteAccommodation(acc.id, userId)
    }
    setAccommodations((prev) => {
      const next = { ...prev }
      delete next[tempId]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateProposal(proposal.$id, userId, form)
      for (const acc of Object.values(accommodations)) {
        if (acc.id) {
          await updateAccommodation(acc.id, userId, {
            name: acc.name,
            url: acc.url || undefined,
            cost: acc.cost || undefined,
            description: acc.description || undefined,
          })
        } else {
          await createAccommodation(proposal.$id, userId, {
            name: acc.name,
            url: acc.url || undefined,
            cost: acc.cost || undefined,
            description: acc.description || undefined,
          })
        }
      }
      onUpdated(proposal)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>
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
        label="Depart on"
        name="departureDate"
        type="date"
        value={form.departureDate}
        onChange={handleChange}
        required
      />
      <Field
        label="Return on"
        name="returnDate"
        type="date"
        value={form.returnDate}
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
                updateAccommodationField(tempId, 'name', e.target.value)
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
                updateAccommodationField(tempId, 'url', e.target.value)
              }
              placeholder="https://..."
            />
            <Field
              label="Cost"
              name={`acc-cost-${tempId}`}
              value={acc.cost}
              onChange={(e) =>
                updateAccommodationField(tempId, 'cost', e.target.value)
              }
              placeholder="e.g. €150/night"
            />
            <Field
              label="Description"
              name={`acc-desc-${tempId}`}
              value={acc.description}
              onChange={(e) =>
                updateAccommodationField(tempId, 'description', e.target.value)
              }
              placeholder="Short description of the accommodation"
            />
          </div>
        ))}
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
  loading: {
    padding: '20px',
    textAlign: 'center' as const,
    color: colors.textSecondary,
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
