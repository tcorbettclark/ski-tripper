#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'

import { pipeline } from '@huggingface/transformers'
import { Command } from 'commander'
import { colorize as colorizeJson } from 'json-colorizer'
import PocketBase from 'pocketbase'
import * as z from 'zod'
import {
  server_get_ollama_model_audit,
  server_get_ollama_model_enrich,
  server_get_pocketbase_admin_email,
  server_get_pocketbase_admin_password,
  server_get_public_pocketbase_url,
} from '../shared/env'
import {
  type AuditIssue,
  auditEnrichedData,
  hasLowQualityFields,
  isLowQualityValue,
  listLowQualityFields,
  QUALITY_FIELDS,
} from './lib/audit'
import { cleanUrls } from './lib/clean-urls'
import {
  buildConsistencyJsonSchema,
  CONSISTENCY_FIELDS,
  CONSISTENCY_SYSTEM_PROMPT,
  CONSISTENCY_USER_PROMPT,
  consistencySchema,
  filterValidInconsistencies,
} from './lib/consistency'
import { simpleHash, writeJsonl } from './lib/jsonl'
import {
  buildJsonSchema,
  ENRICH_SOURCE_WEBSITES,
  getExa,
  getOllama,
  jsonCodec,
  LLM_RETRY_EMPTY_PROMPT,
  LLM_RETRY_PARSE_PROMPT,
  LLM_SYSTEM_PROMPT,
  LLM_USER_PROMPT,
  streamThinking,
} from './lib/llm'
import {
  ANSI_BOLD,
  ANSI_DIM,
  ANSI_GREEN,
  ANSI_RED,
  ANSI_RESET,
  ANSI_YELLOW,
  log,
} from './lib/log'
import { loadOpenSkiMapData } from './lib/openski-map'
import {
  ENCODED_PATH,
  ENRICHED_PATH,
  mergeEnrichedIntoSeeded,
  readEncoded,
  readEnriched,
  readSeeded,
  SEEDED_PATH,
} from './lib/read-resorts'
import type { EncodedResort, EnrichedResort, SeededResort } from './lib/types'

const RESORTS_DIR = path.resolve(import.meta.dir, '../../data/resorts')
const THINKING_DIR = path.resolve(
  import.meta.dir,
  '../../data/resorts/thinking'
)

const EXA_SOURCED_NUM_RESULTS = 5
const EXA_BROAD_NUM_RESULTS = 5
const EXA_TRAVEL_NUM_RESULTS = 3
const EXA_LINKED_NUM_RESULTS = 3
const EXA_MAX_CHARS = 12000 as const
const MAX_SOURCE_TEXT_CHARS = 120000 as const
const DEFAULT_FRESHNESS_YEAR = 2020 as const
const EXA_GENERAL_QUERY = (resortName: string, country: string) =>
  `Ski resort review and guide for ${resortName} in ${country}, including terrain difficulty, off-piste, apres-ski, nightlife, family suitability, value, lift quality, resort atmosphere`
const EXA_TRAVEL_QUERY = (resortName: string, country: string) =>
  `How to get to ${resortName} ski resort in ${country}, flights, nearest major airport, airport transfers, travel time`
const EXA_LINKED_QUERY = (resortName: string, country: string) =>
  `${resortName} ${country} linked ski areas, connected resorts, lift-linked domain, ski area name`

