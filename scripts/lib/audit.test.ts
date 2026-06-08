import { describe, expect, it } from 'bun:test'
import { auditEnrichedData } from './audit'
import type { EnrichedResort, SeededResort } from './types'

const seededResort: SeededResort = {
  id: 'chamonix-alps-france',
  resortName: 'Chamonix',
  country: 'France',
  region: 'Alps',
  latitude: '45.9237',
  longitude: '6.8694',
  summitAltitude: 3842,
  baseAltitude: 1035,
  pisteKm: 153,
  liftCount: 37,
  websites: ['https://www.chamonix.com/'],
  beginnerPct: 15,
  intermediatePct: 40,
  advancedPct: 45,
}

const goodEnriched: EnrichedResort = {
  id: 'chamonix-alps-france',
  description: 'A world-class resort...',
  nearestAirport: 'Geneva Airport',
  transferTime: 90,
  snowReliability: 'high',
  skiSeasonMonths: 'Dec-Apr',
  websites: ['https://www.chamonix.com/'],
  linkedResortsDescription: 'Part of the Mont Blanc ski area.',
}

describe('auditEnrichedData', () => {
  it('reports no issues for clean data', () => {
    const result = auditEnrichedData([seededResort], [goodEnriched])
    expect(result.seededCount).toBe(1)
    expect(result.enrichedCount).toBe(1)
    expect(result.coveragePct).toBe('100.0')
    expect(result.orphans).toEqual([])
    expect(result.duplicateSeededIds).toEqual([])
    expect(result.duplicateEnrichedIds).toEqual([])
    expect(result.enrichedProblems).toEqual([])
  })

  it('reports orphaned enriched entries', () => {
    const orphan: EnrichedResort = { ...goodEnriched, id: 'no-seed-match' }
    const result = auditEnrichedData([seededResort], [goodEnriched, orphan])
    expect(result.orphans).toEqual([{ id: 'no-seed-match' }])
  })

  it('reports duplicate seeded IDs', () => {
    const dupe = { ...seededResort }
    const result = auditEnrichedData([seededResort, dupe], [goodEnriched])
    expect(result.duplicateSeededIds).toEqual(['chamonix-alps-france'])
  })

  it('reports duplicate enriched IDs', () => {
    const dupe = { ...goodEnriched }
    const result = auditEnrichedData([seededResort], [goodEnriched, dupe])
    expect(result.duplicateEnrichedIds).toEqual(['chamonix-alps-france'])
  })

  it('reports low-quality fields', () => {
    const lowQuality: EnrichedResort = {
      ...goodEnriched,
      nearestAirport: '',
      linkedResortsDescription: '',
    }
    const result = auditEnrichedData([seededResort], [lowQuality])
    expect(result.enrichedProblems).toEqual([
      {
        id: 'chamonix-alps-france',
        resortName: 'Chamonix',
        issues: [
          {
            type: 'low-quality',
            fields: ['nearestAirport', 'linkedResortsDescription'],
          },
        ],
      },
    ])
  })

  it('reports invalid snowReliability', () => {
    const invalid: EnrichedResort = {
      ...goodEnriched,
      snowReliability: 'extreme',
    }
    const result = auditEnrichedData([seededResort], [invalid])
    expect(result.enrichedProblems).toEqual([
      {
        id: 'chamonix-alps-france',
        resortName: 'Chamonix',
        issues: [{ type: 'invalid-snow-reliability', value: 'extreme' }],
      },
    ])
  })

  it('reports negative transferTime', () => {
    const invalid: EnrichedResort = {
      ...goodEnriched,
      transferTime: -30,
    }
    const result = auditEnrichedData([seededResort], [invalid])
    expect(result.enrichedProblems).toEqual([
      {
        id: 'chamonix-alps-france',
        resortName: 'Chamonix',
        issues: [{ type: 'negative-transfer-time', value: -30 }],
      },
    ])
  })

  it('reports multiple issues on the same resort', () => {
    const bad: EnrichedResort = {
      ...goodEnriched,
      transferTime: -10,
      snowReliability: 'unknown',
    }
    const result = auditEnrichedData([seededResort], [bad])
    expect(result.enrichedProblems).toEqual([
      {
        id: 'chamonix-alps-france',
        resortName: 'Chamonix',
        issues: [
          { type: 'invalid-snow-reliability', value: 'unknown' },
          { type: 'negative-transfer-time', value: -10 },
        ],
      },
    ])
  })

  it('handles empty inputs', () => {
    const result = auditEnrichedData([], [])
    expect(result.seededCount).toBe(0)
    expect(result.enrichedCount).toBe(0)
    expect(result.coveragePct).toBe('0.0')
    expect(result.orphans).toEqual([])
    expect(result.enrichedProblems).toEqual([])
  })

  it('calculates coverage percentage correctly', () => {
    const result = auditEnrichedData(
      [seededResort, { ...seededResort, id: 'other-alps-france' }],
      [goodEnriched]
    )
    expect(result.enrichedCount).toBe(1)
    expect(result.seededCount).toBe(2)
    expect(result.coveragePct).toBe('50.0')
  })

  it('falls back to id for resortName when enriched entry has no seeded match', () => {
    const orphan: EnrichedResort = {
      ...goodEnriched,
      id: 'no-seed-match',
      nearestAirport: '',
    }
    const result = auditEnrichedData([], [orphan])
    expect(result.enrichedProblems).toEqual([
      {
        id: 'no-seed-match',
        resortName: 'no-seed-match',
        issues: [{ type: 'low-quality', fields: ['nearestAirport'] }],
      },
    ])
  })
})
