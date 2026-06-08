import type { EnrichedResort, SeededResort } from './types'

export type AuditIssue =
  | { type: 'low-quality'; fields: string[] }
  | { type: 'invalid-snow-reliability'; value: string }
  | { type: 'negative-transfer-time'; value: number }

export interface AuditResult {
  seededCount: number
  enrichedCount: number
  coveragePct: string
  orphans: Array<{ id: string }>
  duplicateSeededIds: string[]
  duplicateEnrichedIds: string[]
  enrichedProblems: Array<{
    id: string
    resortName: string
    issues: AuditIssue[]
  }>
}

export function auditEnrichedData(
  seeded: SeededResort[],
  enriched: EnrichedResort[]
): AuditResult {
  const seededIds = new Set(seeded.map((r) => r.id))
  const seededById = new Map(seeded.map((r) => [r.id, r]))

  const orphans = enriched
    .filter((r) => !seededIds.has(r.id))
    .map((r) => ({ id: r.id }))

  const duplicateSeededIds = findDuplicateIds(seeded)
  const duplicateEnrichedIds = findDuplicateIds(enriched)

  const validSnowReliability = new Set(['high', 'medium', 'low', ''])
  const enrichedProblems: Array<{
    id: string
    resortName: string
    issues: AuditIssue[]
  }> = []

  for (const r of enriched) {
    const issues: AuditIssue[] = []
    const lowFields = listLowQualityFields(r)
    if (lowFields.length > 0) {
      issues.push({ type: 'low-quality', fields: lowFields })
    }
    if (r.snowReliability && !validSnowReliability.has(r.snowReliability)) {
      issues.push({
        type: 'invalid-snow-reliability',
        value: r.snowReliability,
      })
    }
    if (r.transferTime < 0) {
      issues.push({ type: 'negative-transfer-time', value: r.transferTime })
    }
    if (issues.length > 0) {
      const resortName = seededById.get(r.id)?.resortName ?? r.id
      enrichedProblems.push({ id: r.id, resortName, issues })
    }
  }

  const coveragePct =
    seeded.length > 0
      ? ((enriched.length / seeded.length) * 100).toFixed(1)
      : '0.0'

  return {
    seededCount: seeded.length,
    enrichedCount: enriched.length,
    coveragePct,
    orphans,
    duplicateSeededIds,
    duplicateEnrichedIds,
    enrichedProblems,
  }
}

function listLowQualityFields(entry: EnrichedResort): string[] {
  const defaults: Record<string, string | string[] | number> = {
    description: '',
    nearestAirport: '',
    transferTime: 0,
    snowReliability: '',
    skiSeasonMonths: '',
    websites: [],
    linkedResortsDescription: '',
  }
  const fields = Object.keys(defaults) as (keyof typeof defaults)[]
  const result: string[] = []
  for (const key of fields) {
    if (!(key in entry)) continue
    const value = entry[key as keyof EnrichedResort] as string | string[] | null
    if (value === null) {
      result.push(key)
    } else if (value === defaults[key]) {
      result.push(key)
    } else if (typeof value === 'string' && value.trim() === '') {
      result.push(key)
    } else if (Array.isArray(value) && value.length === 0) {
      result.push(key)
    }
  }
  return result
}

function findDuplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) dupes.add(item.id)
    seen.add(item.id)
  }
  return [...dupes].sort()
}
