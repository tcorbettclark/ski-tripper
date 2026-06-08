#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import { pipeline } from '@huggingface/transformers'
import { Command } from 'commander'
import {
  Client as NodeClient,
  Storage as NodeStorage,
  Permission,
  Role,
} from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import * as z from 'zod'

import { cleanUrls } from './lib/clean-urls'
import { readJsonl, simpleHash, writeJsonl } from './lib/jsonl'
import {
  buildJsonSchema,
  DEFAULT_MODEL,
  ENRICH_SOURCE_WEBSITES,
  getExa,
  jsonCodec,
  LLM_SYSTEM_PROMPT,
  LLM_USER_PROMPT,
  ollama,
  streamThinking,
} from './lib/llm'
import { ANSI_BOLD, ANSI_DIM, ANSI_RESET, log, logSummary } from './lib/log'
import { loadOpenSkiMapData } from './lib/openski-map'
import type { EncodedResort, EnrichedResort, SeededResort } from './lib/types'

const RESORTS_DIR = 'resorts'
const RESORTS_BUCKET_ID = process.env
  .PUBLIC_APPWRITE_RESORTS_BUCKET_ID as string
const RESORTS_FILE_ID = process.env.PUBLIC_APPWRITE_RESORTS_FILE_ID as string

const adminClient = new NodeClient()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_DATABASE_API_KEY as string)

const adminStorage = new NodeStorage(adminClient)

const EXA_SOURCED_NUM_RESULTS = 4
const EXA_BROAD_NUM_RESULTS = 4
const EXA_MAX_CHARS = 12000 as const
const EXA_SEARCH_QUERY = (resortName: string, country: string) =>
  `Ski resort review and guide for ${resortName} in ${country}, including terrain difficulty, off-piste, apres-ski, nightlife, family suitability, value, lift quality, resort atmosphere, nearest airport, and transfer time`

const enrichSchema = z.object({
  description: z
    .string()
    .nullable()
    .describe(
      'A detailed description (4-6 paragraphs) of the ski resort covering: terrain difficulty and character; off-piste quality; whether it is expensive or budget-friendly; suitability for families vs groups; quality of apres-ski and nightlife; whether the resort is picturesque or purpose-built; lift system quality and age; and overall atmosphere and highlights'
    ),
  nearestAirport: z
    .string()
    .nullable()
    .describe('Name of the nearest airport, e.g. "Geneva Airport"'),
  transferTime: z
    .number()
    .nullable()
    .describe('Transfer time from airport in minutes, e.g. 120'),
  snowReliability: z
    .enum(['high', 'medium', 'low'])
    .nullable()
    .describe('Snow reliability rating'),
  skiSeasonMonths: z
    .string()
    .nullable()
    .describe('Typical ski season, e.g. "Dec-Apr"'),
  websites: z
    .array(z.string())
    .nullable()
    .describe(
      'All URLs of websites with information about skiing at the resort. Include every relevant URL found in the source text; do not attempt to consolidate or deduplicate.'
    ),
  linkedResortsDescription: z
    .string()
    .nullable()
    .describe(
      'One sentence describing nearby linked resorts, e.g. "Part of the 3 Vallées ski area, linked to Méribel and Courchevel by lift."'
    ),
})

type EnrichData = z.infer<typeof enrichSchema>

type ResolvedEnrichData = {
  [K in keyof EnrichData]: NonNullable<EnrichData[K]>
}

const enrichDefaults: Record<string, string | string[] | number> = {
  description: '',
  nearestAirport: '',
  transferTime: 0,
  snowReliability: '',
  skiSeasonMonths: '',
  websites: [],
  linkedResortsDescription: '',
}

