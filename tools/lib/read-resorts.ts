import * as fs from 'node:fs'
import * as path from 'node:path'

import { readJsonl } from './jsonl'
import type { EncodedResort, EnrichedResort, SeededResort } from './types'

const RESORTS_DIR = path.resolve(import.meta.dir, '../../data/resorts')

export const SEEDED_PATH = path.resolve(RESORTS_DIR, 'seeded.jsonl')
export const ENRICHED_PATH = path.resolve(RESORTS_DIR, 'enriched.jsonl')
export const ENCODED_PATH = path.resolve(RESORTS_DIR, 'encoded.jsonl')

function mergeEnrichedIntoSeeded(
  seeded: SeededResort,
  enriched: EnrichedResort
): SeededResort {
  return {
    ...seeded,
    ...(enriched.summitAltitude != null && {
      summitAltitude: enriched.summitAltitude,
    }),
    ...(enriched.baseAltitude != null && {
      baseAltitude: enriched.baseAltitude,
    }),
    ...(enriched.pisteKm != null && { pisteKm: enriched.pisteKm }),
    ...(enriched.liftCount != null && { liftCount: enriched.liftCount }),
    ...(enriched.beginnerPct != null && { beginnerPct: enriched.beginnerPct }),
    ...(enriched.intermediatePct != null && {
      intermediatePct: enriched.intermediatePct,
    }),
    ...(enriched.advancedPct != null && { advancedPct: enriched.advancedPct }),
  }
}

export function readSeeded(): SeededResort[] {
  if (!fs.existsSync(SEEDED_PATH)) return []
  return readJsonl<SeededResort>(SEEDED_PATH)
}

export function readEnriched(): EnrichedResort[] {
  if (!fs.existsSync(ENRICHED_PATH)) return []
  return readJsonl<EnrichedResort>(ENRICHED_PATH)
}

export function readEncoded(): EncodedResort[] {
  if (!fs.existsSync(ENCODED_PATH)) return []
  return readJsonl<EncodedResort>(ENCODED_PATH)
}

export function readMerged(): SeededResort[] {
  const seeded = readSeeded()
  if (seeded.length === 0) return []
  const enriched = readEnriched()
  if (enriched.length === 0) return seeded
  const enrichedById = new Map(enriched.map((r) => [r.id, r]))
  return seeded
    .filter((s) => enrichedById.has(s.id))
    .map((s) => mergeEnrichedIntoSeeded(s, enrichedById.get(s.id)!))
}

export { mergeEnrichedIntoSeeded }