const enrichSchema = z.object({
  terrainDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about terrain character: e.g. "wide, gentle cruising runs above the treeline" not "fantastic terrain for all". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  offPisteDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about off-piste quality: e.g. "steep north-facing couloirs accessed from the top lift" not "superior off-piste". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  valueDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about value: e.g. "one of the cheaper French resorts for lift passes" not "great value". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  familyDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about suitability for families vs groups: e.g. "nursery slopes are at resort level, separate from faster traffic" not "perfect for families". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  apresSkiDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about apres-ski and nightlife: e.g. "cosy old-town bars cluster around the church" not "vibrant nightlife". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  resortCharacterDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about whether the resort is picturesque or purpose-built: e.g. "a purpose-built 1970s station with concrete apartment blocks" not "charming resort". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  liftSystemDescription: z
    .string()
    .nullable()
    .describe(
      'One paragraph about lift system quality and age: e.g. "the lift network is modern and efficient, with heated chairlifts on the main sectors" not "excellent lift system". Use concrete facts, not adjectives. If the source text lacks detail, set to null.'
    ),
  nearestAirport: z
    .string()
    .nullable()
    .describe(
      'Name of the nearest international airport, e.g. "Geneva Airport"'
    ),
  transferTime: z
    .number()
    .nullable()
    .describe(
      'Transfer time from nearest international airport in minutes, e.g. 120'
    ),
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

type ResolvedEnrichData = Omit<
  { [K in keyof EnrichData]: NonNullable<EnrichData[K]> },
  'transferTime'
> & { transferTime: number | null }

const enrichDefaults: Record<string, string | string[] | number | null> = {
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
  linkedResortsDescription: '',
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

function mergeEnriched(
  existing: EnrichedResort,
  newData: ResolvedEnrichData,
  seeded: SeededResort
): EnrichedResort {
  const merged = { ...existing } as Record<string, unknown>
  for (const key of Object.keys(QUALITY_FIELDS)) {
    const oldValue = existing[key as keyof EnrichedResort] as
      | string
      | string[]
      | null
    const isOldLow = isLowQualityValue(key, oldValue)
    if (isOldLow) {
      if (key === 'websites') {
        const mergedWebsites = cleanUrls([
          ...seeded.websites,
          ...newData.websites,
        ])
        merged[key] = mergedWebsites
      } else {
        merged[key] = newData[key as keyof ResolvedEnrichData]
      }
    }
  }
  return merged as unknown as EnrichedResort
}

async function enrichResort(
  resortName: string,
  country: string,
  model: string,
  seeded: SeededResort,
  maxRetries: number,
  freshnessYear: number = DEFAULT_FRESHNESS_YEAR
): Promise<ResolvedEnrichData | null> {
  const responseCodec = jsonCodec(enrichSchema)

  log(
    'info',
    'enrich',
    `Enriching "${resortName}" via Exa+LLM (freshness: >=${freshnessYear})`
  )

  log('info', 'enrich', 'Fetching source text from Exa...', 1)
  const publishedAfter = `${freshnessYear}-01-01T00:00:00.000Z`
  const [sourcedResults, broadResults, travelResults, linkedResults] =
    await Promise.all([
      getExa().search(EXA_GENERAL_QUERY(resortName, country), {
        type: 'auto',
        numResults: EXA_SOURCED_NUM_RESULTS,
        useAutoprompt: true,
        includeDomains: [...ENRICH_SOURCE_WEBSITES],
        startPublishedDate: publishedAfter,
        contents: {
          text: { maxCharacters: EXA_MAX_CHARS },
          highlights: true,
        },
      }),
      getExa().search(EXA_GENERAL_QUERY(resortName, country), {
        type: 'auto',
        numResults: EXA_BROAD_NUM_RESULTS,
        useAutoprompt: true,
        startPublishedDate: publishedAfter,
        contents: {
          text: { maxCharacters: EXA_MAX_CHARS },
          highlights: true,
        },
      }),
      getExa().search(EXA_TRAVEL_QUERY(resortName, country), {
        type: 'auto',
        numResults: EXA_TRAVEL_NUM_RESULTS,
        useAutoprompt: true,
        startPublishedDate: publishedAfter,
        contents: {
          text: { maxCharacters: EXA_MAX_CHARS },
          highlights: true,
        },
      }),
      getExa().search(EXA_LINKED_QUERY(resortName, country), {
        type: 'auto',
        numResults: EXA_LINKED_NUM_RESULTS,
        useAutoprompt: true,
        startPublishedDate: publishedAfter,
        contents: {
          text: { maxCharacters: EXA_MAX_CHARS },
          highlights: true,
        },
      }),
    ])

  const seenUrls = new Set<string>()
  const allResults = [
    ...sourcedResults.results,
    ...broadResults.results,
    ...travelResults.results,
    ...linkedResults.results,
  ]
  const dedupedResults = allResults.filter((r) => {
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)
    return true
  })

  const sourcedHosts = new Set(
    sourcedResults.results.map((r) => new URL(r.url).hostname)
  )
  const travelHosts = new Set(
    travelResults.results.map((r) => new URL(r.url).hostname)
  )
  const linkedHosts = new Set(
    linkedResults.results.map((r) => new URL(r.url).hostname)
  )

  const authorityRank = (r: (typeof dedupedResults)[number]): number => {
    const host = new URL(r.url).hostname
    if (sourcedHosts.has(host)) return 0
    if (travelHosts.has(host)) return 1
    if (linkedHosts.has(host)) return 2
    return 3
  }

  const parseDate = (d: string | undefined): number =>
    d ? new Date(d).getTime() : 0

  dedupedResults.sort((a, b) => {
    const aAuth = authorityRank(a)
    const bAuth = authorityRank(b)
    if (aAuth !== bAuth) return aAuth - bAuth
    return parseDate(b.publishedDate) - parseDate(a.publishedDate)
  })

  log(
    'info',
    'enrich',
    `Sourced: ${sourcedResults.results.length}, Broad: ${broadResults.results.length}, Travel: ${travelResults.results.length}, Linked: ${linkedResults.results.length}, Deduped: ${dedupedResults.length}`,
    1
  )
  for (const r of dedupedResults) {
    const tags: string[] = []
    const host = new URL(r.url).hostname
    if (sourcedHosts.has(host)) tags.push('authoritative')
    if (travelHosts.has(host)) tags.push('travel')
    if (linkedHosts.has(host)) tags.push('linked')
    if (tags.length === 0) tags.push('general')
    const dateStr = r.publishedDate ? `, dated ${r.publishedDate}` : ''
    log('info', 'enrich', `  [${tags.join('+')}${dateStr}] ${r.url}`, 2)
  }

  const sourceBlocks = dedupedResults
    .filter((r) => r.text)
    .map((r) => {
      const host = new URL(r.url).hostname
      const tags: string[] = []
      if (sourcedHosts.has(host)) tags.push('Authoritative source')
      if (travelHosts.has(host)) tags.push('Travel source')
      if (linkedHosts.has(host)) tags.push('Linked-areas source')
      if (tags.length === 0) tags.push('General source')
      const dateTag = r.publishedDate
        ? `, published ${r.publishedDate}`
        : ', undated'
      const parts = [
        `## ${r.title ?? 'Untitled'} (${tags.join(', ')}${dateTag})\nURL: ${r.url}`,
      ]
      if (r.highlights?.length) {
        parts.push(`### Key facts\n${r.highlights.join('\n')}`)
      }
      parts.push(r.text!)
      return parts.join('\n')
    })

  let sourceText = ''
  let includedCount = 0
  for (const block of sourceBlocks) {
    if (sourceText.length + block.length + 2 > MAX_SOURCE_TEXT_CHARS) break
    sourceText += (sourceText ? '\n\n' : '') + block
    includedCount++
  }

  if (!sourceText) {
    log('error', 'enrich', 'No source text found', 1)
    return null
  }

  if (includedCount < sourceBlocks.length) {
    log(
      'info',
      'enrich',
      `Including ${includedCount}/${sourceBlocks.length} sources (${sourceText.length} chars) to fit context window`,
      1
    )
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

  const messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
    thinking?: string
  }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const totalPromptChars = systemPrompt.length + userPrompt.length
  log(
    'info',
    'enrich',
    `Prompt size: ${totalPromptChars} chars (${(totalPromptChars / 1024).toFixed(1)} KB)`,
    1
  )

  const thinkingFile = path.join(THINKING_DIR, 'enrichment', `${seeded.id}.txt`)
  fs.mkdirSync(path.dirname(thinkingFile), { recursive: true })
  fs.writeFileSync(thinkingFile, '')
  log('info', 'enrich', `Thinking output: ${thinkingFile}`, 1)

  let lastContent = ''
  let lastThinking = ''
  let numPredict = 8192
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      fs.appendFileSync(
        thinkingFile,
        `\n--- Retry attempt ${attempt + 1} ---\n`
      )
    }
    log(
      'info',
      'enrich',
      attempt === 0
        ? 'Streaming LLM extraction...'
        : `Retrying LLM extraction (attempt ${attempt + 1}/${maxRetries + 1})...`,
      1
    )

    log(
      'info',
      'enrich',
      `Ollama request: model=${model}, messages=${messages.length}, user_prompt=${messages[1].content.length} chars`,
      1
    )
    const stream = await getOllama().chat({
      stream: true,
      model,
      messages,
      options: { num_ctx: 32768, num_predict: 8192 },
    })

    let content = ''
    let thinking = ''
    let doneReason: string | null = null
    let chunkCount = 0
    try {
      const streamResult = await streamThinking(
        stream,
        (chunk) => {
          content += chunk
        },
        thinkingFile
      )
      thinking = streamResult.thinking
      doneReason = streamResult.doneReason
      chunkCount = streamResult.chunkCount
    } catch (err) {
      log(
        'warn',
        'enrich',
        `Stream error: ${err instanceof Error ? err.message : String(err)}`,
        1
      )
      if (attempt < maxRetries) {
        messages.push({ role: 'user', content: LLM_RETRY_EMPTY_PROMPT })
        continue
      }
      return null
    }

    if (!content) {
      if (doneReason === 'length') {
        numPredict *= 2
        log(
          'warn',
          'enrich',
          `LLM hit token limit, increasing to ${numPredict} and retrying...`,
          1
        )
        if (attempt < maxRetries) {
          messages.push({ role: 'user', content: LLM_RETRY_EMPTY_PROMPT })
          continue
        }
        return null
      }
      log(
        'warn',
        'enrich',
        attempt < maxRetries
          ? `LLM returned empty content (${chunkCount} chunks, ${thinking.length} chars of thinking, done: ${doneReason ?? 'unknown'}), retrying...`
          : `LLM returned empty content (${chunkCount} chunks, ${thinking.length} chars of thinking, done: ${doneReason ?? 'unknown'})`,
        1
      )
      if (attempt < maxRetries) {
        messages.push({ role: 'assistant', content: '', thinking })
        messages.push({ role: 'user', content: LLM_RETRY_EMPTY_PROMPT })
        continue
      }
      return null
    }

    try {
      log('info', 'enrich', 'LLM response:', 1)
      console.log(colorizeJson(content))
    } catch {
      log('info', 'enrich', 'LLM response (raw):', 1)
      console.log(content)
    }
    log('info', 'enrich', `LLM response received (${content.length} chars)`, 1)

    const result = responseCodec.decode(content, { reportInput: true })
    if (result) {
      log('success', 'enrich', `Successfully enriched "${resortName}"`, 1)
      const defaulted = withDefaults(result)
      defaulted.websites = cleanUrls(defaulted.websites)
      return defaulted
    }

    lastContent = content
    lastThinking = thinking
    log(
      'warn',
      'enrich',
      attempt < maxRetries
        ? `Failed to parse LLM response, retrying...`
        : `Failed to parse LLM response: ${content.slice(0, 300)}`,
      1
    )
    if (attempt >= maxRetries) {
      return null
    }

    messages.push({
      role: 'assistant',
      content: lastContent,
      thinking: lastThinking,
    })
    messages.push({
      role: 'user',
      content: LLM_RETRY_PARSE_PROMPT(lastContent.slice(0, 500)),
    })
  }

  return null
}

