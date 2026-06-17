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

export function getErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const response = (err as unknown as Record<string, unknown>).response
  if (response && typeof response === 'object') {
    const data = (response as Record<string, unknown>).data
    if (data && typeof data === 'object') {
      const fieldErrors = Object.entries(data as Record<string, unknown>)
        .filter(([, v]) => v && typeof v === 'object')
        .map(([field, messages]) => {
          const msg = messages as Record<string, unknown>
          if (msg.message && typeof msg.message === 'string') {
            return `${field}: ${msg.message}`
          }
          const vals = Object.values(msg)
          if (vals.length > 0 && typeof vals[0] === 'string') {
            return `${field}: ${vals[0]}`
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
