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
    terrainDescription: '',
    offPisteDescription: '',
    valueDescription: '',
    familyDescription: '',
    apresSkiDescription: '',
    resortCharacterDescription: '',
    liftSystemDescription: '',
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

export function filterAuditResult(
  result: AuditResult,
  fields: string[]
): AuditResult {
  if (fields.length === 0) return result

  const enrichedProblems = result.enrichedProblems.filter((problem) =>
    fields.every((field) =>
      problem.issues.some((issue) => issueMatchesField(issue, field))
    )
  )

  return { ...result, enrichedProblems }
}

function issueMatchesField(issue: AuditIssue, field: string): boolean {
  if (issue.type === 'low-quality') return issue.fields.includes(field)
  if (issue.type === 'invalid-snow-reliability')
    return field === 'snowReliability'
  if (issue.type === 'negative-transfer-time') return field === 'transferTime'
  return false
}

export const ALL_PROBLEM_FIELDS = Object.keys(QUALITY_FIELDS)

export function problemFieldCounts(
  result: AuditResult
): Array<{ field: string; count: number }> {
  const counts = new Map<string, number>(
    ALL_PROBLEM_FIELDS.map((f): [string, number] => [f, 0])
  )
  for (const problem of result.enrichedProblems) {
    const seen = new Set<string>()
    for (const issue of problem.issues) {
      for (const field of issueFields(issue)) {
        if (!seen.has(field)) {
          seen.add(field)
          counts.set(field, (counts.get(field) ?? 0) + 1)
        }
      }
    }
  }
  return [...counts.entries()]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field))
}

function issueFields(issue: AuditIssue): string[] {
  if (issue.type === 'low-quality') return issue.fields
  if (issue.type === 'invalid-snow-reliability') return ['snowReliability']
  if (issue.type === 'negative-transfer-time') return ['transferTime']
  return []
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