function toEnrichedEntry(
  seededResort: SeededResort,
  data: ResolvedEnrichData
): EnrichedResort {
  return {
    id: seededResort.id,
    terrainDescription: data.terrainDescription,
    offPisteDescription: data.offPisteDescription,
    valueDescription: data.valueDescription,
    familyDescription: data.familyDescription,
    apresSkiDescription: data.apresSkiDescription,
    resortCharacterDescription: data.resortCharacterDescription,
    liftSystemDescription: data.liftSystemDescription,
    nearestAirport: data.nearestAirport,
    transferTime: data.transferTime,
    snowReliability: data.snowReliability as 'high' | 'medium' | 'low' | '',
    skiSeasonMonths: data.skiSeasonMonths,
    websites: cleanUrls([...seededResort.websites, ...data.websites]),
    linkedResortsDescription: data.linkedResortsDescription,
  }
}

const ANSI_MAGENTA = '\x1b[35m'

const FIELD_COLOURS: Record<string, string> = {
  terrainDescription: '\x1b[38;5;46m',
  offPisteDescription: '\x1b[38;5;83m',
  valueDescription: '\x1b[38;5;221m',
  familyDescription: '\x1b[38;5;117m',
  apresSkiDescription: '\x1b[38;5;213m',
  resortCharacterDescription: '\x1b[38;5;208m',
  liftSystemDescription: '\x1b[38;5;153m',
  nearestAirport: '\x1b[38;5;51m',
  transferTime: '\x1b[38;5;99m',
  snowReliability: '\x1b[38;5;196m',
  skiSeasonMonths: '\x1b[38;5;220m',
  websites: '\x1b[38;5;87m',
  linkedResortsDescription: '\x1b[38;5;178m',
}

