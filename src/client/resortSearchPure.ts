import leven from 'leven'
import type { ResortWithEmbedding } from '../shared/types.d'

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0
  return dot / denominator
}

export const TIER_EXACT = 0.15
export const TIER_CLOSE = 0.1
export const TIER_FUZZY = 0.05

export const RATIO_CLOSE = 0.85
export const RATIO_FUZZY = 0.5

export const TROPHY_GOLD_THRESHOLD = 0.8
export const TROPHY_SILVER_THRESHOLD = 0.65
export const TROPHY_BRONZE_THRESHOLD = 0.5

export function lexicalBoost(
  query: string,
  resort: ResortWithEmbedding
): number {
  if (!query) return 0
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (queryWords.length === 0) return 0

  const fields = [
    resort.resortName.toLowerCase(),
    resort.country.toLowerCase(),
    resort.region.toLowerCase(),
  ].filter(Boolean)

  if (fields.length === 0) return 0

  let totalBoost = 0
  for (const field of fields) {
    totalBoost += bestFieldBoost(field, queryWords)
  }

  return totalBoost
}

function bestFieldBoost(field: string, queryWords: string[]): number {
  const phraseBoost = bestQueryWordBoost(field, queryWords)
  const fieldWords = tokenize(field)
  let bestWordBoost = 0
  for (const fieldWord of fieldWords) {
    if (fieldWord.length < 3) continue
    const boost = bestQueryWordBoost(fieldWord, queryWords)
    if (boost > bestWordBoost) bestWordBoost = boost
  }
  return Math.max(phraseBoost, bestWordBoost)
}

function bestQueryWordBoost(target: string, queryWords: string[]): number {
  let best = 0
  for (const word of queryWords) {
    const ratio = similarity(word, target)
    let tier = 0
    if (ratio === 1) {
      tier = TIER_EXACT
    } else if (ratio >= RATIO_CLOSE) {
      tier = TIER_CLOSE
    } else if (ratio >= RATIO_FUZZY) {
      tier = TIER_FUZZY
    }
    if (tier > best) best = tier
  }
  return best
}

function tokenize(text: string): string[] {
  return text.split(/[\s\-/()]+/).filter(Boolean)
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - leven(a, b) / maxLen
}

export function scoreResort(cosine: number, boost: number): number {
  return cosine + boost
}

export function relevanceScore(cosine: number, boost: number): number {
  const cappedBoost = Math.min(boost, 0.3)
  const raw = cosine + cappedBoost
  return Math.min(raw, 1)
}