function formatTransferTime(minutes: number): string {
  if (minutes <= 0) return '0 mins'
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return mins === 1 ? '1 min' : `${mins} mins`
  if (mins === 0) return hrs === 1 ? '1 hr' : `${hrs} hrs`
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`
}

function withDefaults(data: EnrichData): ResolvedEnrichData {
  const result = { ...data } as Record<string, unknown>
  for (const [key, fallback] of Object.entries(enrichDefaults)) {
    if (result[key] === null) {
      result[key] = fallback
    }
  }
  return result as ResolvedEnrichData
}

function isLowQualityValue(
  key: keyof EnrichData,
  value: string | string[] | null
): boolean {
  if (value === null) return true
  if (value === enrichDefaults[key]) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function hasLowQualityFields(entry: EnrichedResort): boolean {
  const fields = Object.keys(enrichDefaults) as (keyof EnrichData)[]
  for (const key of fields) {
    if (
      key in entry &&
      isLowQualityValue(key, entry[key] as string | string[] | null)
    ) {
      return true
    }
  }
  return false
}

function listLowQualityFields(entry: EnrichedResort): string[] {
  const fields = Object.keys(enrichDefaults) as (keyof EnrichData)[]
  const result: string[] = []
  for (const key of fields) {
    if (
      key in entry &&
      isLowQualityValue(key, entry[key] as string | string[] | null)
    ) {
      result.push(key)
    }
  }
  return result
}

function mergeEnriched(
  existing: EnrichedResort,
  newData: ResolvedEnrichData,
  seeded: SeededResort
): EnrichedResort {
  const merged = { ...existing }
  const fields = Object.keys(enrichDefaults) as (keyof EnrichData)[]
  for (const key of fields) {
    const oldValue = existing[key] as string | string[] | null
    const isOldLow = isLowQualityValue(key, oldValue)
    if (isOldLow) {
      if (key === 'websites') {
        const mergedWebsites = cleanUrls([
          ...seeded.websites,
          ...newData.websites,
        ])
        merged.websites = mergedWebsites
      } else {
        ;(merged[key] as (typeof newData)[typeof key]) = newData[key]
      }
    }
  }
  return merged
}

async function enrichResort(
  resortName: string,
  country: string,
  model: string,
  seeded: SeededResort
): Promise<ResolvedEnrichData | null> {
  const responseCodec = jsonCodec(enrichSchema)

  log('info', 'enrich', `Enriching "${resortName}" via Exa+LLM`)

  log('info', 'enrich', 'Fetching source text from Exa...', 1)
  const [sourcedResults, broadResults] = await Promise.all([
    getExa().search(EXA_SEARCH_QUERY(resortName, country), {
      type: 'auto',
      numResults: EXA_SOURCED_NUM_RESULTS,
      useAutoprompt: true,
      includeDomains: [...ENRICH_SOURCE_WEBSITES],
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
    getExa().search(EXA_SEARCH_QUERY(resortName, country), {
      type: 'auto',
      numResults: EXA_BROAD_NUM_RESULTS,
      useAutoprompt: true,
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
  ])

  const seenUrls = new Set<string>()
  const allResults = [...sourcedResults.results, ...broadResults.results]
  const dedupedResults = allResults.filter((r) => {
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)
    return true
  })

  const sourcedHosts = new Set(
    sourcedResults.results.map((r) => new URL(r.url).hostname)
  )

  log(
    'info',
    'enrich',
    `Sourced: ${sourcedResults.results.length} results, Broad: ${broadResults.results.length} results, Deduped: ${dedupedResults.length}`,
    1
  )
  for (const r of dedupedResults) {
    const tag = sourcedHosts.has(new URL(r.url).hostname)
      ? 'authoritative'
      : 'general'
    log('info', 'enrich', `  [${tag}] ${r.url}`, 2)
  }

  const sourceText = dedupedResults
    .filter((r) => r.text)
    .map((r) => {
      const tag = sourcedHosts.has(new URL(r.url).hostname)
        ? 'Authoritative source'
        : 'General source'
      const parts = [`## ${r.title ?? 'Untitled'} (${tag})\nURL: ${r.url}`]
      if (r.highlights?.length) {
        parts.push(`### Key facts\n${r.highlights.join('\n')}`)
      }
      parts.push(r.text!)
      return parts.join('\n')
    })
    .join('\n\n')

  if (!sourceText) {
    log('error', 'enrich', 'No source text found', 1)
    return null
  }

  log(
    'success',
    'enrich',
    `Got ${sourceText.length} chars of source text from ${dedupedResults.length} results`,
    1
  )

  const systemPrompt = LLM_SYSTEM_PROMPT.replace(
    '{SCHEMA}',
    JSON.stringify(buildJsonSchema(), null, 2)
  )

  const knownFacts = `  resortName: ${seeded.resortName}
  country: ${seeded.country}
  region: ${seeded.region}
  baseAltitude: ${seeded.baseAltitude}m
  summitAltitude: ${seeded.summitAltitude}m
  pisteKm: ${seeded.pisteKm}
  liftCount: ${seeded.liftCount}
  beginnerPct: ${seeded.beginnerPct}%
  intermediatePct: ${seeded.intermediatePct}%
  advancedPct: ${seeded.advancedPct}%`

  const userPrompt = LLM_USER_PROMPT(
    resortName,
    country,
    sourceText,
    knownFacts
  )

  log('info', 'enrich', 'Streaming LLM extraction...', 1)
  const stream = await ollama.chat({
    stream: true,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  let content = ''
  const thinking = await streamThinking(stream, (chunk) => {
    content += chunk
  })

  if (!thinking && !content) {
    log('error', 'enrich', 'LLM returned empty content', 1)
    return null
  }
  if (!content) {
    log('error', 'enrich', 'LLM returned empty content after thinking', 1)
    return null
  }
  try {
    console.log(JSON.stringify(JSON.parse(content), null, 2))
  } catch {
    console.log(content)
  }
  log('info', 'enrich', `LLM response received (${content.length} chars)`, 1)

  const result = responseCodec.decode(content, { reportInput: true })
  if (!result) {
    log(
      'error',
      'enrich',
      `Failed to parse LLM response: ${content.slice(0, 300)}`,
      1
    )
    return null
  }

  log('success', 'enrich', `Successfully enriched "${resortName}"`, 1)
  const defaulted = withDefaults(result)
  defaulted.websites = cleanUrls(defaulted.websites)
  return defaulted
}

function displayEnrichedData(
  resortName: string,
  country: string,
  region: string,
  data: ResolvedEnrichData,
  seeded: SeededResort
) {
  console.log()
  const location = region ? `${country}, ${region}` : country
  console.log(
    `  ${ANSI_BOLD}${resortName}${ANSI_RESET} ${ANSI_DIM}(${location})${ANSI_RESET}`
  )
  console.log()
  logSummary(
    'Altitude',
    `${seeded.baseAltitude}m - ${seeded.summitAltitude}m`,
    2
  )
  logSummary(
    'Airport',
    data.nearestAirport
      ? `${data.nearestAirport} (${data.transferTime ? formatTransferTime(data.transferTime) : 'unknown'})`
      : 'unknown',
    2
  )
  logSummary('Piste', `${seeded.pisteKm} km`, 2)
  logSummary('Beginner', `${seeded.beginnerPct}%`, 2)
  logSummary('Intermediate', `${seeded.intermediatePct}%`, 2)
  logSummary('Advanced', `${seeded.advancedPct}%`, 2)
  logSummary('Lifts', `${seeded.liftCount}`, 2)
  logSummary('Snow', data.snowReliability, 2)
  logSummary('Season', data.skiSeasonMonths, 2)
  logSummary('Websites', data.websites.join(', '), 2)
  logSummary('Linked Resorts', data.linkedResortsDescription, 2)
  logSummary('Description', `${data.description.slice(0, 200)}...`, 2)
}

async function confirmEnrichedData(
  resortName: string,
  country: string,
  region: string,
  data: ResolvedEnrichData,
  seeded: SeededResort,
  autoAccept: boolean
): Promise<{
  accepted: boolean
  data: ResolvedEnrichData
  autoAcceptRest: boolean
}> {
  if (autoAccept) {
    return { accepted: true, data, autoAcceptRest: true }
  }

  displayEnrichedData(resortName, country, region, data, seeded)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('\n  Accept? (y/modify/auto/skip/quit): ')
    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'y' || trimmed === '') {
      return { accepted: true, data, autoAcceptRest: false }
    }

    if (trimmed === 'auto') {
      log('info', 'enrich', 'Auto-accepting all remaining resorts.', 1)
      return { accepted: true, data, autoAcceptRest: true }
    }

    if (trimmed === 'skip') {
      return { accepted: false, data, autoAcceptRest: false }
    }

    if (trimmed === 'quit') {
      log('warn', 'enrich', 'Stopping enrichment.', 1)
      return { accepted: false, data, autoAcceptRest: false }
    }

    if (trimmed === 'modify') {
      console.log(
        '  Current values (edit in JSON format, or press Enter to keep):'
      )
      const fieldNames = Object.keys(data) as (keyof EnrichData)[]
      const modified = { ...data }

      for (const field of fieldNames) {
        const currentVal =
          typeof data[field] === 'string' ? data[field] : String(data[field])
        const newVal = await rl.question(`    ${field} [${currentVal}]: `)
        if (newVal.trim()) {
          const coerced = enrichSchema.shape[field]
          const parsed = coerced.safeParse(newVal.trim())
          if (parsed.success) {
            ;(modified[field] as typeof parsed.data) = parsed.data
          } else {
            log(
              'warn',
              'enrich',
              `Invalid value for ${field}, keeping original.`,
              3
            )
          }
        }
      }

      return { accepted: true, data: modified, autoAcceptRest: false }
    }

    return { accepted: true, data, autoAcceptRest: false }
  } finally {
    rl.close()
  }
}

