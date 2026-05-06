import { sanitizeUrl } from '@braintree/sanitize-url'
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

export function getDaysRemaining(endDate: string) {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
}
