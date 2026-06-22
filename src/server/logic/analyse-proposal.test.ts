import { describe, expect, it } from 'bun:test'
import {
  type Accommodation,
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
  type Participant,
  type Preferences,
  type Proposal,
} from './analyse-proposal'

const proposal: Proposal = {
  id: 'p1',
  updated: '2025-01-01T00:00:00Z',
  proposer: 'user1',
  proposerUserName: 'Alice',
  trip: 'trip1',
  state: 'SUBMITTED',
  description: 'A great ski trip',
  resortName: 'Chamonix',
  country: 'France',
  region: 'Auvergne-Rhone-Alpes',
  startDate: '2025-02-01',
  endDate: '2025-02-08',
  nearestAirport: 'GVA',
  transferTime: 60,
  summitAltitude: 4800,
  baseAltitude: 1000,
  pisteKm: 150,
  beginnerPct: 20,
  intermediatePct: 50,
  advancedPct: 30,
  liftCount: 50,
  snowReliability: 'high',
  skiSeasonMonths: 'Dec-Apr',
  websites: [],
  linkedResortsDescription: '',
}

const accommodation: Accommodation = {
  id: 'a1',
  proposal: 'p1',
  name: 'Chalet Alice',
  url: 'https://example.com',
  cost: '500',
  description: 'Cozy chalet',
}

const participant: Participant = {
  id: 'part1',
  user: 'user2',
  userName: 'Bob',
  trip: 'trip1',
  role: 'participant',
}

const preferences: Preferences = {
  id: 'pref1',
  user: 'user2',
  skiSnowboard: ['Ski'],
  difficulty: ['Red', 'Black'],
  piste: ['On-Piste', 'Off-Piste'],
  timeSlopes: 60,
  timeEating: 20,
  timeApres: 15,
  timeHotel: 5,
  accommodation: ['Chalet'],
  notes: 'Loves steep runs',
}

describe('analyse-proposal logic', () => {
  it('computeInputHash produces a consistent hash', () => {
    const hash1 = computeInputHash(
      proposal,
      [accommodation],
      [{ participant, preferences }]
    )
    const hash2 = computeInputHash(
      proposal,
      [accommodation],
      [{ participant, preferences }]
    )
    expect(hash1).toBe(hash2)
  })

  it('computeInputHash changes when inputs change', () => {
    const hash1 = computeInputHash(
      proposal,
      [accommodation],
      [{ participant, preferences }]
    )
    const hash2 = computeInputHash(proposal, [], [{ participant, preferences }])
    expect(hash1).not.toBe(hash2)
  })

  it('buildSystemPrompt returns a string', () => {
    const prompt = buildSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).toContain('Think concisely')
    expect(prompt).toContain('Do not second-guess')
    expect(prompt).toContain('stop thinking and write')
  })

  it('buildUserPrompt includes proposal data', () => {
    const prompt = buildUserPrompt(
      proposal,
      [accommodation],
      [{ participant, preferences }]
    )
    expect(prompt).toContain('Chamonix')
    expect(prompt).toContain('Bob')
    expect(prompt).toContain('Chalet Alice')
    expect(prompt).toContain('Think briefly, then write your analysis.')
  })
})