function toEnrichedEntry(
  seededResort: SeededResort,
  data: ResolvedEnrichData
): EnrichedResort {
  return {
    id: seededResort.id,
    description: data.description,
    nearestAirport: data.nearestAirport,
    transferTime: data.transferTime,
    snowReliability: data.snowReliability as 'high' | 'medium' | 'low' | '',
    skiSeasonMonths: data.skiSeasonMonths,
    websites: cleanUrls([...seededResort.websites, ...data.websites]),
    linkedResortsDescription: data.linkedResortsDescription,
  }
}

type EnrichMode = 'new' | 'fill' | 'all'

async function enrich(options: {
  model?: string
  autoAccept?: boolean
  fill?: boolean
  all?: boolean
  resort?: string
  region?: string
}) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
  const seededPath = path.resolve(RESORTS_DIR, 'seeded.jsonl')
  const enrichedPath = path.resolve(RESORTS_DIR, 'enriched.jsonl')
  let mode: EnrichMode = 'new'
  if (options.all && options.fill) {
    log('error', 'enrich', 'Cannot use --fill and --all together. Pick one.')
    process.exit(1)
  }
  if (options.all) mode = 'all'
  else if (options.fill) mode = 'fill'

  log('info', 'enrich', `Seeded file: ${seededPath}`)
  log('info', 'enrich', `Enriched file: ${enrichedPath}`)

  const seeded = readJsonl<SeededResort>(seededPath)
  if (seeded.length === 0) {
    log(
      'error',
      'enrich',
      `No seeded resorts found in ${seededPath}. Run seed first.`
    )
    process.exit(1)
  }

  const existingEnriched = readJsonl<EnrichedResort>(enrichedPath)
  const enrichedById = new Map(existingEnriched.map((r) => [r.id, r]))

  let toEnrich: SeededResort[]
  const reEnrichMode = mode === 'fill' || mode === 'all'

  if (options.resort) {
    const matched = seeded.filter((r) => r.id === options.resort)
    if (matched.length === 0) {
      log(
        'error',
        'enrich',
        `No seeded resort with id "${options.resort}". Available: ${seeded.map((r) => r.id).join(', ')}`
      )
      process.exit(1)
    }
    toEnrich = matched
    log(
      'info',
      'enrich',
      `Mode: ${ANSI_BOLD}--resort${ANSI_RESET} targeting "${options.resort}"`
    )
  } else if (mode === 'new') {
    toEnrich = seeded.filter((r) => !enrichedById.has(r.id))
    if (toEnrich.length === 0) {
      log(
        'success',
        'enrich',
        'All seeded resorts are already enriched. Use --fill or --all to re-enrich.'
      )
      return
    }
    log(
      'info',
      'enrich',
      `Mode: ${ANSI_BOLD}new${ANSI_RESET} (un-enriched resorts only)`
    )
  } else if (mode === 'fill') {
    const newResorts = seeded.filter((r) => !enrichedById.has(r.id))
    const lowQuality = seeded.filter((r) => {
      const e = enrichedById.get(r.id)
      return e && hasLowQualityFields(e)
    })
    toEnrich = [...newResorts, ...lowQuality]
    const dedupedIds = new Set<string>()
    toEnrich = toEnrich.filter((r) => {
      if (dedupedIds.has(r.id)) return false
      dedupedIds.add(r.id)
      return true
    })
    if (toEnrich.length === 0) {
      log(
        'success',
        'enrich',
        'All seeded resorts are enriched with complete data. Use --all to re-enrich from scratch.'
      )
      return
    }
    log(
      'info',
      'enrich',
      `Mode: ${ANSI_BOLD}fill${ANSI_RESET} (new resorts + resorts with low-quality fields)`
    )
    const lowQualityNames = lowQuality.map((r) => {
      const fields = listLowQualityFields(enrichedById.get(r.id)!)
      return `${r.resortName} (missing: ${fields.join(', ')})`
    })
    if (lowQualityNames.length > 0) {
      log('info', 'enrich', `Low-quality resorts to re-fill:`, 1)
      for (const name of lowQualityNames) {
        log('info', 'enrich', `  ${name}`, 2)
      }
    }
  } else {
    toEnrich = seeded
    log(
      'info',
      'enrich',
      `Mode: ${ANSI_BOLD}all${ANSI_RESET} (re-enrich every resort from scratch)`
    )
  }

  if (options.region) {
    const before = toEnrich.length
    toEnrich = toEnrich.filter((r) => r.region === options.region)
    if (toEnrich.length === 0) {
      log(
        'error',
        'enrich',
        `No resorts found in region "${options.region}". Available regions: ${[...new Set(seeded.map((r) => r.region))].sort().join(', ')}`
      )
      process.exit(1)
    }
    log(
      'info',
      'enrich',
      `Region filter: ${ANSI_BOLD}${options.region}${ANSI_RESET} (${before - toEnrich.length} excluded, ${toEnrich.length} remaining)`
    )
  }

  log(
    'info',
    'enrich',
    `Found ${toEnrich.length} resort(s) to enrich (out of ${seeded.length} total, ${existingEnriched.length} already enriched)`
  )
  log('info', 'enrich', `Model: ${model}`)

  let enrichedCount = 0
  let skipped = 0
  let autoAccept = options.autoAccept ?? false

  for (let i = 0; i < toEnrich.length; i++) {
    const seededResort = toEnrich[i]
    const existing = enrichedById.get(seededResort.id)
    const action =
      reEnrichMode && existing
        ? mode === 'fill'
          ? 'filling'
          : 're-enriching'
        : 'enriching'
    log(
      'info',
      'enrich',
      `[${i + 1}/${toEnrich.length}] ${action} ${seededResort.resortName} (${seededResort.country})...`
    )

    const result = await enrichResort(
      seededResort.resortName,
      seededResort.country,
      model,
      seededResort
    )
    if (!result) {
      log(
        'warn',
        'enrich',
        `Failed to enrich ${seededResort.resortName}, skipping.`,
        1
      )
      skipped++
      continue
    }

    const confirmed = await confirmEnrichedData(
      seededResort.resortName,
      seededResort.country,
      seededResort.region,
      result,
      seededResort,
      autoAccept
    )
    autoAccept = confirmed.autoAcceptRest

    if (confirmed.accepted) {
      let enrichedEntry: EnrichedResort
      if (reEnrichMode && existing && mode === 'fill') {
        const merged = mergeEnriched(existing, confirmed.data, seededResort)
        const lowFields = listLowQualityFields(existing)
        log('info', 'enrich', `Filled fields: ${lowFields.join(', ')}`, 1)
        enrichedEntry = merged
      } else {
        enrichedEntry = toEnrichedEntry(seededResort, confirmed.data)
      }
      enrichedById.set(seededResort.id, enrichedEntry)
      enrichedCount++
      log(
        'success',
        'enrich',
        `Written ${seededResort.resortName} to enriched.jsonl`,
        1
      )

      writeJsonl(
        enrichedPath,
        [...enrichedById.values()].sort((a, b) => a.id.localeCompare(b.id))
      )
    } else {
      skipped++
      log('warn', 'enrich', `Skipped ${seededResort.resortName}.`, 1)
    }
  }

  log(
    'success',
    'enrich',
    `Done. Enriched: ${enrichedCount}, Skipped: ${skipped}, Total: ${toEnrich.length}`
  )
}

