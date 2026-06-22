import { useCallback, useEffect, useRef, useState } from 'react'

import { COUNTRIES } from '../shared/countries'
import type { ResortWithEmbedding, User } from '../shared/types.d'
import { createProposal as _createProposal, getPb } from './backend'
import DateRangeField from './DateRangeField'
import Field from './Field'
import {
  borders,
  colors,
  fieldStyles,
  fontSizes,
  fonts,
  formStyles,
} from './theme'
import { ensureUrlScheme, getErrorMessage, isValidUrl } from './utils'

interface CreateProposalFormProps {
  tripId: string
  userId: string
  onCreated: (proposal: unknown) => void
  onDismiss: () => void
  resorts?: ResortWithEmbedding[]
  createProposal?: (
    tripId: string,
    userId: string,
    userName: string,
    data: {
      description: string
      startDate: string
      endDate: string
      resortData: {
        resortName: string
        country: string
        region: string
        summitAltitude: number
        baseAltitude: number
        nearestAirport: string
        transferTime: number | null
        pisteKm: number
        beginnerPct: number
        intermediatePct: number
        advancedPct: number
        liftCount: number
        snowReliability: 'high' | 'medium' | 'low'
        skiSeasonMonths: string
        websites: string[]
        latitude: string
        longitude: string
        linkedResortsDescription: string
      }
    }
  ) => Promise<unknown>
  accountGet?: () => Promise<User>
}

const EMPTY_FORM = {
  resortName: '',
  country: '',
  region: '',
  summitAltitude: '',
  baseAltitude: '',
  nearestAirport: '',
  transferTime: '',
  pisteKm: '',
  beginnerPct: '',
  intermediatePct: '',
  advancedPct: '',
  liftCount: '',
  snowReliability: '' as '' | 'high' | 'medium' | 'low',
  skiSeasonMonths: '',
  websites: '',
  latitude: '',
  longitude: '',
  linkedResortsDescription: '',
  description: '',
  startDate: '',
  endDate: '',
}

function filterResorts(
  resorts: ResortWithEmbedding[],
  query: string
): ResortWithEmbedding[] {
  if (!query.trim()) return []
  const lower = query.toLowerCase()
  return resorts.filter(
    (r) =>
      r.resortName.toLowerCase().includes(lower) ||
      r.country.toLowerCase().includes(lower) ||
      r.region.toLowerCase().includes(lower)
  )
}

function resortToFormFields(
  resort: ResortWithEmbedding
): Partial<typeof EMPTY_FORM> {
  return {
    resortName: resort.resortName,
    country: resort.country,
    region: resort.region,
    summitAltitude: resort.summitAltitude ? String(resort.summitAltitude) : '',
    baseAltitude: resort.baseAltitude ? String(resort.baseAltitude) : '',
    nearestAirport: resort.nearestAirport,
    transferTime:
      resort.transferTime != null ? String(resort.transferTime) : '',
    pisteKm: resort.pisteKm ? String(resort.pisteKm) : '',
    beginnerPct: resort.beginnerPct ? String(resort.beginnerPct) : '',
    intermediatePct: resort.intermediatePct
      ? String(resort.intermediatePct)
      : '',
    advancedPct: resort.advancedPct ? String(resort.advancedPct) : '',
    liftCount: resort.liftCount ? String(resort.liftCount) : '',
    snowReliability: resort.snowReliability || '',
    skiSeasonMonths: resort.skiSeasonMonths,
    websites: resort.websites ? resort.websites.join(', ') : '',
    latitude: resort.latitude,
    longitude: resort.longitude,
    linkedResortsDescription: resort.linkedResortsDescription || '',
    description: resort.description || '',
  }
}

