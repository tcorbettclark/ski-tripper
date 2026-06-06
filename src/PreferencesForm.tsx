import { type ReactNode, useState } from 'react'
import {
  createPreferences as _createPreferences,
  updatePreferences as _updatePreferences,
} from './backend'
import {
  BlackSlopeIcon,
  BlueSlopeIcon,
  ChaletIcon,
  FiveStarHotelIcon,
  GuesthouseIcon,
  HotelIcon,
  OffPisteIcon,
  OnPisteIcon,
  RedSlopeIcon,
  SkiIcon,
  SnowboardIcon,
} from './Icons'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import type { Preferences } from './types.d'
import { parseJsonArray } from './utils'

const skiSnowboardOptions = ['Ski', 'Snowboard']
const difficultyOptions = ['Black', 'Red', 'Blue']
const pisteOptions = ['On-Piste', 'Off-Piste']
const accommodationOptions = [
  '5-star hotel with spa etc',
  '4-star or below hotel',
  'Chalet',
  'Pension/guesthouse',
]
const timeLabels = ['Slopes', 'Eating', 'Après', 'Hotel Chill']

interface PreferencesFormProps {
  userId: string
  initial?: Preferences | null
  onSaved: (preferences: Preferences) => void
  onCancel?: () => void
  createPreferences?: (
    userId: string,
    data: Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>
  ) => Promise<Preferences>
  updatePreferences?: (
    userId: string,
    data: Partial<
      Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>
    >
  ) => Promise<Preferences>
}