function computeSearchText(
  seeded: SeededResort,
  enriched: EnrichedResort | undefined
): string {
  const parts = [
    seeded.resortName,
    seeded.country,
    seeded.region,
    enriched?.description ?? '',
    enriched?.linkedResortsDescription ?? '',
  ]
  if (enriched?.skiSeasonMonths) {
    parts.push(`Season: ${enriched.skiSeasonMonths}`)
  }
  if (enriched?.snowReliability) {
    parts.push(`Snow: ${enriched.snowReliability}`)
  }
  if (enriched?.nearestAirport) {
    parts.push(`Airport: ${enriched.nearestAirport}`)
  }
  return parts.filter(Boolean).join('. ')
}

async function encode() {
  const seededPath = path.resolve(RESORTS_DIR, 'seeded.jsonl')
  const enrichedPath = path.resolve(RESORTS_DIR, 'enriched.jsonl')
  const encodedPath = path.resolve(RESORTS_DIR, 'encoded.jsonl')

  log('info', 'encode', `Seeded file: ${seededPath}`)
  log('info', 'encode', `Enriched file: ${enrichedPath}`)
  log('info', 'encode', `Encoded file: ${encodedPath}`)

  const seeded = readJsonl<SeededResort>(seededPath)
  if (seeded.length === 0) {
    log(
      'error',
      'encode',
      `No seeded resorts found in ${seededPath}. Run seed first.`
    )
    process.exit(1)
  }

  const enriched = readJsonl<EnrichedResort>(enrichedPath)
  const enrichedById = new Map(enriched.map((r) => [r.id, r]))

  const existingEncoded = fs.existsSync(encodedPath)
    ? readJsonl<EncodedResort>(encodedPath)
    : []
  const encodedById = new Map(existingEncoded.map((r) => [r.id, r]))

  log(
    'info',
    'encode',
    `Found ${seeded.length} seeded, ${enriched.length} enriched, ${existingEncoded.length} previously encoded (only enriched resorts will be encoded)`
  )

  const notEnriched = seeded.filter((s) => !enrichedById.has(s.id))

  if (notEnriched.length > 0) {
    log(
      'warn',
      'encode',
      `Skipping ${notEnriched.length} seeded resort(s) without enriched data: ${notEnriched.map((s) => s.resortName).join(', ')}`
    )
  }

  const MODEL_ID = 'Xenova/multi-qa-MiniLM-L6-cos-v1'

  const toEncode: Array<{
    seeded: SeededResort
    enriched: EnrichedResort
    searchText: string
  }> = []

  for (const s of seeded) {
    const e = enrichedById.get(s.id)
    if (!e) continue

    const searchText = computeSearchText(s, e)
    const hash = simpleHash(searchText)
    const existing = encodedById.get(s.id)

    if (existing && existing.searchText === hash) {
      log('info', 'encode', `Skipping ${s.resortName} (unchanged)`, 1)
      continue
    }

    toEncode.push({ seeded: s, enriched: e, searchText })
  }

  if (toEncode.length === 0) {
    log(
      'success',
      'encode',
      'All resorts already encoded with up-to-date embeddings.'
    )
    return
  }

  log(
    'info',
    'encode',
    `Encoding ${toEncode.length} resort(s) with ${MODEL_ID}...`
  )
  log(
    'info',
    'encode',
    'Loading model (this may take a moment on first run)...'
  )

  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: 'uint8',
  })

  log('success', 'encode', 'Model loaded.')

  let encoded = 0
  for (const { seeded: s, searchText } of toEncode) {
    log(
      'info',
      'encode',
      `[${encoded + 1}/${toEncode.length}] Encoding ${s.resortName}...`,
      1
    )

    const output = await extractor(searchText, {
      pooling: 'mean',
      normalize: true,
    })
    const embedding = Array.from(output.data as Float32Array)
    const hash = simpleHash(searchText)

    const encodedEntry: EncodedResort = {
      id: s.id,
      embedding,
      searchText: hash,
    }

    encodedById.set(s.id, encodedEntry)
    encoded++
  }

  const allEncoded = [...encodedById.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  )
  writeJsonl(encodedPath, allEncoded)

  log(
    'success',
    'encode',
    `Encoded ${encoded} resort(s). Total: ${allEncoded.length}`
  )
  log('success', 'encode', `Written to ${encodedPath}`)
}

