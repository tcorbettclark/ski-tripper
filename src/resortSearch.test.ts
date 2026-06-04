import { describe, expect, it } from 'bun:test'
import leven from 'leven'
import {
  cosineSimilarity,
  lexicalBoost,
  RATIO_CLOSE,
  RATIO_FUZZY,
  SIMILARITY_THRESHOLD,
  scoreResort,
  TIER_CLOSE,
  TIER_EXACT,
  TIER_FUZZY,
} from './resortSearchPure'
import type { ResortWithEmbedding } from './types.d'

function makeResort(
  overrides: Partial<ResortWithEmbedding> & {
    resortName: string
    country: string
    region: string
  }
): ResortWithEmbedding {
  return {
    id: overrides.id ?? overrides.resortName.toLowerCase().replace(/\s+/g, '-'),
    resortName: overrides.resortName,
    country: overrides.country,
    region: overrides.region,
    description: overrides.description ?? '',
    latitude: overrides.latitude ?? '',
    longitude: overrides.longitude ?? '',
    summitAltitude: overrides.summitAltitude ?? 3000,
    baseAltitude: overrides.baseAltitude ?? 1500,
    nearestAirport: overrides.nearestAirport ?? '',
    transferTime: overrides.transferTime ?? '',
    pisteKm: overrides.pisteKm ?? 100,
    beginnerPct: overrides.beginnerPct ?? 30,
    intermediatePct: overrides.intermediatePct ?? 40,
    advancedPct: overrides.advancedPct ?? 30,
    liftCount: overrides.liftCount ?? 20,
    snowReliability: overrides.snowReliability ?? 'medium',
    skiSeasonMonths: overrides.skiSeasonMonths ?? 'Dec-Apr',
    websites: overrides.websites ?? [],
    linkedResortsDescription: overrides.linkedResortsDescription ?? '',
    embedding: overrides.embedding ?? [0.1, 0.2, 0.3],
  }
}

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const vec = [1, 2, 3]
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 2, 3]
    const b = [-1, -2, -3]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('returns correct similarity for known vectors', () => {
    const a = [1, 2, 3]
    const b = [4, 5, 6]
    const dot = 1 * 4 + 2 * 5 + 3 * 6
    const normA = Math.sqrt(1 + 4 + 9)
    const normB = Math.sqrt(16 + 25 + 36)
    const expected = dot / (normA * normB)
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5)
  })

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
  })
})

describe('SIMILARITY_THRESHOLD', () => {
  it('is 0.3', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.3)
  })
})

