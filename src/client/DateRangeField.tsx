import { type DateRange, DayPicker } from 'react-day-picker'
import { colors, fieldStyles, formStyles } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { dayjs } from './utils'
import 'react-day-picker/style.css'

interface DateRangeFieldProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
  label?: string
  minDate?: Date
  maxDate?: Date
  error?: string
}

function toISODate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD')
}

export default function DateRangeField({
  startDate,
  endDate,
  onChange,
  label = 'Trip Dates',
  minDate,
  maxDate: _maxDate,
  error,
}: DateRangeFieldProps) {
  const selected: DateRange | undefined = startDate
    ? {
        from: dayjs(startDate).toDate(),
        ...(endDate ? { to: dayjs(endDate).toDate() } : {}),
      }
    : undefined

  const isSmall = useIsSmallScreen()
  const numberOfMonths = isSmall ? 1 : 2

  const defaultMonth = startDate
    ? dayjs(startDate).toDate()
    : minDate || new Date()

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      onChange('', '')
      return
    }
    const start = toISODate(range.from)
    const end = range.to ? toISODate(range.to) : ''
    onChange(start, end)
  }

  return (
    <div style={styles.container} data-testid="date-range-field">
      <span style={fieldStyles.default.label}>{label}</span>
      <DayPicker
        mode="range"
        selected={selected}
        onSelect={handleSelect}
        numberOfMonths={numberOfMonths}
        defaultMonth={defaultMonth}
        weekStartsOn={6}
        showWeekNumber
        ISOWeek
        disabled={[{ before: minDate || new Date() }]}
        modifiers={{ saturday: { dayOfWeek: [6] } }}
        modifiersStyles={{
          saturday: {
            fontWeight: 700,
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textDecorationColor: colors.accent,
            textDecorationThickness: '2px',
          },
        }}
        styles={{
          root: { color: colors.textPrimary },
          day_button: {
            borderColor: 'transparent',
            color: colors.textPrimary,
          },
          month_caption: {
            color: colors.textPrimary,
          },
          months: {
            flexWrap: isSmall ? 'wrap' : 'nowrap',
          },
          weekday: {
            color: colors.textSecondary,
          },
          week_number: {
            color: colors.textSecondary,
          },
          button_previous: {
            color: colors.textPrimary,
          },
          button_next: {
            color: colors.textPrimary,
          },
        }}
      />
      {error && <p style={formStyles.error}>{error}</p>}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '7px',
  },
} as const
