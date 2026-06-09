import { describe, expect, it } from 'bun:test'
import {
  type Accommodation,
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
  type Participant,
  type Preferences,
  type Proposal,
} from './logic'

function makeProposal(overrides: Record<string, unknown> = {}): Proposal {
  return {
    $id: 'proposal-1',
    $updatedAt: '2025-01-01T00:00:00.000Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Alice',
    tripId: 'trip-1',
    state: 'SUBMITTED',
    description: 'Great ski trip to Chamonix!',
    resortName: 'Chamonix',
    startDate: '2025-02-01',
    endDate: '2025-02-08',
    nearestAirport: 'Geneva Airport',
    transferTime: 90,
    country: 'France',
    region: 'Alps',
    summitAltitude: 3842,
    baseAltitude: 1035,
    pisteKm: 153,
    beginnerPct: 15,
    intermediatePct: 40,
    advancedPct: 45,
    liftCount: 37,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://www.chamonix.com/'],
    linkedResortsDescription: 'Part of the Mont Blanc ski area',
    ...overrides,
  } as Proposal
}

function makeAccommodation(
  overrides: Record<string, unknown> = {}
): Accommodation {
  return {
    $id: 'acc-1',
    proposalId: 'proposal-1',
    name: 'Chalet Mont Blanc',
    url: 'https://example.com/chalet',
    cost: '€150/night',
    description: 'Cozy chalet near the slopes',
    ...overrides,
  } as Accommodation
}

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
    const proposal = makeProposal()
    const accommodations = [makeAccommodation()]
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const hash1 = computeInputHash(proposal, accommodations, participantPrefs)
    const hash2 = computeInputHash(proposal, accommodations, participantPrefs)

    expect(hash1).toBe(hash2)
  })

  it('produces different hashes when proposal data changes', () => {
    const accommodations = [makeAccommodation()]
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const hash1 = computeInputHash(
      makeProposal(),
      accommodations,
      participantPrefs
    )
    const hash2 = computeInputHash(
      makeProposal({ resortName: 'Zermatt' }),
      accommodations,
      participantPrefs
    )

    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes when preferences change', () => {
    const proposal = makeProposal()
    const accommodations = [makeAccommodation()]
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

    const hash1 = computeInputHash(proposal, accommodations, participantPrefs1)
    const hash2 = computeInputHash(proposal, accommodations, participantPrefs2)

    expect(hash1).not.toBe(hash2)
  })

  it('is deterministic regardless of key insertion order', () => {
    const proposal = makeProposal()
    const accommodations = [makeAccommodation()]
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const hash = computeInputHash(proposal, accommodations, participantPrefs)

    const sameDataDifferentOrder = computeInputHash(
      proposal,
      accommodations,
      participantPrefs
    )

    expect(hash).toBe(sameDataDifferentOrder)
  })

  it('returns a hex string of expected length', () => {
    const proposal = makeProposal()
    const accommodations: Accommodation[] = []
    const participantPrefs: Array<{
      participant: Participant
      preferences: Preferences
    }> = []

    const hash = computeInputHash(proposal, accommodations, participantPrefs)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('buildSystemPrompt', () => {
  it('includes key sections', () => {
    const prompt = buildSystemPrompt()

    expect(prompt).toContain('### Summary')
    expect(prompt).toContain("### Who'd love this")
    expect(prompt).toContain('### Who might struggle')
    expect(prompt).toContain('skiSeasonMonths')
    expect(prompt).toContain('accommodation')
  })
})

describe('buildUserPrompt', () => {
  it('includes proposal details', () => {
    const proposal = makeProposal()
    const accommodations = [makeAccommodation()]
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).toContain('Chamonix')
    expect(prompt).toContain('France')
    expect(prompt).toContain('Geneva Airport')
    expect(prompt).toContain('Dec-Apr')
    expect(prompt).toContain('90 minutes')
  })

  it('includes accommodation details', () => {
    const proposal = makeProposal()
    const accommodations = [makeAccommodation()]
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).toContain('Chalet Mont Blanc')
    expect(prompt).toContain('€150/night')
  })

  it('includes participant preferences', () => {
    const proposal = makeProposal()
    const accommodations: Accommodation[] = []
    const participantPrefs = [
      {
        participant: makeParticipant({ participantUserName: 'Bob' }),
        preferences: makePreferences(),
      },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).toContain('Bob')
    expect(prompt).toContain('Ski')
    expect(prompt).toContain('Red, Black')
    expect(prompt).toContain('4-star hotel')
  })

  it('omits transfer time when null', () => {
    const proposal = makeProposal({ transferTime: null })
    const accommodations: Accommodation[] = []
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).not.toContain('Transfer time')
  })

  it('includes linked resorts description when present', () => {
    const proposal = makeProposal({
      linkedResortsDescription: 'Part of the 3 Vallées',
    })
    const accommodations: Accommodation[] = []
    const participantPrefs = [
      { participant: makeParticipant(), preferences: makePreferences() },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).toContain('Part of the 3 Vallées')
  })

  it('omits empty notes', () => {
    const proposal = makeProposal()
    const accommodations: Accommodation[] = []
    const participantPrefs = [
      {
        participant: makeParticipant(),
        preferences: makePreferences({ notes: '' }),
      },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).not.toContain('- Notes:')
  })

  it('includes non-empty notes', () => {
    const proposal = makeProposal()
    const accommodations: Accommodation[] = []
    const participantPrefs = [
      {
        participant: makeParticipant(),
        preferences: makePreferences({ notes: 'Loves moguls' }),
      },
    ]

    const prompt = buildUserPrompt(proposal, accommodations, participantPrefs)

    expect(prompt).toContain('Loves moguls')
  })
})