function build() {
  const seededPath = path.resolve(RESORTS_DIR, 'seeded.jsonl')
  const enrichedPath = path.resolve(RESORTS_DIR, 'enriched.jsonl')
  const encodedPath = path.resolve(RESORTS_DIR, 'encoded.jsonl')
  const outputPath = path.resolve(RESORTS_DIR, 'all.jsonl')

  log('info', 'build', 'Building resort data file...')
  log('info', 'build', `Seeded file: ${seededPath}`)
  log('info', 'build', `Enriched file: ${enrichedPath}`)
  log('info', 'build', `Encoded file: ${encodedPath}`)
  log('info', 'build', `Output file: ${outputPath}`)

  const seeded = readJsonl<SeededResort>(seededPath)
  const enriched = readJsonl<EnrichedResort>(enrichedPath)
  const encoded = readJsonl<EncodedResort>(encodedPath)

  const seededIds = new Set(seeded.map((r) => r.id))
  const enrichedIds = new Set(enriched.map((r) => r.id))
  const encodedIds = new Set(encoded.map((r) => r.id))
  const validIds = new Set(
    [...seededIds].filter((id) => enrichedIds.has(id) && encodedIds.has(id))
  )

  if (seeded.length === 0 || validIds.size === 0) {
    log(
      'warn',
      'build',
      'No complete resorts found. Creating empty resort-data.jsonl.'
    )
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, '\n', 'utf-8')
    return
  }

  const skipped =
    seeded.length + enriched.length + encoded.length - validIds.size * 3
  if (skipped > 0) {
    log(
      'warn',
      'build',
      `Skipping ${skipped} resort(s) missing from one or more files (seeded: ${seeded.length}, enriched: ${enriched.length}, encoded: ${encoded.length}, intersection: ${validIds.size})`
    )
  }

  const enrichedById = new Map(enriched.map((r) => [r.id, r]))
  const encodedById = new Map(encoded.map((r) => [r.id, r]))

  const mergedResorts = seeded
    .filter((s) => validIds.has(s.id))
    .map((s) => {
      const e = enrichedById.get(s.id)!
      const enc = encodedById.get(s.id)!

      return {
        id: s.id,
        resortName: s.resortName,
        country: s.country,
        region: s.region,
        description: e.description,
        latitude: s.latitude,
        longitude: s.longitude,
        summitAltitude: s.summitAltitude,
        baseAltitude: s.baseAltitude,
        nearestAirport: e.nearestAirport,
        transferTime: e.transferTime,
        pisteKm: s.pisteKm,
        beginnerPct: s.beginnerPct,
        intermediatePct: s.intermediatePct,
        advancedPct: s.advancedPct,
        liftCount: s.liftCount,
        snowReliability: e.snowReliability,
        skiSeasonMonths: e.skiSeasonMonths,
        websites: cleanUrls([...s.websites, ...e.websites]),
        linkedResortsDescription: e.linkedResortsDescription,
        embedding: enc.embedding,
      }
    })

  writeJsonl(outputPath, mergedResorts)
  log(
    'success',
    'build',
    `Written ${mergedResorts.length} resort(s) to ${outputPath}`
  )
}

