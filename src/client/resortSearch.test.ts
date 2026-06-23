import { describe, expect, it } from 'bun:test'
import leven from 'leven'
import type { ResortWithEmbedding } from '../shared/types.d'
import {
  BRONZE_RATIO,
  cosineSimilarity,
  GOLD_RATIO,
  lexicalBoost,
  MEDAL_FLOOR,
  RATIO_CLOSE,
  RATIO_FUZZY,
  relevanceScore,
  SILVER_RATIO,
  TIER_CLOSE,
  TIER_EXACT,
  TIER_FUZZY,
  trophyGrade,
} from './resortSearchPure'

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
    transferTime: overrides.transferTime ?? null,
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

describe('trophyGrade', () => {
  it('returns gold when score within 2% of max', () => {
    expect(trophyGrade(0.81, 0.82)).toBe('gold')
  })

  it('returns silver when score within 5% of max but not gold', () => {
    expect(trophyGrade(0.79, 0.82)).toBe('silver')
  })

  it('returns bronze when score within 10% of max but not silver', () => {
    expect(trophyGrade(0.75, 0.82)).toBe('bronze')
  })

  it('returns null when score well below max', () => {
    expect(trophyGrade(0.6, 0.82)).toBeNull()
  })

  it('returns gold for exact max score', () => {
    expect(trophyGrade(0.82, 0.82)).toBe('gold')
  })

  it('returns null when maxScore is below floor', () => {
    expect(trophyGrade(0.58, 0.58)).toBeNull()
  })

  it('returns null when score is below floor even if ratio is high', () => {
    expect(trophyGrade(0.59, 0.6)).toBeNull()
  })

  it('awards gold at exactly gold ratio boundary', () => {
    const score = 0.82 * GOLD_RATIO
    expect(trophyGrade(score, 0.82)).toBe('gold')
  })

  it('awards silver at exactly silver ratio boundary', () => {
    const score = 0.82 * SILVER_RATIO
    expect(trophyGrade(score, 0.82)).toBe('silver')
  })

  it('awards bronze at exactly bronze ratio boundary', () => {
    const score = 0.82 * BRONZE_RATIO
    expect(trophyGrade(score, 0.82)).toBe('bronze')
  })

  it('works with short-query scenario', () => {
    expect(trophyGrade(0.7, 0.7)).toBe('gold')
    expect(trophyGrade(0.67, 0.7)).toBe('silver')
    expect(trophyGrade(0.63, 0.7)).toBe('bronze')
    expect(trophyGrade(0.5, 0.7)).toBeNull()
  })

  it('works with detailed-query scenario', () => {
    expect(trophyGrade(0.82, 0.82)).toBe('gold')
    expect(trophyGrade(0.79, 0.82)).toBe('silver')
    expect(trophyGrade(0.75, 0.82)).toBe('bronze')
    expect(trophyGrade(0.6, 0.82)).toBeNull()
  })

  it('gives no medals for unrelated query with low max', () => {
    expect(trophyGrade(0.45, 0.5)).toBeNull()
    expect(trophyGrade(0.5, 0.5)).toBeNull()
  })

  it('floor prevents medals when max score is poor', () => {
    expect(trophyGrade(MEDAL_FLOOR - 0.01, MEDAL_FLOOR - 0.01)).toBeNull()
  })
})

describe('threshold constants', () => {
  it('GOLD_RATIO is 0.98', () => {
    expect(GOLD_RATIO).toBe(0.98)
  })

  it('SILVER_RATIO is 0.95', () => {
    expect(SILVER_RATIO).toBe(0.95)
  })

  it('BRONZE_RATIO is 0.90', () => {
    expect(BRONZE_RATIO).toBe(0.9)
  })

  it('MEDAL_FLOOR is 0.60', () => {
    expect(MEDAL_FLOOR).toBe(0.6)
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
