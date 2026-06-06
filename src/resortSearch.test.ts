import { describe, expect, it } from 'bun:test'
import leven from 'leven'
import {
  cosineSimilarity,
  lexicalBoost,
  RATIO_CLOSE,
  RATIO_FUZZY,
  relevanceScore,
  TIER_CLOSE,
  TIER_EXACT,
  TIER_FUZZY,
  TROPHY_BRONZE_THRESHOLD,
  TROPHY_GOLD_THRESHOLD,
  TROPHY_SILVER_THRESHOLD,
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
    transferTime: overrides.transferTime ?? 0,
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

  it('returns exact tier for query word matching full resort name', () => {
    expect(lexicalBoost('chamonix', chamonix)).toBe(TIER_EXACT)
  })

  it('is case-insensitive for resort name match', () => {
    expect(lexicalBoost('CHAMONIX', chamonix)).toBe(TIER_EXACT)
  })

  it('returns close tier for minor typo matching full resort name', () => {
    expect(lexicalBoost('chamonx', chamonix)).toBe(TIER_CLOSE)
  })

  it('returns fuzzy tier for distance 2 typo matching full resort name', () => {
    expect(lexicalBoost('chamonc', chamonix)).toBe(TIER_FUZZY)
  })

  it('matches exact country phrase from query', () => {
    expect(lexicalBoost('france', chamonix)).toBe(TIER_EXACT)
  })

  it('matches close country phrase from query', () => {
    expect(lexicalBoost('switzerlnd', zermatt)).toBe(TIER_CLOSE)
  })

  it('matches exact region phrase from query', () => {
    expect(lexicalBoost('valais', zermatt)).toBe(TIER_EXACT)
  })

  it('returns 0 when no query word matches any field phrase', () => {
    expect(lexicalBoost('banff', chamonix)).toBe(0)
  })

  it('returns 0 for empty query', () => {
    expect(lexicalBoost('', chamonix)).toBe(0)
  })

  it('returns 0 for short unrelated query word not matching any field phrase', () => {
    expect(lexicalBoost('a', chamonix)).toBe(0)
  })

  it('short word like "la" does not strongly match long phrase "la plagne"', () => {
    const laPlagne = makeResort({
      resortName: 'La Plagne',
      country: 'France',
      region: 'Savoie',
    })
    const boost = lexicalBoost('la', laPlagne)
    expect(boost).toBeLessThan(TIER_CLOSE)
  })

  it('word from multi-word resort name matches exactly at word level', () => {
    const laPlagne = makeResort({
      resortName: 'La Plagne',
      country: 'France',
      region: 'Savoie',
    })
    expect(lexicalBoost('plagne', laPlagne)).toBe(TIER_EXACT)
  })

  it('stacks when query word matches multiple field phrases', () => {
    const valaisResort = makeResort({
      resortName: 'Valais',
      country: 'Switzerland',
      region: 'Valais',
    })
    expect(lexicalBoost('valais', valaisResort)).toBe(TIER_EXACT + TIER_EXACT)
  })

  it('stacks when multiple query words match different field phrases', () => {
    expect(lexicalBoost('Chamonix France', chamonix)).toBe(
      TIER_EXACT + TIER_EXACT
    )
  })

  it('does not match short query words like "in" against unrelated fields', () => {
    const resort = makeResort({
      resortName: 'Val Thorens',
      country: 'France',
      region: 'Auvergne-Rhone-Alpes',
    })
    expect(lexicalBoost('in', resort)).toBe(0)
  })

  it('matches partial word at fuzzy threshold against phrase via word-level', () => {
    expect(lexicalBoost('Val', zermatt)).toBe(TIER_FUZZY)
  })

  it('matches hyphenated region substring at word level', () => {
    expect(lexicalBoost('Rhone', chamonix)).toBe(TIER_EXACT)
  })

  it('matches hyphenated region prefix at word level', () => {
    expect(lexicalBoost('Auvergne', chamonix)).toBe(TIER_EXACT)
  })

  it('matches full region phrase exactly', () => {
    expect(lexicalBoost('Auvergne-Rhone-Alpes', chamonix)).toBe(TIER_EXACT)
  })
})

describe('leven', () => {
  it('computes edit distance correctly', () => {
    expect(leven('chamonix', 'chamonx')).toBe(1)
    expect(leven('chamonix', 'chamonc')).toBe(2)
    expect(leven('chamonix', 'chamonix')).toBe(0)
  })
})

describe('relevanceScore', () => {
  it('returns a value between 0 and 1', () => {
    const result = relevanceScore(0.8, 0.5)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(1)
  })

  it('returns raw cosine when no boost applies', () => {
    expect(relevanceScore(0.8, 0)).toBeCloseTo(0.8, 5)
  })

  it('gives meaningful score for lexical-only match with zero cosine', () => {
    expect(relevanceScore(0, TIER_EXACT)).toBeCloseTo(TIER_EXACT, 5)
  })

  it('combines cosine with lexical boost', () => {
    expect(relevanceScore(0.15, TIER_FUZZY)).toBeCloseTo(0.15 + TIER_FUZZY, 5)
  })

  it('caps boost at 0.3', () => {
    expect(relevanceScore(0.5, 1.0)).toBeCloseTo(0.8, 5)
  })

  it('caps at 1', () => {
    expect(relevanceScore(1, 1)).toBe(1)
  })

  it('preserves ranking order: exact + high cosine > high cosine alone > fuzzy + low cosine', () => {
    const bothHigh = relevanceScore(0.8, TIER_EXACT)
    const semanticOnly = relevanceScore(0.8, 0)
    const bothLow = relevanceScore(0.25, TIER_FUZZY)
    expect(bothHigh).toBeGreaterThan(semanticOnly)
    expect(semanticOnly).toBeGreaterThan(bothLow)
  })
})

describe('trophy thresholds', () => {
  it('TROPHY_GOLD_THRESHOLD is 0.8', () => {
    expect(TROPHY_GOLD_THRESHOLD).toBe(0.8)
  })

  it('TROPHY_SILVER_THRESHOLD is 0.65', () => {
    expect(TROPHY_SILVER_THRESHOLD).toBe(0.65)
  })

  it('TROPHY_BRONZE_THRESHOLD is 0.5', () => {
    expect(TROPHY_BRONZE_THRESHOLD).toBe(0.5)
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