function formatIssueTags(issues: AuditIssue[]): string {
  const tags: Array<{ label: string; colour: string }> = []
  for (const issue of issues) {
    if (issue.type === 'low-quality') {
      for (const field of issue.fields) {
        tags.push({ label: field, colour: FIELD_COLOURS[field] ?? ANSI_RESET })
      }
    } else if (issue.type === 'invalid-snow-reliability') {
      tags.push({ label: `snowReliability="${issue.value}"`, colour: ANSI_RED })
    } else {
      tags.push({ label: `transferTime=${issue.value}`, colour: ANSI_MAGENTA })
    }
  }
  return tags.map((t) => `${t.colour}${t.label}${ANSI_RESET}`).join('  ')
}

async function fixInconsistencies(options: {
  model?: string
  resort?: string
  region?: string
  maxResorts?: number
  retries?: number
}) {
  const model = options.model ?? server_get_ollama_model_audit()

  log('info', 'fix-inconsistencies', `Seeded file: ${SEEDED_PATH}`)
  log('info', 'fix-inconsistencies', `Enriched file: ${ENRICHED_PATH}`)
  log('info', 'fix-inconsistencies', `Model: ${model}`)

  const seeded = readSeeded()
  const enriched = readEnriched()
  const enrichedById = new Map(enriched.map((r) => [r.id, r]))

  const bothEnriched = seeded.filter((s) => enrichedById.has(s.id))
  let toCheck = bothEnriched

  if (options.resort) {
    toCheck = toCheck.filter((s) => s.id === options.resort)
    if (toCheck.length === 0) {
      log(
        'error',
        'fix-inconsistencies',
        `No resort with id "${options.resort}". Available: ${seeded.map((r) => r.id).join(', ')}`
      )
      process.exit(1)
    }
  } else if (options.region) {
    const before = toCheck.length
    toCheck = toCheck.filter((s) => s.region === options.region)
    if (toCheck.length === 0) {
      log(
        'error',
        'fix-inconsistencies',
        `No resorts in region "${options.region}". Available: ${[...new Set(seeded.map((r) => r.region))].sort().join(', ')}`
      )
      process.exit(1)
    }
    log(
      'info',
      'fix-inconsistencies',
      `Region filter: ${ANSI_BOLD}${options.region}${ANSI_RESET} (${before - toCheck.length} excluded, ${toCheck.length} remaining)`
    )
  }

  if (options.maxResorts != null && options.maxResorts < toCheck.length) {
    log(
      'info',
      'fix-inconsistencies',
      `--max-resorts ${options.maxResorts}: limiting from ${toCheck.length} to ${options.maxResorts}`
    )
    toCheck = toCheck.slice(0, options.maxResorts)
  }

  log(
    'info',
    'fix-inconsistencies',
    `Checking ${toCheck.length} resort(s) for inconsistencies`
  )

  const maxRetries = options.retries ?? 1
  const responseCodec = jsonCodec(consistencySchema)
  let totalFixed = 0
  let totalSkipped = 0
  let totalInconsistenciesFound = 0

  for (let i = 0; i < toCheck.length; i++) {
    const s = toCheck[i]
    const e = enrichedById.get(s.id)!
    const m = mergeEnrichedIntoSeeded(s, e)

    const description = buildDescription(e)
    if (!description || description.trim().length < 50) {
      log(
        'warn',
        'fix-inconsistencies',
        `[${i + 1}/${toCheck.length}] Skipping ${s.resortName} - insufficient description text`,
        1
      )
      totalSkipped++
      continue
    }

    log(
      'info',
      'fix-inconsistencies',
      `[${i + 1}/${toCheck.length}] Checking ${s.resortName} (${s.country})...`
    )

    const thinkingFile = path.join(THINKING_DIR, 'audit', `${s.id}.txt`)
    fs.mkdirSync(path.dirname(thinkingFile), { recursive: true })
    fs.writeFileSync(thinkingFile, '')
    log('info', 'fix-inconsistencies', `Thinking output: ${thinkingFile}`, 1)

    const fields: Record<string, number | null> = {}
    for (const field of CONSISTENCY_FIELDS) {
      fields[field] = m[field as keyof SeededResort] as number
    }

    const userPrompt = CONSISTENCY_USER_PROMPT(
      s.resortName,
      s.country,
      description,
      fields,
      JSON.stringify(buildConsistencyJsonSchema(), null, 2)
    )

    const messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
      thinking?: string
    }> = [
      { role: 'system', content: CONSISTENCY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]

    let result: z.infer<typeof consistencySchema> | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        fs.appendFileSync(
          thinkingFile,
          `\n--- Retry attempt ${attempt + 1} ---\n`
        )
        log(
          'info',
          'fix-inconsistencies',
          `Retry ${attempt}/${maxRetries} for ${s.resortName}`,
          1
        )
      }

      const stream = await getOllama().chat({
        stream: true,
        model,
        messages,
        options: { num_ctx: 16384, num_predict: 4096 },
      })

      let content = ''
      let thinking = ''
      try {
        const streamResult = await streamThinking(
          stream,
          (chunk) => {
            content += chunk
          },
          thinkingFile
        )
        thinking = streamResult.thinking
      } catch (err) {
        log(
          'warn',
          'fix-inconsistencies',
          `Stream error: ${err instanceof Error ? err.message : String(err)}`,
          1
        )
        continue
      }

      if (!content) {
        log(
          'warn',
          'fix-inconsistencies',
          `Empty response for ${s.resortName}`,
          1
        )
        messages.push({ role: 'user', content: LLM_RETRY_EMPTY_PROMPT })
        continue
      }

      let parsed: z.infer<typeof consistencySchema> | null = null
      try {
        parsed = responseCodec.decode(content, { reportInput: true })
      } catch (err) {
        log(
          'warn',
          'fix-inconsistencies',
          `Schema validation error for ${s.resortName}: ${err instanceof Error ? err.message : String(err)}`,
          1
        )
      }
      if (parsed) {
        result = parsed
        break
      }

      messages.push({ role: 'assistant', content, thinking })
      messages.push({
        role: 'user',
        content: LLM_RETRY_PARSE_PROMPT(content.slice(0, 500)),
      })
    }

    if (!result) {
      log(
        'warn',
        'fix-inconsistencies',
        `Failed to parse response for ${s.resortName}, skipping.`,
        1
      )
      totalSkipped++
      continue
    }

    const validInconsistencies = filterValidInconsistencies(result)

    if (validInconsistencies.length === 0) {
      if (result.inconsistencies.length > 0) {
        log(
          'warn',
          'fix-inconsistencies',
          `LLM returned ${result.inconsistencies.length} inconsistency(ies) but none had valid correctedValue/reason for ${s.resortName}`,
          1
        )
      } else {
        log(
          'success',
          'fix-inconsistencies',
          `No inconsistencies found for ${s.resortName}`,
          1
        )
      }
      continue
    }

    totalInconsistenciesFound += validInconsistencies.length
    log(
      'warn',
      'fix-inconsistencies',
      `Found ${validInconsistencies.length} inconsistency(ies) for ${s.resortName}:`,
      1
    )

    const updatedFields: string[] = []
    for (const inc of validInconsistencies) {
      const fieldName = inc.field
      const correctedValue = inc.correctedValue
      log(
        'info',
        'fix-inconsistencies',
        `  ${ANSI_RED}${fieldName}${ANSI_RESET}: ${fields[fieldName] ?? 'N/A'} → ${ANSI_GREEN}${correctedValue}${ANSI_RESET} (${ANSI_DIM}${inc.reason}${ANSI_RESET})`,
        2
      )

      ;(e as unknown as Record<string, unknown>)[fieldName] = correctedValue
      updatedFields.push(fieldName)
    }

    enrichedById.set(s.id, e)
    writeJsonl(
      ENRICHED_PATH,
      [...enrichedById.values()].sort((a, b) => a.id.localeCompare(b.id))
    )

    totalFixed++
    log(
      'success',
      'fix-inconsistencies',
      `Updated ${s.resortName}: ${updatedFields.join(', ')}`,
      1
    )
  }

  console.log()
  console.log(
    `${ANSI_BOLD}Consistency check complete${ANSI_RESET}: ${toCheck.length} checked, ${totalInconsistenciesFound} inconsistencies found, ${totalFixed} resorts updated, ${totalSkipped} skipped`
  )
}