describe('lexicalBoost', () => {
  const chamonix = makeResort({
    resortName: 'Chamonix',
    country: 'France',
    region: 'Auvergne-Rhone-Alpes',
  })
  const zermatt = makeResort({
    resortName: 'Zermatt',
    country: 'Switzerland',
    region: 'Valais',
  })

  it('returns exact tier for exact word match on name', () => {
    expect(lexicalBoost('chamonix', chamonix)).toBe(TIER_EXACT)
    expect(lexicalBoost('CHAMONIX', chamonix)).toBe(TIER_EXACT)
  })

  it('returns close tier for minor typo (distance 1)', () => {
    expect(lexicalBoost('chamonx', chamonix)).toBe(TIER_CLOSE)
  })

  it('returns fuzzy tier for distance 2 typo', () => {
    expect(lexicalBoost('chamonc', chamonix)).toBe(TIER_FUZZY)
  })

  it('returns exact tier for exact country word match', () => {
    expect(lexicalBoost('France', chamonix)).toBe(TIER_EXACT)
  })

  it('returns close tier for close country word match', () => {
    expect(lexicalBoost('Switzerlnd', zermatt)).toBe(TIER_CLOSE)
  })

  it('returns exact tier for exact region word match', () => {
    expect(lexicalBoost('Valais', zermatt)).toBe(TIER_EXACT)
  })

  it('returns 0 for short unrelated words not close to any field word', () => {
    expect(lexicalBoost('a', chamonix)).toBe(0)
  })

  it('matches short plausible prefixes like Val against Valais', () => {
    expect(lexicalBoost('Val', zermatt)).toBe(TIER_FUZZY)
  })

  it('does not match short words like "in" against unrelated field words', () => {
    const resort = makeResort({
      resortName: 'Val Thorens',
      country: 'France',
      region: 'Auvergne-Rhone-Alpes',
    })
    expect(lexicalBoost('in', resort)).toBe(0)
  })

  it('stacks boosts across fields for single-word query', () => {
    const valaisResort = makeResort({
      resortName: 'Valais Ski Area',
      country: 'Switzerland',
      region: 'Valais',
    })
    expect(lexicalBoost('valais', valaisResort)).toBe(TIER_EXACT + TIER_EXACT)
  })

  it('averages boosts across multi-word query where all words match', () => {
    expect(lexicalBoost('Chamonix France', chamonix)).toBe(
      (TIER_EXACT + TIER_EXACT) / 2
    )
  })

  it('dilutes boost when some words do not match', () => {
    expect(lexicalBoost('ski France', chamonix)).toBe((0 + TIER_EXACT) / 2)
  })

  it('further dilutes boost when most words do not match', () => {
    expect(lexicalBoost('ski resort France', chamonix)).toBe(
      (0 + 0 + TIER_EXACT) / 3
    )
  })

  it('returns small boost for multi-word query with one fuzzy match', () => {
    expect(lexicalBoost('banff jasper', chamonix)).toBe(TIER_FUZZY / 2)
  })

  it('returns 0 for unrelated query', () => {
    expect(lexicalBoost('banff', chamonix)).toBe(0)
  })

  it('returns 0 for empty query', () => {
    expect(lexicalBoost('', chamonix)).toBe(0)
  })

  it('matches individual words in multi-word field names', () => {
    expect(lexicalBoost('Rhone', chamonix)).toBe(TIER_EXACT)
  })

  it('tokenizes hyphenated region names into separate words', () => {
    expect(lexicalBoost('Auvergne', chamonix)).toBe(TIER_EXACT)
  })
})

describe('leven', () => {
  it('computes edit distance correctly', () => {
    expect(leven('chamonix', 'chamonx')).toBe(1)
    expect(leven('chamonix', 'chamonc')).toBe(2)
    expect(leven('chamonix', 'chamonix')).toBe(0)
  })
})

describe('scoreResort', () => {
  it('adds boost to cosine', () => {
    expect(scoreResort(0.4, 0.35)).toBeCloseTo(0.75, 5)
  })

  it('returns raw cosine for zero boost', () => {
    expect(scoreResort(0.4, 0)).toBeCloseTo(0.4, 5)
  })

  it('allows lexical-only match with zero cosine to exceed threshold', () => {
    expect(scoreResort(0, TIER_EXACT)).toBeCloseTo(TIER_EXACT, 5)
    expect(scoreResort(0, TIER_EXACT) >= SIMILARITY_THRESHOLD).toBe(true)
  })

  it('combines low cosine with lexical boost to exceed threshold', () => {
    const lowCosine = 0.15
    expect(lowCosine < SIMILARITY_THRESHOLD).toBe(true)
    expect(scoreResort(lowCosine, TIER_FUZZY) >= SIMILARITY_THRESHOLD).toBe(
      true
    )
  })

  it('preserves ranking order: exact + high cosine > high cosine alone > fuzzy + low cosine', () => {
    const bothHigh = scoreResort(0.8, TIER_EXACT)
    const semanticOnly = scoreResort(0.8, 0)
    const bothLow = scoreResort(0.25, TIER_FUZZY)
    expect(bothHigh).toBeGreaterThan(semanticOnly)
    expect(semanticOnly).toBeGreaterThan(bothLow)
  })
})

describe('ratio thresholds', () => {
  it('RATIO_CLOSE is 0.85', () => {
    expect(RATIO_CLOSE).toBe(0.85)
  })

  it('RATIO_FUZZY is 0.5', () => {
    expect(RATIO_FUZZY).toBe(0.5)
  })
})
