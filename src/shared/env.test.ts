import { beforeEach, describe, expect, it } from 'bun:test'
import { requireEnv } from './env'

describe('requireEnv', () => {
  beforeEach(() => {
    delete process.env.TEST_A
    delete process.env.TEST_B
  })

  it('returns values when all env vars are set', () => {
    process.env.TEST_A = 'hello'
    process.env.TEST_B = 'world'
    const env = requireEnv('TEST_A', 'TEST_B')
    expect(env.TEST_A).toBe('hello')
    expect(env.TEST_B).toBe('world')
  })

  it('throws listing multiple missing env vars', () => {
    expect(() => requireEnv('TEST_A', 'TEST_B')).toThrow(
      'Required env vars not set: TEST_A, TEST_B'
    )
  })

  it('throws with singular message for single missing var', () => {
    expect(() => requireEnv('TEST_A')).toThrow(
      'Required env var not set: TEST_A'
    )
  })

  it('returns a single var', () => {
    process.env.TEST_A = 'x'
    const env = requireEnv('TEST_A')
    expect(env.TEST_A).toBe('x')
  })
})
