import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  ensureUrlScheme,
  formatDate,
  formatRelativeTime,
  formatTimeRemaining,
} from './utils'

const OriginalDate = Date
const MOCK_NOW = new OriginalDate('2026-05-06T12:00:00Z').getTime()

beforeAll(() => {
  globalThis.Date = new Proxy(OriginalDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) {
        return new target(MOCK_NOW)
      }
      return Reflect.construct(target, args, newTarget)
    },
    get(target, prop, receiver) {
      if (prop === 'now') return () => MOCK_NOW
      return Reflect.get(target, prop, receiver)
    },
  }) as DateConstructor
})

afterAll(() => {
  globalThis.Date = OriginalDate
})

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2026-04-29T00:00:00Z')).toBe('Wed 29 Apr 2026')
  })

  it('formats a date-only string', () => {
    expect(formatDate('2026-01-05')).toBe('Mon 05 Jan 2026')
  })
})

describe('formatTimeRemaining', () => {
  it('returns relative time for a future date', () => {
    expect(formatTimeRemaining('2026-05-09T12:00:00Z')).toBe('in 3 days')
  })

  it('uses singular for 1 day', () => {
    expect(formatTimeRemaining('2026-05-07T12:00:00Z')).toBe('in a day')
  })

  it('returns 0 days left for a past date', () => {
    expect(formatTimeRemaining('2026-05-06T00:00:00Z')).toBe('0 days left')
  })

  it('shows hours when less than a day remains', () => {
    expect(formatTimeRemaining('2026-05-06T17:00:00Z')).toBe('in 5 hours')
  })

  it('uses singular for 1 hour', () => {
    expect(formatTimeRemaining('2026-05-06T13:00:00Z')).toBe('in an hour')
  })
})

describe('formatRelativeTime', () => {
  it('returns relative time for a recent date (< 3 days)', () => {
    expect(formatRelativeTime('2026-05-05T12:00:00Z')).toBe('a day ago')
  })

  it('returns relative time for a very recent date', () => {
    expect(formatRelativeTime('2026-05-06T11:30:00Z')).toBe('30 minutes ago')
  })

  it('falls back to formatDate for older dates (>= 3 days)', () => {
    expect(formatRelativeTime('2026-05-01T12:00:00Z')).toBe('Fri 01 May 2026')
  })
})

describe('ensureUrlScheme', () => {
  it('prepends https:// when no scheme is present', () => {
    expect(ensureUrlScheme('example.com')).toBe('https://example.com')
  })

  it('prepends https:// for a URL with path and no scheme', () => {
    expect(ensureUrlScheme('example.com/ski')).toBe('https://example.com/ski')
  })

  it('does not modify a URL that already has https://', () => {
    expect(ensureUrlScheme('https://example.com')).toBe('https://example.com')
  })

  it('does not modify a URL that already has http://', () => {
    expect(ensureUrlScheme('http://example.com')).toBe('http://example.com')
  })

  it('handles uppercase HTTPS:// without modifying', () => {
    expect(ensureUrlScheme('HTTPS://example.com')).toBe('HTTPS://example.com')
  })

  it('handles uppercase HTTP:// without modifying', () => {
    expect(ensureUrlScheme('HTTP://example.com')).toBe('HTTP://example.com')
  })

  it('returns empty string unchanged', () => {
    expect(ensureUrlScheme('')).toBe('')
  })

  it('returns whitespace-only string unchanged', () => {
    expect(ensureUrlScheme('   ')).toBe('   ')
  })
})
