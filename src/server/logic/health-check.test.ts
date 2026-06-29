import { describe, expect, it } from 'bun:test'
import {
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
} from './health-check'

describe('health-check logic', () => {
  it('computeInputHash produces a consistent hash', () => {
    const hash1 = computeInputHash('test-model')
    const hash2 = computeInputHash('test-model')
    expect(hash1).toBe(hash2)
  })

  it('computeInputHash changes when model changes', () => {
    const hash1 = computeInputHash('model-a')
    const hash2 = computeInputHash('model-b')
    expect(hash1).not.toBe(hash2)
  })

  it('buildSystemPrompt returns a string', () => {
    const prompt = buildSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('helpful assistant')
  })

  it('buildUserPrompt returns a short prompt', () => {
    const prompt = buildUserPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('hello')
  })
})
