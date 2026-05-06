import { sanitizeUrl } from '@braintree/sanitize-url'
import humanizeDuration from 'humanize-duration'
import adjectives from 'threewords/data/adjectives.json'
import nouns from 'threewords/data/nouns.json'

export { sanitizeUrl }

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
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTimeRemaining(endDate: string) {
  const ms = new Date(endDate).getTime() - Date.now()
  if (ms <= 0) return '0 days left'
  return `${humanizeDuration(ms, { largest: 1, round: true })} left`
}