async function uploadResorts() {
  const resolved = path.resolve(RESORTS_DIR, 'all.jsonl')
  try {
    await fs.promises.stat(resolved)
  } catch {
    console.error(`Error: File '${resolved}' does not exist.`)
    process.exit(1)
  }
  try {
    await adminStorage.deleteFile({
      bucketId: RESORTS_BUCKET_ID,
      fileId: RESORTS_FILE_ID,
    })
    console.log('Deleted existing file...')
  } catch {
    // File doesn't exist yet, that's fine
  }
  console.log(`Uploading resort data from '${resolved}'...`)
  await adminStorage.createFile({
    bucketId: RESORTS_BUCKET_ID,
    fileId: RESORTS_FILE_ID,
    file: InputFile.fromPath(resolved, 'resort-data.jsonl'),
    permissions: [Permission.read(Role.any())],
  })
  console.log('Upload complete!')
}

async function seed(options: { dryRun?: boolean }) {
  const dataDir = path.resolve(RESORTS_DIR)
  const seededPath = path.resolve(RESORTS_DIR, 'seeded.jsonl')
  const dryRun = options.dryRun ?? false

  log('info', 'seed', `Loading OpenSkiMap data from: ${dataDir}`)

  const resorts = await loadOpenSkiMapData(dataDir)

  log(
    'success',
    'seed',
    `Found ${resorts.length} resorts matching criteria (operating, downhill, named, >=1km piste, has non-surface lift)`
  )

  const byRegion: Record<string, number> = {}
  for (const r of resorts) {
    byRegion[r.region] = (byRegion[r.region] || 0) + 1
  }
  log('info', 'seed', 'Resorts by region:')
  for (const [region, count] of Object.entries(byRegion).sort(
    (a, b) => b[1] - a[1]
  )) {
    log('info', 'seed', `  ${region}: ${count}`, 1)
  }

  const seededResorts: SeededResort[] = resorts.map((r) => ({
    id: r.id,
    resortName: r.name,
    country: r.country,
    region: r.region,
    latitude: r.latitude,
    longitude: r.longitude,
    summitAltitude: r.summitAltitude,
    baseAltitude: r.baseAltitude,
    pisteKm: r.pisteKm,
    liftCount: r.liftCount,
    websites: r.websites,
    beginnerPct: r.beginnerPct,
    intermediatePct: r.intermediatePct,
    advancedPct: r.advancedPct,
  }))

  if (dryRun) {
    log(
      'info',
      'seed',
      `${ANSI_BOLD}Dry run mode${ANSI_RESET} (no file writes)`
    )
    console.log()
    for (const r of seededResorts.slice(0, 20)) {
      log(
        'info',
        'seed',
        `${r.resortName} (${r.country}, ${r.region}) [id=${r.id}]`,
        1
      )
    }
    if (seededResorts.length > 20) {
      log('info', 'seed', `... and ${seededResorts.length - 20} more`, 1)
    }
    log(
      'success',
      'seed',
      `Dry run complete. Would write ${seededResorts.length} resort(s) to ${seededPath}`
    )
    return
  }

  writeJsonl(seededPath, seededResorts)
  log(
    'success',
    'seed',
    `Wrote ${seededResorts.length} resort(s) to ${seededPath}`
  )
}

