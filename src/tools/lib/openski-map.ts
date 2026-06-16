import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse as csvParse } from 'csv-parse/sync'
import { REGIONS, type Region } from '../../shared/regions'
import { ANSI_BOLD, ANSI_RESET, log } from './log'
import { mapToRegion } from './region-map'

const NON_SURFACE_LIFT_TYPES = new Set([
  'chair_lift',
  'gondola',
  'cable_car',
  'funicular',
  'mixed_lift',
])

interface SkiArea {
  id: string
  name: string
  countries: string
  regions: string
  status: string
  has_downhill: string
  downhill_distance_km: string
  vertical_m: string
  min_elevation_m: string
  max_elevation_m: string
  lift_count: string
  surface_lifts_count: string
  run_convention: string
  websites: string
  lat: string
  lng: string
  openskimap_id: string
}

interface ParsedSkiArea {
  id: string
  name: string
  country: string
  region: Region
  latitude: string
  longitude: string
  summitAltitude: number
  baseAltitude: number
  pisteKm: number
  liftCount: number
  websites: string[]
  beginnerPct: number
  intermediatePct: number
  advancedPct: number
}

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  return csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[]
}

async function downloadIfNeeded(url: string, localPath: string): Promise<void> {
  if (fs.existsSync(localPath)) {
    log(
      'info',
      'seed',
      `Using cached: ${ANSI_BOLD}${path.basename(localPath)}${ANSI_RESET}`,
      1
    )
    return
  }
  log(
    'info',
    'seed',
    `Downloading ${ANSI_BOLD}${path.basename(localPath)}${ANSI_RESET} from ${url}...`,
    1
  )
  fs.mkdirSync(path.dirname(localPath), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`
    )
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(localPath, buffer)
  log(
    'success',
    'seed',
    `Cached: ${path.basename(localPath)} (${(buffer.length / 1024).toFixed(0)} KB)`,
    1
  )
}

function hasNonSurfaceLift(
  areaId: string,
  liftIndex: Map<string, Set<string>>
): boolean {
  const types = liftIndex.get(areaId)
  if (!types) return false
  for (const t of types) {
    if (NON_SURFACE_LIFT_TYPES.has(t)) return true
  }
  return false
}

function computeDifficulty(
  areaId: string,
  runIndex: Map<string, { difficulty: string; color: string }[]>
): { beginnerPct: number; intermediatePct: number; advancedPct: number } {
  const runs = runIndex.get(areaId)
  if (!runs || runs.length === 0) {
    return { beginnerPct: 0, intermediatePct: 0, advancedPct: 0 }
  }

  let beginner = 0
  let intermediate = 0
  let advanced = 0

  for (const run of runs) {
    const diff = run.difficulty.toLowerCase().trim()
    const col = run.color.toLowerCase().trim()

    if (
      diff === 'novice' ||
      diff === 'easy' ||
      diff === 'green' ||
      col === 'novice' ||
      col === 'easy' ||
      col === 'green'
    ) {
      beginner++
    } else if (
      diff === 'intermediate' ||
      diff === 'blue' ||
      col === 'intermediate' ||
      col === 'blue'
    ) {
      intermediate++
    } else if (
      diff === 'advanced' ||
      diff === 'expert' ||
      diff === 'red' ||
      diff === 'black' ||
      col === 'grey' ||
      col === 'advanced' ||
      col === 'expert' ||
      col === 'red' ||
      col === 'black'
    ) {
      advanced++
    } else {
    }
  }

  const total = beginner + intermediate + advanced
  if (total === 0) {
    return { beginnerPct: 0, intermediatePct: 0, advancedPct: 0 }
  }

  return {
    beginnerPct: Math.round((beginner / total) * 100),
    intermediatePct: Math.round((intermediate / total) * 100),
    advancedPct: Math.round((advanced / total) * 100),
  }
}

function parseWebsites(raw: string): string[] {
  if (!raw || raw.trim() === '') return []
  return raw
    .split(/[\s;]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'))
}

function slugify(name: string, region: string, country: string): string {
  const parts = [name, region, country]
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function loadOpenSkiMapData(
  dataDir: string,
  options?: { minPisteKm?: number }
): Promise<ParsedSkiArea[]> {
  const minPisteKm = options?.minPisteKm ?? 1
  const skiAreasPath = path.resolve(dataDir, 'ski_areas.csv')
  const liftsPath = path.resolve(dataDir, 'lifts.csv')
  const runsPath = path.resolve(dataDir, 'runs.csv')

  await Promise.all([
    downloadIfNeeded(
      'https://tiles.openskimap.org/csv/ski_areas.csv',
      skiAreasPath
    ),
    downloadIfNeeded('https://tiles.openskimap.org/csv/lifts.csv', liftsPath),
    downloadIfNeeded('https://tiles.openskimap.org/csv/runs.csv', runsPath),
  ])

  const skiAreasRaw = parseCsv(skiAreasPath)
  const liftsRaw = parseCsv(liftsPath)
  const runsRaw = parseCsv(runsPath)

  const liftIndex = new Map<string, Set<string>>()
  for (const lift of liftsRaw) {
    if ((lift as Record<string, string>).status !== 'operating') continue
    const ids = ((lift as Record<string, string>).ski_area_ids ?? '').split(';')
    const liftType = ((lift as Record<string, string>).lift_type ?? '')
      .trim()
      .toLowerCase()
    for (const id of ids) {
      const trimmed = id.trim()
      if (!trimmed) continue
      if (!liftIndex.has(trimmed)) liftIndex.set(trimmed, new Set())
      liftIndex.get(trimmed)!.add(liftType)
    }
  }

  const runIndex = new Map<string, { difficulty: string; color: string }[]>()
  for (const run of runsRaw) {
    const ids = ((run as Record<string, string>).ski_area_ids ?? '').split(';')
    const difficulty = ((run as Record<string, string>).difficulty ?? '').trim()
    const color = ((run as Record<string, string>).color ?? '').trim()
    for (const id of ids) {
      const trimmed = id.trim()
      if (!trimmed) continue
      if (!runIndex.has(trimmed)) runIndex.set(trimmed, [])
      runIndex.get(trimmed)!.push({ difficulty, color })
    }
  }

  const results: ParsedSkiArea[] = []
  const seenSlugs = new Set<string>()
  const validRegions = new Set(REGIONS)

  for (const row of skiAreasRaw) {
    const area = row as unknown as SkiArea

    if (area.status !== 'operating') continue
    if (area.has_downhill !== 'yes') continue
    if (!area.name || area.name.trim() === '') continue

    const areaId = area.id || area.openskimap_id
    if (!areaId) continue

    const downhillKm = parseFloat(area.downhill_distance_km)
    if (Number.isNaN(downhillKm) || downhillKm < minPisteKm) continue
    if (!hasNonSurfaceLift(areaId, liftIndex)) continue

    const country = area.countries.split(';')[0].trim()
    const regionRaw = area.regions.split(';')[0].trim()
    const region = mapToRegion(country, regionRaw)

    if (!validRegions.has(region)) continue

    const name = area.name.trim()

    const baseAlt = parseInt(area.min_elevation_m, 10)
    const summitAlt = parseInt(area.max_elevation_m, 10)
    const liftCount = parseInt(area.lift_count, 10)
    const websites = parseWebsites(area.websites)
    const lat = area.lat?.trim() ?? ''
    const lng = area.lng?.trim() ?? ''

    if (!lat || !lng) continue

    const slug = slugify(name, region, country)
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    const diff = computeDifficulty(areaId, runIndex)

    results.push({
      id: slug,
      name,
      country,
      region,
      latitude: lat,
      longitude: lng,
      summitAltitude: Number.isNaN(summitAlt) ? 0 : summitAlt,
      baseAltitude: Number.isNaN(baseAlt) ? 0 : baseAlt,
      pisteKm: Number.isNaN(downhillKm) ? 0 : Math.round(downhillKm),
      liftCount: Number.isNaN(liftCount) ? 0 : liftCount,
      websites,
      beginnerPct: diff.beginnerPct,
      intermediatePct: diff.intermediatePct,
      advancedPct: diff.advancedPct,
    })
  }

  return results
}
