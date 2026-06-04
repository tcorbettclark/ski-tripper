import { describe, expect, it } from 'bun:test'
import { log, logSummary } from './log'

describe('log', () => {
  it('does not throw for any log level', () => {
    const levels = ['info', 'success', 'warn', 'error'] as const
    for (const level of levels) {
      expect(() => log(level, 'tag', 'msg')).not.toThrow()
    }
  })

  it('does not throw with indent', () => {
    expect(() => log('info', 'tag', 'msg', 3)).not.toThrow()
  })
})

describe('logSummary', () => {
  it('does not throw', () => {
    expect(() => logSummary('Label', 'value')).not.toThrow()
  })

  it('does not throw with indent', () => {
    expect(() => logSummary('Label', 'value', 2)).not.toThrow()
  })
})