function audit(options: { detail?: boolean }) {
  const seeded = readSeeded()
  const enriched = readEnriched()

  const result = auditEnrichedData(seeded, enriched)

  if (result.seededCount === 0) {
    console.log(
      `${ANSI_YELLOW}${ANSI_BOLD}No seeded resorts found.${ANSI_RESET} Run seed first.`
    )
    return
  }

  console.log()
  console.log(
    `${ANSI_DIM}Seeded resorts${ANSI_RESET}          ${ANSI_BOLD}${result.seededCount}${ANSI_RESET}`
  )
  console.log(
    `${ANSI_DIM}Enriched resorts${ANSI_RESET}        ${ANSI_BOLD}${result.enrichedCount}${ANSI_RESET}`
  )
  console.log(
    `${ANSI_DIM}Coverage${ANSI_RESET}                ${ANSI_BOLD}${result.coveragePct}%${ANSI_RESET}`
  )
  console.log(
    `${ANSI_DIM}Orphaned entries${ANSI_RESET}        ${ANSI_BOLD}${result.orphans.length}${ANSI_RESET}`
  )
  console.log(
    `${ANSI_DIM}Duplicate seeded IDs${ANSI_RESET}    ${ANSI_BOLD}${result.duplicateSeededIds.length}${ANSI_RESET}`
  )
  console.log(
    `${ANSI_DIM}Duplicate enriched IDs${ANSI_RESET}  ${ANSI_BOLD}${result.duplicateEnrichedIds.length}${ANSI_RESET}`
  )
  console.log(
    `${ANSI_DIM}Resorts with problems${ANSI_RESET}   ${ANSI_BOLD}${result.enrichedProblems.length}${ANSI_RESET}`
  )

  const totalIssues =
    result.orphans.length +
    result.duplicateSeededIds.length +
    result.duplicateEnrichedIds.length +
    result.enrichedProblems.length

  if (totalIssues === 0) {
    console.log()
    console.log(`${ANSI_GREEN}${ANSI_BOLD}No problems found${ANSI_RESET}`)
    return
  }

  console.log()
  console.log(
    `${ANSI_YELLOW}${ANSI_BOLD}${totalIssues} total issue(s)${ANSI_RESET}`
  )

  if (result.enrichedProblems.length > 0) {
    console.log()
    if (options.detail) {
      for (const { id, resortName, issues } of result.enrichedProblems) {
        console.log(
          `${ANSI_BOLD}${resortName}${ANSI_RESET} ${ANSI_DIM}${id}${ANSI_RESET}`
        )
        console.log(`  ${formatIssueTags(issues)}`)
        console.log()
      }
    } else {
      const show = result.enrichedProblems.slice(0, 10)
      for (const { resortName, id } of show) {
        console.log(
          `  ${ANSI_BOLD}${resortName}${ANSI_RESET} ${ANSI_DIM}(${id})${ANSI_RESET}`
        )
      }
      if (result.enrichedProblems.length > 10) {
        console.log(
          `  ${ANSI_DIM}... and ${result.enrichedProblems.length - 10} more (use --detail to see all)${ANSI_RESET}`
        )
      }
    }
  }
}

