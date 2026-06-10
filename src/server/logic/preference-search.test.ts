import { describe, expect, it } from 'bun:test'
import {
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
  type Participant,
  type Preferences,
} from './preference-search'

const participant: Participant = {
  id: 'part1',
  user: 'user1',
  userName: 'Alice',
  trip: 'trip1',
  role: 'participant',
}

const preferences: Preferences = {
  id: 'pref1',
  user: 'user1',
  skiSnowboard: ['Ski'],
  difficulty: ['Red'],
  piste: ['On-Piste'],
  timeSlopes: 60,
  timeEating: 20,
  timeApres: 15,
  timeHotel: 5,
  accommodation: ['Hotel'],
  notes: '',
}

describe('preference-search logic', () => {
  it('computeInputHash produces a consistent hash', () => {
    const hash1 = computeInputHash([{ participant, preferences }])
    const hash2 = computeInputHash([{ participant, preferences }])
    expect(hash1).toBe(hash2)
  })

  it('computeInputHash changes when preferences change', () => {
    const differentPrefs: Preferences = {
      ...preferences,
      difficulty: ['Blue'],
    }
    const hash1 = computeInputHash([{ participant, preferences }])
    const hash2 = computeInputHash([
      { participant, preferences: differentPrefs },
    ])
    expect(hash1).not.toBe(hash2)
  })

  it('buildSystemPrompt returns a string without names', () => {
    const prompt = buildSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('Do NOT mention participant names')
  })

  it('buildUserPrompt includes preference data', () => {
    const prompt = buildUserPrompt([{ participant, preferences }])
    expect(prompt).toContain('Ski')
    expect(prompt).toContain('Red')
    expect(prompt).toContain('60%')
  })
})