export default function PreferencesForm({
  userId,
  initial,
  onSaved,
  onCancel,
  createPreferences = _createPreferences,
  updatePreferences = _updatePreferences,
}: PreferencesFormProps) {
  const initialSkiSnowboard = initial
    ? parseJsonArray(initial.skiSnowboard)
    : []
  const initialDifficulty = initial ? parseJsonArray(initial.difficulty) : []
  const initialPiste = initial ? parseJsonArray(initial.piste) : []
  const initialAccommodation = initial
    ? parseJsonArray(initial.accommodation)
    : []
  const initialTime = initial
    ? [
        initial.timeSlopes ?? 20,
        initial.timeEating ?? 20,
        initial.timeApres ?? 20,
        initial.timeHotel ?? 40,
      ]
    : [20, 20, 20, 40]

  const [skiSnowboard, setSkiSnowboard] =
    useState<string[]>(initialSkiSnowboard)
  const [difficulty, setDifficulty] = useState<string[]>(initialDifficulty)
  const [piste, setPiste] = useState<string[]>(initialPiste)
  const [timeAllocation, setTimeAllocation] = useState<number[]>(initialTime)
  const [accommodation, setAccommodation] =
    useState<string[]>(initialAccommodation)
  const [mostImportantAspect, setMostImportantAspect] = useState(
    initial?.mostImportantAspect ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleOption(
    option: string,
    selected: string[],
    setter: (v: string[]) => void
  ) {
    setter(
      selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option]
    )
  }

  function handleTimeChange(index: number, value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value / 10) * 10))
    setTimeAllocation((prev) => {
      const next = [...prev]
      next[index] = clamped
      return next
    })
  }

  const totalTime = timeAllocation.reduce((a, b) => a + b, 0)
  const timeError =
    totalTime !== 100 ? 'Time allocations must sum to 100%.' : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (timeError) {
      setError(timeError)
      return
    }
    setSaving(true)
    try {
      const data = {
        skiSnowboard: JSON.stringify(skiSnowboard),
        difficulty: JSON.stringify(difficulty),
        piste: JSON.stringify(piste),
        timeSlopes: timeAllocation[0],
        timeEating: timeAllocation[1],
        timeApres: timeAllocation[2],
        timeHotel: timeAllocation[3],
        accommodation: JSON.stringify(accommodation),
        mostImportantAspect,
      }
      const result = initial
        ? await updatePreferences(userId, data)
        : await createPreferences(userId, data)
      onSaved(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function renderCheckboxGroup(
    label: string,
    options: string[],
    selected: string[],
    setter: (v: string[]) => void,
    icons?: ((dim: boolean) => ReactNode)[]
  ) {
    return (
      <div style={styles.group}>
        <span style={styles.groupLabel}>{label}</span>
        <div style={styles.checkboxRow}>
          {options.map((opt, i) => {
            const checked = selected.includes(opt)
            return (
              <label key={opt} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOption(opt, selected, setter)}
                  style={styles.checkbox}
                />
                {icons?.[i] && (
                  <span style={styles.checkboxIcon}>{icons[i](!checked)}</span>
                )}
                <span
                  style={{
                    ...styles.checkboxText,
                    color: checked
                      ? colors.textPrimary
                      : mix('--color-textSecondary', 0.6),
                  }}
                >
                  {opt}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {renderCheckboxGroup(
        'Ski / Snowboard',
        skiSnowboardOptions,
        skiSnowboard,
        setSkiSnowboard,
        [
          (dim) => <SkiIcon dim={dim} hidden />,
          (dim) => <SnowboardIcon dim={dim} hidden />,
        ]
      )}
      {renderCheckboxGroup(
        'Difficulty',
        difficultyOptions,
        difficulty,
        setDifficulty,
        [
          (dim) => <BlackSlopeIcon dim={dim} hidden />,
          (dim) => <RedSlopeIcon dim={dim} hidden />,
          (dim) => <BlueSlopeIcon dim={dim} hidden />,
        ]
      )}
      {renderCheckboxGroup('Piste', pisteOptions, piste, setPiste, [
        (dim) => <OnPisteIcon dim={dim} hidden />,
        (dim) => <OffPisteIcon dim={dim} hidden />,
      ])}

      <div style={styles.group}>
        <span style={styles.groupLabel}>Time Allocation</span>
        <div style={styles.sliders}>
          {timeLabels.map((label, i) => (
            <div key={label} style={styles.sliderRow}>
              <span style={styles.sliderLabel}>{label}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={timeAllocation[i]}
                onChange={(e) => handleTimeChange(i, Number(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderValue}>{timeAllocation[i]}%</span>
            </div>
          ))}
        </div>
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>Total:</span>
          <span
            style={{
              ...styles.totalValue,
              color: timeError ? colors.error : colors.accent,
            }}
          >
            {totalTime}%
          </span>
        </div>
      </div>

      {renderCheckboxGroup(
        'Accommodation',
        accommodationOptions,
        accommodation,
        setAccommodation,
        [
          (dim) => <FiveStarHotelIcon dim={dim} hidden />,
          (dim) => <HotelIcon dim={dim} hidden />,
          (dim) => <ChaletIcon dim={dim} hidden />,
          (dim) => <GuesthouseIcon dim={dim} hidden />,
        ]
      )}

      <div style={styles.group}>
        <label htmlFor="mostImportantAspect" style={styles.groupLabel}>
          What kind of holiday do you like?
        </label>
        <textarea
          id="mostImportantAspect"
          value={mostImportantAspect}
          onChange={(e) => setMostImportantAspect(e.target.value)}
          placeholder="Tell us what matters most to you on a ski trip — the more detail the better! For example: &quot;I love long lunches in mountain restaurants, good snow, and lively après-ski&quot;"
          rows={4}
          style={styles.textareaInput}
        />
      </div>

      {error && <p style={formStyles.error}>{error}</p>}

      <div style={styles.actions}>
        <button type="submit" disabled={saving} style={formStyles.saveButton}>
          {saving
            ? 'Saving…'
            : initial
              ? 'Update Preferences'
              : 'Save Preferences'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={formStyles.cancelButton}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  group: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  groupLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  checkboxRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '14px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: colors.accent,
    cursor: 'pointer',
  },
  checkboxText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  checkboxIcon: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  sliders: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sliderLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textData,
    minWidth: '90px',
  },
  slider: {
    flex: 1,
    cursor: 'pointer',
  },
  sliderValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.accent,
    minWidth: '40px',
    textAlign: 'right' as const,
  },
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
  },
  textInput: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none' as const,
  },
  textareaInput: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none' as const,
    resize: 'vertical' as const,
    minHeight: '80px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end' as const,
    gap: '12px',
    marginTop: '8px',
  },
} as const
