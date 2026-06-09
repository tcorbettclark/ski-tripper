import type { EnrichedResort, SeededResort } from './types'

export type AuditIssue =
  | { type: 'low-quality'; fields: string[] }
  | { type: 'invalid-snow-reliability'; value: string }
  | { type: 'negative-transfer-time'; value: number | null }

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

export const QUALITY_FIELDS: Record<string, string | string[] | number | null> =
  {
    description: '',
    nearestAirport: '',
    transferTime: null,
    snowReliability: '',
    skiSeasonMonths: '',
    websites: [],
  }

export function isLowQualityValue(
  key: string,
  value: string | string[] | number | null
): boolean {
  const fallback = QUALITY_FIELDS[key]
  if (value === null) return true
  if (value === fallback) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

export function hasLowQualityFields(entry: EnrichedResort): boolean {
  for (const key of Object.keys(QUALITY_FIELDS)) {
    if (
      key in entry &&
      isLowQualityValue(
        key,
        entry[key as keyof EnrichedResort] as string | string[] | null
      )
    ) {
      return true
    }
  }
  return false
}

export function listLowQualityFields(entry: EnrichedResort): string[] {
  const result: string[] = []
  for (const key of Object.keys(QUALITY_FIELDS)) {
    if (
      key in entry &&
      isLowQualityValue(
        key,
        entry[key as keyof EnrichedResort] as string | string[] | null
      )
    ) {
      result.push(key)
    }
  }
  return result
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
    if (r.transferTime != null && r.transferTime < 0) {
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

function findDuplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) dupes.add(item.id)
    seen.add(item.id)
  }
  return [...dupes].sort()
}