type EnrichMode = 'new' | 'fill' | 'all'

async function enrich(options: {
  model?: string
  maxResorts?: number
  retries?: number
  fill?: boolean
  all?: boolean
  resort?: string
  region?: string
  auditModel?: string
  auditRetries?: number
  freshness?: number
}) {
  const model = options.model ?? server_get_ollama_model_enrich()
  let mode: EnrichMode = 'new'
  if (options.all && options.fill) {
    log('error', 'enrich', 'Cannot use --fill and --all together. Pick one.')
    process.exit(1)
  }
  if (options.all) mode = 'all'
  else if (options.fill) mode = 'fill'

  log('info', 'enrich', `Seeded file: ${SEEDED_PATH}`)
  log('info', 'enrich', `Enriched file: ${ENRICHED_PATH}`)

  const seeded = readSeeded()
  if (seeded.length === 0) {
    log(
      'error',
      'enrich',
      `No seeded resorts found in ${SEEDED_PATH}. Run seed first.`
    )
    process.exit(1)
  }

  if (!fs.existsSync(ENRICHED_PATH)) {
    log('info', 'enrich', `Enriched file not found, creating: ${ENRICHED_PATH}`)
    writeJsonl(ENRICHED_PATH, [])
  }

  const existingEnriched = readEnriched()
  const enrichedById = new Map(existingEnriched.map((r) => [r.id, r]))

  const seededIds = new Set(seeded.map((r) => r.id))
  const staleEnriched = existingEnriched.filter((r) => !seededIds.has(r.id))
  if (staleEnriched.length > 0) {
    log(
      'info',
      'enrich',
      `Removing ${staleEnriched.length} enriched resort(s) no longer in seeded data: ${staleEnriched.map((r) => r.id).join(', ')}`
    )
    for (const r of staleEnriched) {
      enrichedById.delete(r.id)
    }
    writeJsonl(
      ENRICHED_PATH,
      [...enrichedById.values()].sort((a, b) => a.id.localeCompare(b.id))
    )
  }

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
    `Found ${toEnrich.length} resort(s) to enrich (out of ${seeded.length} total, ${enrichedById.size} already enriched)`
  )
  log('info', 'enrich', `Model: ${model}`)

  const maxRetries = options.retries ?? 2
  log('info', 'enrich', `Retries: ${maxRetries}`)

  const freshnessYear = options.freshness ?? DEFAULT_FRESHNESS_YEAR
  log('info', 'enrich', `Freshness: sources published >= ${freshnessYear}`)

  let enrichedCount = 0
  let skipped = 0

  const maxResorts = options.maxResorts
  if (maxResorts != null && maxResorts < toEnrich.length) {
    log(
      'info',
      'enrich',
      `--max-resorts ${maxResorts}: limiting from ${toEnrich.length} to ${maxResorts} resort(s)`
    )
    toEnrich = toEnrich.slice(0, maxResorts)
  }

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
      seededResort,
      maxRetries,
      freshnessYear
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

    let enrichedEntry: EnrichedResort
    if (reEnrichMode && existing && mode === 'fill') {
      const merged = mergeEnriched(existing, result, seededResort)
      const lowFields = listLowQualityFields(existing)
      log('info', 'enrich', `Filled fields: ${lowFields.join(', ')}`, 1)
      enrichedEntry = merged
    } else {
      enrichedEntry = toEnrichedEntry(seededResort, result)
    }
    enrichedById.set(seededResort.id, enrichedEntry)
    enrichedCount++
    writeJsonl(
      ENRICHED_PATH,
      [...enrichedById.values()].sort((a, b) => a.id.localeCompare(b.id))
    )
    log(
      'success',
      'enrich',
      `Written ${seededResort.resortName} to enriched.jsonl`,
      1
    )
  }

  log(
    'success',
    'enrich',
    `Done. Enriched: ${enrichedCount}, Skipped: ${skipped}, Total: ${toEnrich.length}`
  )

  console.log()
  log('info', 'enrich', 'Running consistency check...')
  await fixInconsistencies({
    model: options.auditModel,
    resort: options.resort,
    region: options.region,
    maxResorts: options.maxResorts,
    retries: options.auditRetries,
  })
}

