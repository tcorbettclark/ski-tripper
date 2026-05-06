import { describe, expect, it } from 'bun:test'
import { formatDate, getDaysRemaining } from './utils'

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2026-04-29T00:00:00Z')).toBe('29 Apr 2026')
  })

  it('formats a date-only string', () => {
    expect(formatDate('2026-01-05')).toBe('05 Jan 2026')
  })
})

describe('getDaysRemaining', () => {
  it('returns days until a future date', () => {
    const now = new Date('2026-05-06T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(getDaysRemaining('2026-05-09T00:00:00Z')).toBe(3)
    } finally {
      Date.now = realNow
    }
  })

  it('returns 0 for a past date', () => {
    const now = new Date('2026-05-10T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(getDaysRemaining('2026-05-06T00:00:00Z')).toBe(0)
    } finally {
      Date.now = realNow
    }
  })

  it('returns 1 for same-day boundary', () => {
    const now = new Date('2026-05-06T00:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(getDaysRemaining('2026-05-06T23:59:59Z')).toBe(1)
    } finally {
      Date.now = realNow
    }
  })

  it('returns 0 when end date is exactly now', () => {
    const now = new Date('2026-05-06T12:00:00Z').getTime()
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(getDaysRemaining('2026-05-06T12:00:00Z')).toBe(0)
    } finally {
      Date.now = realNow
    }
  })
})
