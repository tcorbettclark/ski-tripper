import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  ensureUrlScheme,
  formatDate,
  formatRelativeTime,
  formatTimeRemaining,
  formatTransferTime,
  getErrorMessage,
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

describe('formatTransferTime', () => {
  it('formats minutes only', () => {
    expect(formatTransferTime(30)).toBe('30 mins')
  })

  it('formats single minute', () => {
    expect(formatTransferTime(1)).toBe('1 min')
  })

  it('formats hours only', () => {
    expect(formatTransferTime(120)).toBe('2 hrs')
  })

  it('formats single hour', () => {
    expect(formatTransferTime(60)).toBe('1 hr')
  })

  it('formats hours and minutes', () => {
    expect(formatTransferTime(90)).toBe('1 hr 30 mins')
  })

  it('formats hours with singular minute', () => {
    expect(formatTransferTime(61)).toBe('1 hr 1 min')
  })

  it('formats 0 minutes', () => {
    expect(formatTransferTime(0)).toBe('0 mins')
  })

  it('returns empty string for null', () => {
    expect(formatTransferTime(null)).toBe('')
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

describe('getErrorMessage', () => {
  it('returns the message from a plain Error', () => {
    expect(getErrorMessage(new Error('something failed'))).toBe(
      'something failed'
    )
  })

  it('returns String of non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string')
    expect(getErrorMessage(42)).toBe('42')
  })

  it('extracts PocketBase field-level errors from response.data', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          url: { message: 'Must be a valid url' },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('url: Must be a valid url')
  })

  it('uses field-specific friendly message for validation_not_unique on email', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          email: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe(
      'email: An account with this email already exists.'
    )
  })

  it('uses field-specific friendly message for validation_not_unique on name', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          name: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('name: This name is already taken.')
  })

  it('uses generic friendly message for validation_not_unique on unknown fields', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          code: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('code: This value is already taken.')
  })

  it('uses friendly message for validation_required', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          password: {
            code: 'validation_required',
            message: 'Cannot be blank.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('password: This field is required.')
  })

  it('uses friendly message for validation_invalid_old_password', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          oldPassword: {
            code: 'validation_invalid_old_password',
            message: 'Missing or invalid old password.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe(
      'oldPassword: The current password is incorrect.'
    )
  })

  it('uses friendly message for validation_email_domain_not_allowed', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          email: {
            code: 'validation_email_domain_not_allowed',
            message: 'Email domain is not allowed',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe(
      'email: This email domain is not allowed.'
    )
  })

  it('uses friendly message for validation_min_text_constraint', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          password: {
            code: 'validation_min_text_constraint',
            message: 'Must be at least 8 character(s)',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('password: Too short.')
  })

  it('uses friendly message for validation_max_text_constraint', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          name: {
            code: 'validation_max_text_constraint',
            message: 'Must be no more than 100 character(s).',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('name: Too long.')
  })

  it('uses friendly message for validation_invalid_format', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          email: {
            code: 'validation_invalid_format',
            message: 'Invalid value format.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('email: Invalid format.')
  })

  it('falls back to raw message for unknown codes', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          url: {
            code: 'validation_some_future_code',
            message: 'Some future message.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('url: Some future message.')
  })

  it('falls back to raw message when code is absent', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          url: { message: 'Must be a valid url' },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('url: Must be a valid url')
  })

  it('falls back to raw message for array-style errors without code', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          email: ['Value must be unique.'],
        },
      },
    })
    expect(getErrorMessage(err)).toBe('email: Value must be unique.')
  })

  it('uses context override when provided', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          name: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe('name: This name is already taken.')
    expect(getErrorMessage(err, 'auth')).toBe(
      'name: That display name is already taken. Try another?'
    )
  })

  it('falls back to default when context has no override for a field', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          email: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
        },
      },
    })
    expect(getErrorMessage(err, 'auth')).toBe(
      'email: An account with this email already exists.'
    )
  })

  it('extracts multiple field errors with friendly messages', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          email: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
          password: {
            code: 'validation_required',
            message: 'Cannot be blank.',
          },
        },
      },
    })
    expect(getErrorMessage(err)).toBe(
      'email: An account with this email already exists.; password: This field is required.'
    )
  })

  it('extracts array-style field errors without codes', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        data: {
          url: { message: 'Must be a valid url' },
          name: ['Cannot be empty'],
        },
      },
    })
    expect(getErrorMessage(err)).toBe(
      'url: Must be a valid url; name: Cannot be empty'
    )
  })

  it('falls back to response.message when no field errors', () => {
    const err = new Error('Failed request')
    Object.assign(err, {
      response: {
        message: 'Unauthorized',
      },
    })
    expect(getErrorMessage(err)).toBe('Unauthorized')
  })

  it('falls back to err.message when response has no useful data', () => {
    const err = new Error('Something went wrong')
    Object.assign(err, { response: {} })
    expect(getErrorMessage(err)).toBe('Something went wrong')
  })
})