function computeSearchText(
  seeded: SeededResort,
  enriched: EnrichedResort | undefined
): string {
  const parts = [
    seeded.resortName,
    seeded.country,
    seeded.region,
    enriched?.terrainDescription ?? '',
    enriched?.offPisteDescription ?? '',
    enriched?.valueDescription ?? '',
    enriched?.familyDescription ?? '',
    enriched?.apresSkiDescription ?? '',
    enriched?.resortCharacterDescription ?? '',
    enriched?.liftSystemDescription ?? '',
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
  log('info', 'encode', `Seeded file: ${SEEDED_PATH}`)
  log('info', 'encode', `Enriched file: ${ENRICHED_PATH}`)
  log('info', 'encode', `Encoded file: ${ENCODED_PATH}`)

  const seeded = readSeeded()
  if (seeded.length === 0) {
    log(
      'error',
      'encode',
      `No seeded resorts found in ${SEEDED_PATH}. Run seed first.`
    )
    process.exit(1)
  }

  const enriched = readEnriched()
  const enrichedById = new Map(enriched.map((r) => [r.id, r]))

  const existingEncoded = readEncoded()
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
      `Skipping ${notEnriched.length} seeded resort(s) without enriched data`
    )
  }

  const MODEL_ID = 'Xenova/multi-qa-MiniLM-L6-cos-v1'

  const toEncode: Array<{
    seeded: SeededResort
    enriched: EnrichedResort
    searchText: string
  }> = []
  let skipped = 0

  for (const s of seeded) {
    const e = enrichedById.get(s.id)
    if (!e) continue

    const searchText = computeSearchText(s, e)
    const hash = simpleHash(searchText)
    const existing = encodedById.get(s.id)

    if (existing && existing.searchText === hash) {
      skipped++
      continue
    }

    toEncode.push({ seeded: s, enriched: e, searchText })
  }

  if (skipped > 0) {
    log('info', 'encode', `Skipping ${skipped} resort(s) (unchanged)`, 1)
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
  writeJsonl(ENCODED_PATH, allEncoded)

  log(
    'success',
    'encode',
    `Encoded ${encoded} resort(s). Total: ${allEncoded.length}`
  )
  log('success', 'encode', `Written to ${ENCODED_PATH}`)
}