const program = new Command()

program
  .name('resorts')
  .description(
    'Ski resort data pipeline: seed, enrich, encode, build, and upload'
  )
  .version('1.0.0')

program
  .command('seed')
  .description(
    'Seed ski resorts from OpenSkiMap CSV data into a seeded JSONL file'
  )
  .option('--dry-run', 'Show what would be seeded without writing files')
  .action(seed)

program
  .command('enrich')
  .description(
    'Enrich seeded resorts with detailed data using LLM and Exa search'
  )
  .option(
    '--model <model>',
    'LLM model to use (default: kimi-k2.6:cloud or OLLAMA_MODEL env var)'
  )
  .option('--auto-accept', 'Auto-accept all enriched data without prompting')
  .option(
    '--resort <id>',
    'Enrich a specific resort by id (e.g. "chamonix-alps-france")'
  )
  .option(
    '--region <region>',
    'Enrich only resorts in the specified region (e.g. "Alps", "Rockies (US)")'
  )
  .option(
    '--fill',
    'Re-enrich resorts with missing or low-quality fields, merging new data into existing entries'
  )
  .option(
    '--all',
    'Re-enrich every resort from scratch, replacing all existing data'
  )
  .action(enrich)

program
  .command('encode')
  .description('Encode seeded+enriched resorts into embeddings')
  .action(encode)

program
  .command('build')
  .description(
    'Build resort-data.jsonl from the intersection of seeded, enriched, and encoded files'
  )
  .action(build)

program
  .command('upload')
  .description(
    'Upload resort data to Appwrite Storage (overwrites existing file)'
  )
  .action(uploadResorts)

program.parse()
