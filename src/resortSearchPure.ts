import leven from 'leven'
import type { ResortWithEmbedding } from './types.d'

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

export const SIMILARITY_THRESHOLD = 0.3

export const TIER_EXACT = 0.5
export const TIER_CLOSE = 0.3
export const TIER_FUZZY = 0.2

export const RATIO_CLOSE = 0.85
export const RATIO_FUZZY = 0.5

export function lexicalBoost(
  query: string,
  resort: ResortWithEmbedding
): number {
  if (!query) return 0
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0

  const nameWords = tokenize(resort.resortName)
  const countryWords = tokenize(resort.country)
  const regionWords = tokenize(resort.region)

  let totalBoost = 0
  for (const word of words) {
    totalBoost +=
      bestWordBoost(word, nameWords) +
      bestWordBoost(word, countryWords) +
      bestWordBoost(word, regionWords)
  }

  return totalBoost / words.length
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-/()]+/)
    .filter(Boolean)
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - leven(a, b) / maxLen
}

function bestWordBoost(queryWord: string, fieldWords: string[]): number {
  let best = 0
  for (const fieldWord of fieldWords) {
    const ratio = similarity(queryWord, fieldWord)
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

export function scoreResort(cosine: number, boost: number): number {
  return cosine + boost
}