function cleanParagraph(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function buildDescription(e: EnrichedResort): string {
  const paragraphs = [
    e.terrainDescription,
    e.offPisteDescription,
    e.valueDescription,
    e.familyDescription,
    e.apresSkiDescription,
    e.resortCharacterDescription,
    e.liftSystemDescription,
  ]
    .filter((p): p is string => !!p)
    .map(cleanParagraph)
    .filter((p) => p.length > 0)
  return paragraphs.join('\n\n')
}

function build() {
  const outputPath = path.resolve(RESORTS_DIR, 'all.jsonl')

  log('info', 'build', 'Building resort data file...')
  log('info', 'build', `Seeded file: ${SEEDED_PATH}`)
  log('info', 'build', `Enriched file: ${ENRICHED_PATH}`)
  log('info', 'build', `Encoded file: ${ENCODED_PATH}`)
  log('info', 'build', `Output file: ${outputPath}`)

  const seeded = readSeeded()
  const enriched = readEnriched()
  const encoded = readEncoded()

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
      const m = mergeEnrichedIntoSeeded(s, e)

      return {
        id: m.id,
        resortName: m.resortName,
        country: m.country,
        region: m.region,
        description: buildDescription(e),
        latitude: m.latitude,
        longitude: m.longitude,
        summitAltitude: m.summitAltitude,
        baseAltitude: m.baseAltitude,
        nearestAirport: e.nearestAirport,
        transferTime: e.transferTime,
        pisteKm: m.pisteKm,
        liftCount: m.liftCount,
        beginnerPct: m.beginnerPct,
        intermediatePct: m.intermediatePct,
        advancedPct: m.advancedPct,
        snowReliability: e.snowReliability,
        skiSeasonMonths: e.skiSeasonMonths,
        websites: cleanUrls([...m.websites, ...e.websites]),
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
  const PB_URL = server_get_public_pocketbase_url()
  const PB_ADMIN_EMAIL = server_get_pocketbase_admin_email()
  const PB_ADMIN_PASSWORD = server_get_pocketbase_admin_password()
  const resolved = path.resolve(RESORTS_DIR, 'all.jsonl')
  try {
    await fs.promises.stat(resolved)
  } catch {
    log('error', 'upload', `File '${resolved}' does not exist.`)
    process.exit(1)
  }

  if (PB_URL.includes('localhost')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  const pb = new PocketBase(PB_URL)
  await pb
    .collection('_superusers')
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
  log('info', 'upload', 'Authenticated as superuser')

  const existing = await pb.collection('resorts').getFullList()
  for (const record of existing) {
    await pb.collection('resorts').delete(record.id)
    log('info', 'upload', `Deleted existing record: ${record.id}`, 1)
  }

  log('info', 'upload', `Uploading resort data from '${resolved}'...`)
  const fileBuffer = await fs.promises.readFile(resolved)
  const file = new File([fileBuffer], 'resort-data.jsonl')
  await pb.collection('resorts').create({ file })
  log('success', 'upload', 'Upload complete!')
}

async function seed(options: { dryRun?: boolean; minPisteLength?: number }) {
  const dataDir = path.resolve(RESORTS_DIR)
  const dryRun = options.dryRun ?? false
  const minPisteKm = options.minPisteLength ?? 5

  log('info', 'seed', `Loading OpenSkiMap data from: ${dataDir}`)

  const resorts = await loadOpenSkiMapData(dataDir, { minPisteKm })

  log(
    'success',
    'seed',
    `Found ${resorts.length} resorts matching criteria (operating, downhill, named, >=${minPisteKm}km piste, has non-surface lift)`
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
      `Dry run complete. Would write ${seededResorts.length} resort(s) to ${SEEDED_PATH}`
    )
    return
  }

  writeJsonl(SEEDED_PATH, seededResorts)
  log(
    'success',
    'seed',
    `Wrote ${seededResorts.length} resort(s) to ${SEEDED_PATH}`
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
  .option(
    '--min-piste-length <km>',
    'Minimum piste length in km (default: 5)',
    parseFloat
  )
  .action(seed)

program
  .command('enrich')
  .description(
    'Enrich seeded resorts with detailed data using LLM and Exa search'
  )
  .option(
    '--model <model>',
    'LLM model to use (default: deepseek-v4-flash or OLLAMA_MODEL_ENRICH env var)'
  )
  .option('--max-resorts <n>', 'Maximum number of resorts to enrich', parseInt)
  .option(
    '--retries <n>',
    'Maximum number of LLM retries on empty or malformed response (default: 2)',
    parseInt
  )
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
  .option(
    '--audit-model <model>',
    'LLM model to use for consistency check (default: kimi-k2.6 or OLLAMA_MODEL_AUDIT env var)'
  )
  .option(
    '--audit-retries <n>',
    'Maximum number of LLM retries for consistency check (default: 1)',
    parseInt
  )
  .option(
    '--freshness <year>',
    `Only use Exa sources published in or after this year (default: ${DEFAULT_FRESHNESS_YEAR})`,
    parseInt
  )
  .action(enrich)

program
  .command('audit')
  .description('Summarise enriched data and list problems')
  .option('--detail', 'Show per-resort quality issue details')
  .action((options: { detail?: boolean }) => {
    audit({ detail: options.detail })
  })

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
  .description('Upload resort data to PocketBase (overwrites existing record)')
  .action(uploadResorts)

program
  .command('deploy')
  .description('Encode, build, and upload resort data in one step')
  .action(async () => {
    await encode()
    build()
    await uploadResorts()
  })

program.parse()
