import {
  cosineSimilarity,
  lexicalBoost,
  relevanceScore,
} from './resortSearchPure'

export type ScoredResort = ResortWithEmbedding & { score?: number }

import type { ResortWithEmbedding } from '../shared/types.d'

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

const initPromise =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    ? (async () => {
        modelFailed = true
        notifyReady()
      })()
    : (async () => {
        try {
          const { pipeline } = await import('@huggingface/transformers')
          const extractor = await pipeline('feature-extraction', MODEL_ID, {
            dtype: 'uint8',
          })
          embedder = async (text: string): Promise<number[]> => {
            const output = await extractor(text, {
              pooling: 'mean',
              normalize: true,
            })
            return Array.from(output.data as Float32Array)
          }
          modelReady = true
        } catch (err) {
          console.error('Failed to load search model:', err)
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

export function getIsModelFailed(): boolean {
  return modelFailed
}

export function onModelReady(callback: () => void): void {
  if (modelReady || modelFailed) {
    callback()
  } else {
    readyListeners.push(callback)
  }
}

export { cosineSimilarity, lexicalBoost, relevanceScore }

export async function searchResorts(
  query: string,
  resorts: ResortWithEmbedding[]
): Promise<ScoredResort[]> {
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
      const score = relevanceScore(cosine, boost)
      return { ...resort, score }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
