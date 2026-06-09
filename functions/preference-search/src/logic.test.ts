import { describe, expect, it } from 'bun:test'
import {
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
  type Participant,
  type Preferences,
} from './logic'

function makeParticipant(overrides: Record<string, unknown> = {}): Participant {
  return {
    $id: 'part-1',
    participantUserId: 'user-1',
    participantUserName: 'Bob',
    tripId: 'trip-1',
    role: 'participant',
    ...overrides,
  } as Participant
}

function makePreferences(overrides: Record<string, unknown> = {}): Preferences {
  return {
    $id: 'pref-1',
    userId: 'user-1',
    skiSnowboard: ['Ski'],
    difficulty: ['Red', 'Black'],
    piste: ['On-Piste', 'Off-Piste'],
    timeSlopes: 60,
    timeEating: 15,
    timeApres: 15,
    timeHotel: 10,
    accommodation: ['4-star hotel'],
    notes: '',
    ...overrides,
  } as Preferences
}

describe('computeInputHash', () => {
  it('produces the same hash for identical inputs', () => {
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const hash1 = computeInputHash(participantPrefs)
    const hash2 = computeInputHash(participantPrefs)

    expect(hash1).toBe(hash2)
  })

  it('produces different hashes when preferences change', () => {
    const participantPrefs1 = [
      {
        participant: makeParticipant(),
        preferences: makePreferences({ difficulty: ['Red'] }),
      },
    ]
    const participantPrefs2 = [
      {
        participant: makeParticipant(),
        preferences: makePreferences({ difficulty: ['Blue'] }),
      },
    ]

    const hash1 = computeInputHash(participantPrefs1)
    const hash2 = computeInputHash(participantPrefs2)

    expect(hash1).not.toBe(hash2)
  })

  it('is deterministic regardless of key insertion order', () => {
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const hash = computeInputHash(participantPrefs)
    const sameHash = computeInputHash(participantPrefs)

    expect(hash).toBe(sameHash)
  })

  it('returns a hex string of expected length', () => {
    const participantPrefs: Array<{
      participant: Participant
      preferences: Preferences
    }> = []

    const hash = computeInputHash(participantPrefs)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('does not change hash when only participant name changes', () => {
    const participantPrefs1 = [
      {
        participant: makeParticipant({ participantUserName: 'Bob' }),
        preferences: makePreferences(),
      },
    ]
    const participantPrefs2 = [
      {
        participant: makeParticipant({ participantUserName: 'Alice' }),
        preferences: makePreferences(),
      },
    ]

    const hash1 = computeInputHash(participantPrefs1)
    const hash2 = computeInputHash(participantPrefs2)

    expect(hash1).toBe(hash2)
  })
})

describe('buildSystemPrompt', () => {
  it('includes key instructions', () => {
    const prompt = buildSystemPrompt()

    expect(prompt).toContain('natural-language search query')
    expect(prompt).toContain('Do NOT mention participant names')
    expect(prompt).toContain('difficulty levels')
    expect(prompt).toContain('piste types')
    expect(prompt).toContain('accommodation')
    expect(prompt).toContain('ONLY the search query paragraph')
  })
})

describe('buildUserPrompt', () => {
  it('includes participant preferences without names', () => {
    const participantPrefs = [
      {
        participant: makeParticipant(),
        preferences: makePreferences(),
      },
    ]

    const prompt = buildUserPrompt(participantPrefs)

    expect(prompt).not.toContain('Bob')
    expect(prompt).toContain('Ski')
    expect(prompt).toContain('Red, Black')
    expect(prompt).toContain('4-star hotel')
  })

  it('includes group size', () => {
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const prompt = buildUserPrompt(participantPrefs)

    expect(prompt).toContain('Group size: 1 skier(s)/snowboarder(s)')
  })

  it('includes time allocation', () => {
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const prompt = buildUserPrompt(participantPrefs)

    expect(prompt).toContain('slopes 60%')
    expect(prompt).toContain('eating 15%')
    expect(prompt).toContain('après-ski 15%')
    expect(prompt).toContain('hotel 10%')
  })

  it('omits empty notes', () => {
    const participantPrefs = [
      {
        participant: makeParticipant(),
        preferences: makePreferences({ notes: '' }),
      },
    ]

    const prompt = buildUserPrompt(participantPrefs)

    expect(prompt).not.toContain('- Notes:')
  })

  it('includes non-empty notes', () => {
    const participantPrefs = [
      {
        participant: makeParticipant(),
        preferences: makePreferences({ notes: 'Loves moguls' }),
      },
    ]

    const prompt = buildUserPrompt(participantPrefs)

    expect(prompt).toContain('Loves moguls')
  })

  it('includes multiple participants without names', () => {
    const participantPrefs = [
      {
        participant: makeParticipant({
          participantUserId: 'user-1',
          participantUserName: 'Alice',
        }),
        preferences: makePreferences({ userId: 'user-1' }),
      },
      {
        participant: makeParticipant({
          participantUserId: 'user-2',
          participantUserName: 'Bob',
        }),
        preferences: makePreferences({
          userId: 'user-2',
          skiSnowboard: ['Snowboard'],
          difficulty: ['Blue'],
        }),
      },
    ]

    const prompt = buildUserPrompt(participantPrefs)

    expect(prompt).not.toContain('Alice')
    expect(prompt).not.toContain('Bob')
    expect(prompt).toContain('Snowboard')
    expect(prompt).toContain('Group size: 2 skier(s)/snowboarder(s)')
  })
})
