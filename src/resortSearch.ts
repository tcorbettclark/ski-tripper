import type { ResortWithEmbedding } from './types.d'

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
    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        dtype: 'fp32',
      }
    )
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

export async function searchResorts(
  query: string,
  resorts: ResortWithEmbedding[]
): Promise<ResortWithEmbedding[]> {
  if (!query.trim()) {
    return resorts
  }

  if (!embedder) {
    return resorts
  }

  const embedding = await embedder(query.trim())
  const results = resorts
    .map((resort) => ({
      resort,
      similarity: cosineSimilarity(embedding, resort.embedding),
    }))
    .filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .map((r) => r.resort)
  return results
}
