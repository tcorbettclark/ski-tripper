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

export function parseJsonArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // fallthrough
  }
  return []
}

export function parseJsonNumberArray(value: string | number[]): number[] {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // fallthrough
  }
  return []
}

export function formatRelativeTime(iso: string) {
  const date = dayjs(iso)
  const diffDays = dayjs().diff(date, 'day')
  if (diffDays < 3) return date.fromNow()
  return formatDate(iso)
}
