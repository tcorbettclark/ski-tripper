import leven from 'leven'
import type { ResortWithEmbedding } from './types.d'

const MODEL_ID = 'Xenova/multi-qa-MiniLM-L6-cos-v1'

let modelReady = false
let modelFailed = false
let embedder: ((text: string) => Promise<number[]>) | null = null
const readyListeners: Array<() => void> = []

function notifyReady(): void {
  for (const listener of readyListeners) {
    listener()
  }
  readyListeners.length = 0
}

const initPromise = (async () => {
  try {
    const { pipeline } = await import('@huggingface/transformers')
    const extractor = await pipeline('feature-extraction', MODEL_ID, {
      dtype: 'fp32',
    })
    embedder = async (text: string): Promise<number[]> => {
      const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
      })
      return Array.from(output.data as Float32Array)
    }
    modelReady = true
  } catch {
    modelFailed = true
  }
  notifyReady()
})()

export function initSearchModel(): void {
  initPromise.catch(() => {})
}

export function getIsModelReady(): boolean {
  return modelReady
}

export function onModelReady(callback: () => void): void {
  if (modelReady || modelFailed) {
    callback()
  } else {
    readyListeners.push(callback)
  }
}

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

export async function searchResorts(
  query: string,
  resorts: ResortWithEmbedding[]
): Promise<ResortWithEmbedding[]> {
  if (!query.trim()) {
    return resorts
  }

  const trimmed = query.trim()

  if (!embedder) {
    const lexicalResults = resorts.filter((r) => lexicalBoost(trimmed, r) > 0)
    return lexicalResults.length > 0 ? lexicalResults : resorts
  }

  const embedding = await embedder(trimmed)
  return resorts
    .map((resort) => {
      const cosine = cosineSimilarity(embedding, resort.embedding)
      const boost = lexicalBoost(trimmed, resort)
      const score = scoreResort(cosine, boost)
      return { resort, score }
    })
    .filter((r) => r.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.resort)
}
