import { describe, expect, it } from 'bun:test'
import { formatDate, formatTimeRemaining } from './utils'

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2026-04-29T00:00:00Z')).toBe('29 Apr 2026')
  })

  it('formats a date-only string', () => {
    expect(formatDate('2026-01-05')).toBe('05 Jan 2026')
  })
})

describe('formatTimeRemaining', () => {
  it('returns humanized duration for a future date', () => {
    const now = new Date('2026-05-06T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(formatTimeRemaining('2026-05-09T12:00:00Z')).toBe('3 days left')
    } finally {
      Date.now = realNow
    }
  })

  it('uses singular for 1 day', () => {
    const now = new Date('2026-05-06T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(formatTimeRemaining('2026-05-07T12:00:00Z')).toBe('1 day left')
    } finally {
      Date.now = realNow
    }
  })

  it('returns 0 days left for a past date', () => {
    const now = new Date('2026-05-10T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(formatTimeRemaining('2026-05-06T00:00:00Z')).toBe('0 days left')
    } finally {
      Date.now = realNow
    }
  })

  it('shows hours when less than a day remains', () => {
    const now = new Date('2026-05-06T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(formatTimeRemaining('2026-05-06T17:00:00Z')).toBe('5 hours left')
    } finally {
      Date.now = realNow
    }
  })

  it('uses singular for 1 hour', () => {
    const now = new Date('2026-05-06T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(formatTimeRemaining('2026-05-06T13:00:00Z')).toBe('1 hour left')
    } finally {
      Date.now = realNow
    }
  })
})
