import { sanitizeUrl } from '@braintree/sanitize-url'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { adjectives, nouns } from './words'

dayjs.extend(relativeTime)

export { dayjs, sanitizeUrl }

export function ensureUrlScheme(url: string): string {
  if (!url.trim()) return url
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export function isValidUrl(url: string | undefined): boolean {
  if (!url) return true
  return sanitizeUrl(url) !== 'about:blank'
}

export function randomPassword(length = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

export function randomThreeWords(): string {
  const ints = new Uint32Array(3)
  crypto.getRandomValues(ints)
  const one = adjectives[ints[0] % adjectives.length]
  const two = adjectives[ints[1] % adjectives.length]
  const three = nouns[ints[2] % nouns.length]
  return `${one}-${two}-${three}`.toLowerCase()
}

export function formatDate(iso: string) {
  return dayjs(iso).format('ddd DD MMM YYYY')
}

export function formatDateTime(iso: string) {
  return dayjs(iso).format('D MMM YYYY, h:mm A')
}

export function formatTimeRemaining(endDate: string) {
  const end = dayjs(endDate)
  if (end.isBefore(dayjs())) return '0 days left'
  return end.fromNow()
}

export function formatCountdown(endDate: string) {
  const now = dayjs()
  const end = dayjs(endDate)
  const diffMs = end.diff(now)
  if (diffMs <= 0) return 'Ended'
  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${seconds}s`
}

export function formatTransferTime(minutes: number | null): string {
  if (minutes == null) return ''
  if (minutes <= 0) return '0 mins'
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return mins === 1 ? '1 min' : `${mins} mins`
  if (mins === 0) return hrs === 1 ? '1 hr' : `${hrs} hrs`
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`
}

export function formatRelativeTime(iso: string) {
  const date = dayjs(iso)
  const diffDays = dayjs().diff(date, 'day')
  if (diffDays < 3) return date.fromNow()
  return formatDate(iso)
}

const FRIENDLY_MESSAGES: Record<
  string,
  Record<string, Record<string, string>>
> = {
  _: {
    validation_not_unique: {
      email: 'An account with this email already exists.',
      name: 'This name is already taken.',
      _: 'This value is already taken.',
    },
    validation_required: {
      _: 'This field is required.',
    },
    validation_invalid_old_password: {
      _: 'The current password is incorrect.',
    },
    validation_email_domain_not_allowed: {
      _: 'This email domain is not allowed.',
    },
    validation_min_text_constraint: {
      _: 'Too short.',
    },
    validation_max_text_constraint: {
      _: 'Too long.',
    },
    validation_invalid_format: {
      _: 'Invalid format.',
    },
    validation_invalid_or_existing_id: {
      _: 'This ID is invalid or already in use.',
    },
  },
  auth: {
    validation_not_unique: {
      name: 'That display name is already taken. Try another?',
    },
  },
}

function friendlyFieldMessage(
  field: string,
  code: string,
  msg: string,
  context?: string
): string {
  const ctx = context ?? '_'
  return (
    FRIENDLY_MESSAGES[ctx]?.[code]?.[field] ??
    FRIENDLY_MESSAGES._[code]?.[field] ??
    FRIENDLY_MESSAGES[ctx]?.[code]?._ ??
    FRIENDLY_MESSAGES._[code]?._ ??
    msg
  )
}

export function getErrorMessage(err: unknown, context?: string): string {
  if (!(err instanceof Error)) return String(err)
  const response = (err as unknown as Record<string, unknown>).response
  if (response && typeof response === 'object') {
    const data = (response as Record<string, unknown>).data
    if (data && typeof data === 'object') {
      const fieldErrors = Object.entries(data as Record<string, unknown>)
        .filter(([, v]) => v && typeof v === 'object')
        .map(([field, messages]) => {
          const msg = messages as Record<string, unknown>
          const code = typeof msg.code === 'string' ? msg.code : ''
          if (msg.message && typeof msg.message === 'string') {
            const friendly = friendlyFieldMessage(
              field,
              code,
              msg.message,
              context
            )
            return `${field}: ${friendly}`
          }
          const vals = Object.values(msg)
          if (vals.length > 0 && typeof vals[0] === 'string') {
            const friendly = friendlyFieldMessage(field, code, vals[0], context)
            return `${field}: ${friendly}`
          }
          return null
        })
        .filter(Boolean)
      if (fieldErrors.length > 0) return fieldErrors.join('; ')
    }
    if (typeof (response as Record<string, unknown>).message === 'string') {
      return (response as Record<string, unknown>).message as string
    }
  }
  return err.message
}