export default function CreateProposalForm({
  tripId,
  userId,
  onCreated,
  onDismiss,
  resorts = [],
  createProposal = _createProposal,
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
}: CreateProposalFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dateError, setDateError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const resortInputRef = useRef<HTMLInputElement>(null)

  const suggestions = filterResorts(resorts, form.resortName)

  const handleResortSelect = useCallback((resort: ResortWithEmbedding) => {
    setForm((f) => ({ ...f, ...resortToFormFields(resort) }))
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        resortInputRef.current &&
        !resortInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    if (name === 'resortName') {
      setShowSuggestions(true)
      setHighlightedIndex(-1)
    }
  }

  function handleResortKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleResortSelect(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.startDate || !form.endDate) {
      setDateError('Please select both a start and end date')
      return
    }
    setDateError('')
    setSaving(true)
    try {
      const userAccount = await accountGet()
      const proposal = await createProposal(tripId, userId, userAccount.name, {
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate,
        resortData: {
          resortName: form.resortName,
          country: form.country,
          region: form.region,
          summitAltitude: Number(form.summitAltitude),
          baseAltitude: Number(form.baseAltitude),
          nearestAirport: form.nearestAirport,
          transferTime: form.transferTime ? Number(form.transferTime) : null,
          pisteKm: Number(form.pisteKm),
          beginnerPct: Number(form.beginnerPct),
          intermediatePct: Number(form.intermediatePct),
          advancedPct: Number(form.advancedPct),
          liftCount: Number(form.liftCount),
          snowReliability: form.snowReliability || 'medium',
          skiSeasonMonths: form.skiSeasonMonths,
          websites: form.websites
            ? form.websites
                .split(/[,\s]+/)
                .map((u) => u.trim())
                .filter((u) => u && isValidUrl(ensureUrlScheme(u)))
            : [],
          latitude: form.latitude,
          longitude: form.longitude,
          linkedResortsDescription: form.linkedResortsDescription,
        },
      })
      onCreated(proposal)
      setForm(EMPTY_FORM)
      onDismiss()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.resortFieldWrapper}>
        <div style={fieldStyles.default.field}>
          <label htmlFor="resortName" style={fieldStyles.default.label}>
            Resort Name
          </label>
          <input
            ref={resortInputRef}
            id="resortName"
            name="resortName"
            data-testid="proposal-resort-name"
            value={form.resortName}
            onChange={handleChange}
            onFocus={() => {
              if (form.resortName.trim()) setShowSuggestions(true)
            }}
            onKeyDown={handleResortKeyDown}
            required
            placeholder="Type to search resorts..."
            autoComplete="off"
            style={fieldStyles.default.input}
          />
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            data-testid="resort-suggestions"
            style={styles.suggestions}
          >
            {suggestions.slice(0, 8).map((resort, i) => (
              <button
                key={resort.id}
                data-testid={`resort-suggestion-${resort.id}`}
                type="button"
                style={{
                  ...styles.suggestion,
                  background:
                    i === highlightedIndex
                      ? `${colors.accent}22`
                      : 'transparent',
                }}
                onMouseDown={() => {
                  handleResortSelect(resort)
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <span style={styles.suggestionName}>{resort.resortName}</span>
                <span style={styles.suggestionDetail}>
                  {resort.country}
                  {resort.region ? ` · ${resort.region}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Field
        label="Country"
        name="country"
        value={form.country}
        onChange={handleChange}
        required
        options={COUNTRIES}
        placeholder="Select a country…"
        data-testid="proposal-country"
      />
      <Field
        label="Region"
        name="region"
        value={form.region}
        onChange={handleChange}
        required
        placeholder="e.g. Alps"
        data-testid="proposal-region"
      />
      <Field
        label="Summit Altitude (m)"
        name="summitAltitude"
        type="number"
        value={form.summitAltitude}
        onChange={handleChange}
        required
        placeholder="e.g. 3330"
        data-testid="proposal-summit-altitude"
      />
      <Field
        label="Base Altitude (m)"
        name="baseAltitude"
        type="number"
        value={form.baseAltitude}
        onChange={handleChange}
        required
        placeholder="e.g. 1500"
        data-testid="proposal-base-altitude"
      />
      <Field
        label="Nearest Airport"
        name="nearestAirport"
        value={form.nearestAirport}
        onChange={handleChange}
        required
        placeholder="e.g. GVA"
        data-testid="proposal-nearest-airport"
      />
      <Field
        label="Transfer Time (mins)"
        name="transferTime"
        type="number"
        value={form.transferTime}
        onChange={handleChange}
        required
        placeholder="e.g. 90"
        data-testid="proposal-transfer-time"
      />
      <Field
        label="Piste Km"
        name="pisteKm"
        type="number"
        value={form.pisteKm}
        onChange={handleChange}
        required
        placeholder="e.g. 600"
        data-testid="proposal-piste-km"
      />
      <Field
        label="Beginner %"
        name="beginnerPct"
        type="number"
        value={form.beginnerPct}
        onChange={handleChange}
        required
        placeholder="e.g. 25"
        data-testid="proposal-beginner-pct"
      />
      <Field
        label="Intermediate %"
        name="intermediatePct"
        type="number"
        value={form.intermediatePct}
        onChange={handleChange}
        required
        placeholder="e.g. 50"
        data-testid="proposal-intermediate-pct"
      />
      <Field
        label="Advanced %"
        name="advancedPct"
        type="number"
        value={form.advancedPct}
        onChange={handleChange}
        required
        placeholder="e.g. 25"
        data-testid="proposal-advanced-pct"
      />
      <Field
        label="Lift Count"
        name="liftCount"
        type="number"
        value={form.liftCount}
        onChange={handleChange}
        required
        placeholder="e.g. 50"
        data-testid="proposal-lift-count"
      />
      <Field
        label="Snow Reliability"
        name="snowReliability"
        value={form.snowReliability}
        onChange={handleChange}
        required
        options={['high', 'medium', 'low']}
        placeholder="Select snow reliability…"
        data-testid="proposal-snow-reliability"
      />
      <Field
        label="Ski Season Months"
        name="skiSeasonMonths"
        value={form.skiSeasonMonths}
        onChange={handleChange}
        required
        placeholder="e.g. Dec-Apr"
        data-testid="proposal-ski-season-months"
      />
      <Field
        label="Websites"
        name="websites"
        type="text"
        value={form.websites}
        onChange={handleChange}
        required
        placeholder="e.g. example.com, ski-resort.com"
        data-testid="proposal-websites"
      />
      <Field
        label="Linked Resorts"
        name="linkedResortsDescription"
        value={form.linkedResortsDescription}
        onChange={handleChange}
        placeholder="e.g. Part of the 3 Vallées with Méribel and Courchevel"
        data-testid="proposal-linked-resorts"
      />
      <Field
        label="Latitude"
        name="latitude"
        value={form.latitude}
        onChange={handleChange}
        required
        placeholder="e.g. 45.9163"
        data-testid="proposal-latitude"
      />
      <Field
        label="Longitude"
        name="longitude"
        value={form.longitude}
        onChange={handleChange}
        required
        placeholder="e.g. 7.7554"
        data-testid="proposal-longitude"
      />
      <DateRangeField
        startDate={form.startDate}
        endDate={form.endDate}
        onChange={(startDate, endDate) => {
          setForm((f) => ({ ...f, startDate, endDate }))
          if (startDate && endDate) setDateError('')
        }}
        error={dateError}
      />
      <div style={fieldStyles.default.field}>
        <label htmlFor="description" style={fieldStyles.default.label}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          data-testid="proposal-description"
          value={form.description}
          onChange={handleChange}
          required
          style={styles.textarea}
        />
      </div>
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={styles.actions}>
        <button
          type="submit"
          disabled={saving}
          style={formStyles.saveButton}
          data-testid="proposal-submit"
        >
          {saving ? 'Saving draft…' : 'Create Draft Proposal'}
        </button>
        <button
          type="button"
          data-testid="proposal-cancel"
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
    flexDirection: 'column' as const,
    gap: '20px',
  },
  resortFieldWrapper: {
    position: 'relative' as const,
  },
  suggestions: {
    position: 'absolute' as const,
    zIndex: 10,
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '8px',
    marginTop: '4px',
    maxHeight: '240px',
    overflowY: 'auto' as const,
    width: '100%',
    boxShadow: '0 8px 24px var(--color-shadow)',
  },
  suggestion: {
    padding: '10px 14px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: '12px',
    width: '100%',
    textAlign: 'left' as const,
    border: 'none',
    background: 'transparent',
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  suggestionName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  suggestionDetail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  textarea: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: 'flex-end',
  },
} as const
