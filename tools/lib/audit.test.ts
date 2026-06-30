import { describe, expect, it } from 'bun:test'
import {
  auditEnrichedData,
  filterAuditResult,
  problemFieldCounts,
} from './audit'
import { mergeEnrichedIntoSeeded } from './read-resorts'
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
  terrainDescription: 'Wide cruising runs above the treeline.',
  offPisteDescription: 'Steep north-facing couloirs.',
  valueDescription: 'One of the cheaper French resorts.',
  familyDescription: 'Nursery slopes at resort level.',
  apresSkiDescription: 'Cosy old-town bars.',
  resortCharacterDescription: 'Traditional alpine town.',
  liftSystemDescription: 'Modern and efficient lifts.',
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
    }
    const result = auditEnrichedData([seededResort], [lowQuality])
    expect(result.enrichedProblems).toEqual([
      {
        id: 'chamonix-alps-france',
        resortName: 'Chamonix',
        issues: [
          {
            type: 'low-quality',
            fields: ['nearestAirport'],
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

describe('filterAuditResult', () => {
  const baseResult = auditEnrichedData(
    [
      seededResort,
      { ...seededResort, id: 'other-alps-france', resortName: 'Other' },
    ],
    [
      { ...goodEnriched, nearestAirport: '', snowReliability: 'extreme' },
      { ...goodEnriched, id: 'other-alps-france', transferTime: -5 },
    ]
  )

  it('returns unfiltered result when no fields specified', () => {
    expect(filterAuditResult(baseResult, [])).toEqual(baseResult)
  })

  it('filters by a single field', () => {
    const filtered = filterAuditResult(baseResult, ['nearestAirport'])
    expect(filtered.enrichedProblems).toHaveLength(1)
    expect(filtered.enrichedProblems[0].id).toBe('chamonix-alps-france')
  })

  it('filters by conjunction of multiple fields', () => {
    const filtered = filterAuditResult(baseResult, [
      'nearestAirport',
      'snowReliability',
    ])
    expect(filtered.enrichedProblems).toHaveLength(1)
    expect(filtered.enrichedProblems[0].id).toBe('chamonix-alps-france')
  })

  it('excludes resorts that do not match all filter fields', () => {
    const filtered = filterAuditResult(baseResult, [
      'nearestAirport',
      'transferTime',
    ])
    expect(filtered.enrichedProblems).toHaveLength(0)
  })

  it('matches field from type-specific issue', () => {
    const filtered = filterAuditResult(baseResult, ['snowReliability'])
    expect(filtered.enrichedProblems).toHaveLength(1)
    expect(filtered.enrichedProblems[0].id).toBe('chamonix-alps-france')
  })

  it('matches field from negative-transfer-time issue', () => {
    const filtered = filterAuditResult(baseResult, ['transferTime'])
    expect(filtered.enrichedProblems).toHaveLength(1)
    expect(filtered.enrichedProblems[0].id).toBe('other-alps-france')
  })

  it('preserves non-filtered fields in the result', () => {
    const filtered = filterAuditResult(baseResult, ['nearestAirport'])
    expect(filtered.seededCount).toBe(baseResult.seededCount)
    expect(filtered.enrichedCount).toBe(baseResult.enrichedCount)
    expect(filtered.orphans).toEqual(baseResult.orphans)
    expect(filtered.duplicateSeededIds).toEqual(baseResult.duplicateSeededIds)
    expect(filtered.duplicateEnrichedIds).toEqual(
      baseResult.duplicateEnrichedIds
    )
  })
})

describe('problemFieldCounts', () => {
  it('returns all fields with zero counts for clean data', () => {
    const result = auditEnrichedData([seededResort], [goodEnriched])
    const counts = problemFieldCounts(result)
    expect(counts).toHaveLength(12)
    for (const { count } of counts) {
      expect(count).toBe(0)
    }
  })

  it('counts resorts per problem field', () => {
    const lowQuality: EnrichedResort = {
      ...goodEnriched,
      nearestAirport: '',
      snowReliability: 'extreme',
    }
    const result = auditEnrichedData([seededResort], [lowQuality])
    const counts = problemFieldCounts(result)
    const byField = new Map(counts.map((c) => [c.field, c.count]))
    expect(byField.get('nearestAirport')).toBe(1)
    expect(byField.get('snowReliability')).toBe(1)
    expect(byField.get('terrainDescription')).toBe(0)
  })

  it('counts each resort only once per field even with multiple issues on that field', () => {
    const bad: EnrichedResort = {
      ...goodEnriched,
      snowReliability: '',
    }
    const result = auditEnrichedData([seededResort], [bad])
    const counts = problemFieldCounts(result)
    const byField = new Map(counts.map((c) => [c.field, c.count]))
    expect(byField.get('snowReliability')).toBe(1)
  })

  it('sorts by count descending then field name', () => {
    const resort1: SeededResort = { ...seededResort, id: 'resort-1' }
    const resort2: SeededResort = { ...seededResort, id: 'resort-2' }
    const enriched1: EnrichedResort = {
      ...goodEnriched,
      id: 'resort-1',
      nearestAirport: '',
    }
    const enriched2: EnrichedResort = {
      ...goodEnriched,
      id: 'resort-2',
      nearestAirport: '',
      terrainDescription: '',
    }
    const result = auditEnrichedData([resort1, resort2], [enriched1, enriched2])
    const counts = problemFieldCounts(result)
    const fields = counts.map((c) => c.field)
    const nearestIdx = fields.indexOf('nearestAirport')
    const terrainIdx = fields.indexOf('terrainDescription')
    expect(nearestIdx).toBeLessThan(terrainIdx)
  })
})

describe('mergeEnrichedIntoSeeded', () => {
  it('overrides seeded numeric fields with enriched corrections', () => {
    const enriched: EnrichedResort = {
      ...goodEnriched,
      summitAltitude: 3900,
      pisteKm: 160,
    }
    const merged = mergeEnrichedIntoSeeded(seededResort, enriched)
    expect(merged.summitAltitude).toBe(3900)
    expect(merged.pisteKm).toBe(160)
    expect(merged.baseAltitude).toBe(1035)
  })

  it('does not override when enriched field is null', () => {
    const enriched: EnrichedResort = {
      ...goodEnriched,
      summitAltitude: null,
    }
    const merged = mergeEnrichedIntoSeeded(seededResort, enriched)
    expect(merged.summitAltitude).toBe(3842)
  })

  it('does not override when enriched field is undefined', () => {
    const { summitAltitude: _, ...enrichedNoAlt } = {
      ...goodEnriched,
    }
    const merged = mergeEnrichedIntoSeeded(
      seededResort,
      enrichedNoAlt as EnrichedResort
    )
    expect(merged.summitAltitude).toBe(3842)
  })
})
