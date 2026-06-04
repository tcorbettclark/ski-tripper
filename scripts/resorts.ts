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
import { REGIONS } from '../src/regions'
import { cleanUrls } from './lib/clean-urls'
import { readJsonl, simpleHash, writeJsonl } from './lib/jsonl'
import {
  buildJsonSchema,
  DEFAULT_MODEL,
  ENRICH_SOURCE_WEBSITES,
  exa,
  jsonCodec,
  LLM_SYSTEM_PROMPT,
  LLM_USER_PROMPT,
  ollama,
  SOURCE_WEBSITES,
  streamThinking,
  WEB_SEARCH_TOOL_DEFINITION,
} from './lib/llm'
import { ANSI_BOLD, ANSI_DIM, ANSI_RESET, log, logSummary } from './lib/log'
import { normalisePistePercentages as normalisePercentages } from './lib/normalisePistePercentages'
import type { EncodedResort, EnrichedResort, SeededResort } from './lib/types'

function slugify(name: string, region: string, country: string): string {
  const parts = [name, region, country]
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

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
const EXA_MAX_CHARS = 8000 as const
const EXA_SEARCH_QUERY = (resortName: string, country: string) =>
  `Official website and ski area information for ${resortName} ski resort in ${country}, including piste difficulty breakdown, lift status, altitude, nearest airport, transfer time, and resort facilities`

const EXA_COORDS_QUERY = (resortName: string, country: string) =>
  `Location and geographic coordinates of ${resortName} ski resort in ${country}`

const COORDS_SCHEMA = {
  type: 'object' as const,
  properties: {
    latitude: {
      type: 'string',
      description: 'Latitude as a string, e.g. "46.0939"',
    },
    longitude: {
      type: 'string',
      description: 'Longitude as a string, e.g. "7.0765"',
    },
  },
  required: ['latitude', 'longitude'],
}

const LLM_CANDIDATE_SYSTEM_PROMPT = (jsonSchema: object) =>
  `You are a ski resort expert. Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only include real ski resorts. Be accurate about which country each resort is in. Use the web_search tool to look up any information you are not completely certain about.`

const LLM_CANDIDATE_USER_PROMPT = (
  region: string,
  sources?: readonly string[],
  existingResorts?: readonly string[]
) => {
  const excludeClause =
    existingResorts && existingResorts.length > 0
      ? ` Do NOT include any of these already-listed resorts: ${existingResorts.join(', ')}.`
      : ''
  return `List all the ski resorts you can find in the "${region}" region, from major well-known resorts to smaller lesser-known ones. Do not throw any resorts away. By repeated requests I am aiming for an exhaustive list of resorts. Include the resort name and the country it is in.${sources ? ` Use the web_search tool to consult these sites for comprehensive resort lists: ${sources.join(', ')}.` : ''}${excludeClause} Return results as JSON without any introductory text.`
}

const LLM_DEDUPE_SYSTEM_PROMPT = (jsonSchema: object) =>
  `Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only flag clear duplicates where the same resort has a different spelling or name variant.`

const LLM_DEDUPE_USER_PROMPT = (
  existingNames: string[],
  candidateNames: string[]
) =>
  `Given these existing ski resorts in the database:
${existingNames.join(', ')}

And these candidate resorts to add:
${candidateNames.join(', ')}

Which candidates are duplicates of existing resorts? Consider alternate spellings, abbreviations, and common name variations (e.g., "St. Anton" = "Sankt Anton", "Val d'Isere" = "Val d'Isère"). Only flag clear duplicates, not merely resorts in the same area. Only return valid JSON.`

const CANDIDATE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    resorts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          resortName: {
            type: 'string',
            description: 'The commonly known name of the ski resort',
          },
          country: {
            type: 'string',
            description: 'The country where the resort is located',
          },
        },
        required: ['resortName', 'country'],
      },
    },
  },
  required: ['resorts'],
}

const DEDUPE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidate: {
            type: 'string',
            description:
              'The resortName from the candidates list that is a duplicate',
          },
          reason: {
            type: 'string',
            description: 'Brief explanation of why it is a duplicate',
          },
        },
        required: ['candidate', 'reason'],
      },
    },
  },
  required: ['duplicates'],
}

const MODEL_ID = 'Xenova/multi-qa-MiniLM-L6-cos-v1'

const LLM_MAX_RETRIES = 3
const LLM_MAX_TOOL_ROUNDS = 5
const EXA_NUM_RESULTS = 3
const EXA_HIGHLIGHT_CHARS = 500

const candidateSchema = z.object({
  resorts: z.array(
    z.object({
      resortName: z
        .string()
        .describe('The commonly known name of the ski resort'),
      country: z.string().describe('The country where the resort is located'),
    })
  ),
})

type Candidate = z.infer<typeof candidateSchema>['resorts'][number]

const enrichSchema = z.object({
  description: z
    .string()
    .nullable()
    .describe(
      'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights'
    ),
  summitAltitude: z.coerce
    .number()
    .int()
    .nullable()
    .describe('Summit altitude in metres above sea level'),
  baseAltitude: z.coerce
    .number()
    .int()
    .nullable()
    .describe('Base altitude in metres above sea level'),
  nearestAirport: z
    .string()
    .nullable()
    .describe('IATA code of the nearest airport, e.g. "GVA"'),
  transferTime: z
    .string()
    .nullable()
    .describe('Transfer time from airport, e.g. "2h 00m"'),
  pisteKm: z.coerce
    .number()
    .int()
    .nullable()
    .describe('Total groomed piste length in kilometres'),
  beginnerPct: z.coerce
    .number()
    .int()
    .nullable()
    .describe('Approximate percentage of beginner (blue) piste, e.g. 25'),
  intermediatePct: z.coerce
    .number()
    .int()
    .nullable()
    .describe('Approximate percentage of intermediate (red) piste, e.g. 50'),
  advancedPct: z.coerce
    .number()
    .int()
    .nullable()
    .describe('Approximate percentage of advanced (black) piste, e.g. 25'),
  liftCount: z.coerce.number().int().nullable().describe('Number of ski lifts'),
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

const enrichDefaults: Record<string, string | number | string[]> = {
  description: '',
  summitAltitude: 0,
  baseAltitude: 0,
  nearestAirport: '',
  transferTime: '',
  pisteKm: 0,
  beginnerPct: 0,
  intermediatePct: 0,
  advancedPct: 0,
  liftCount: 0,
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

function isLowQualityValue(
  key: keyof EnrichData,
  value: string | number | string[] | null
): boolean {
  if (value === null) return true
  if (value === enrichDefaults[key]) return true
  if (typeof value === 'number' && value <= 0) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function hasLowQualityFields(entry: EnrichedResort): boolean {
  const fields = Object.keys(enrichDefaults) as (keyof EnrichData)[]
  for (const key of fields) {
    if (
      key in entry &&
      isLowQualityValue(key, entry[key] as string | number | string[] | null)
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
      isLowQualityValue(key, entry[key] as string | number | string[] | null)
    ) {
      result.push(key)
    }
  }
  return result
}

function mergeEnriched(
  existing: EnrichedResort,
  newData: ResolvedEnrichData,
  coords: Coordinates | null
): EnrichedResort {
  const merged = { ...existing }
  const fields = Object.keys(enrichDefaults) as (keyof EnrichData)[]
  for (const key of fields) {
    const oldValue = existing[key] as string | number | string[] | null
    const isOldLow = isLowQualityValue(key, oldValue)
    if (isOldLow) {
      ;(merged[key] as (typeof newData)[typeof key]) = newData[key]
    }
  }
  if (coords) {
    if (!existing.latitude || existing.latitude.trim() === '') {
      merged.latitude = coords.latitude
    }
    if (!existing.longitude || existing.longitude.trim() === '') {
      merged.longitude = coords.longitude
    }
  }
  return merged
}

function normalisePistePercentages(
  data: ResolvedEnrichData
): ResolvedEnrichData {
  const { beginnerPct, intermediatePct, advancedPct } = normalisePercentages(
    data.beginnerPct,
    data.intermediatePct,
    data.advancedPct
  )
  return { ...data, beginnerPct, intermediatePct, advancedPct }
}

interface Coordinates {
  latitude: string
  longitude: string
}

async function executeWebSearch(
  query: string,
  exclude?: readonly string[],
  includeDomains?: readonly string[]
): Promise<string> {
  const excludeClause =
    exclude && exclude.length > 0 ? ` -${exclude.slice(0, 20).join(' -')}` : ''
  const fullQuery = `${query}${excludeClause}`
  log('info', 'exa', `Searching for: "${fullQuery}"`, 1)
  const results = await exa.search(query, {
    type: 'auto',
    numResults: EXA_NUM_RESULTS,
    useAutoprompt: true,
    includeDomains: includeDomains ? [...includeDomains] : undefined,
    contents: {
      text: { maxCharacters: 10000 },
      highlights: { maxCharacters: EXA_HIGHLIGHT_CHARS },
    },
  })

  if (includeDomains) {
    const domains = [
      ...new Set(results.results.map((r) => new URL(r.url).hostname)),
    ]
    log('info', 'exa', `Domains used: ${domains.join(', ')}`, 1)
    for (const r of results.results) {
      log('info', 'exa', `  ${r.url}`, 2)
    }
  }

  const snippets = results.results
    .filter((r) => r.text || r.highlights)
    .map((r) => {
      const parts: string[] = []
      if (r.title) parts.push(`Title: ${r.title}`)
      if (r.text) parts.push(r.text)
      if (r.highlights) parts.push(r.highlights.join(' ... '))
      return parts.join('\n')
    })

  log('success', 'exa', `Got ${results.results.length} result(s)`, 1)
  return snippets.join('\n\n---\n\n')
}

async function callLLM(
  prompt: string,
  model: string,
  maxRetries = LLM_MAX_RETRIES,
  exclude?: readonly string[],
  includeDomains?: readonly string[]
): Promise<Candidate[]> {
  log('info', 'llm', `Calling model ${model} (max ${maxRetries} retries)...`)
  log('info', 'llm', `Prompt: ${prompt.slice(0, 200)}...`, 1)
  const responseCodec = jsonCodec(candidateSchema)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('info', 'llm', `Attempt ${attempt}/${maxRetries}`, 1)
      const messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool'
        content: string
        tool_name?: string
      }> = [
        {
          role: 'system',
          content: LLM_CANDIDATE_SYSTEM_PROMPT(CANDIDATE_JSON_SCHEMA),
        },
        { role: 'user', content: prompt },
      ]

      let finalContent = ''

      for (let round = 0; round < LLM_MAX_TOOL_ROUNDS; round++) {
        log('info', 'llm', `Tool round ${round + 1}/${LLM_MAX_TOOL_ROUNDS}`, 2)
        const stream = await ollama.chat({
          stream: true,
          model,
          messages,
          tools: [WEB_SEARCH_TOOL_DEFINITION],
        })

        let content = ''
        let thinking = ''
        let isThinking = true
        const toolCalls: Array<{
          name: string
          arguments: Record<string, unknown>
        }> = []

        for await (const chunk of stream) {
          const thinkPart = (
            chunk.message as unknown as Record<string, unknown>
          ).thinking
          if (typeof thinkPart === 'string' && thinkPart) {
            thinking += thinkPart
            process.stdout.write(`${ANSI_DIM}${thinkPart}${ANSI_RESET}`)
          }
          if (chunk.message.content) {
            if (isThinking) {
              isThinking = false
              console.log()
              log(
                'info',
                'llm',
                `Model thought for ${thinking.length} chars`,
                2
              )
            }
            content += chunk.message.content
          }
          if (chunk.message.tool_calls) {
            for (const tc of chunk.message.tool_calls) {
              toolCalls.push({
                name: tc.function.name,
                arguments: tc.function.arguments as Record<string, unknown>,
              })
            }
          }
        }
        console.log()

        if (toolCalls.length > 0) {
          log(
            'info',
            'llm',
            `LLM requested ${toolCalls.length} tool call(s)`,
            2
          )
          messages.push({
            role: 'assistant',
            content,
          })

          for (const tc of toolCalls) {
            const fnArgs = tc.arguments as { query?: string }

            if (tc.name === 'web_search' && fnArgs.query) {
              const searchResult = await executeWebSearch(
                fnArgs.query,
                exclude,
                includeDomains
              )
              messages.push({
                role: 'tool',
                content: searchResult,
                tool_name: tc.name,
              })
            }
          }

          continue
        }

        finalContent = content
        log(
          'info',
          'llm',
          `LLM returned final response (${finalContent.length} chars)`,
          2
        )
        break
      }

      if (!finalContent) {
        log(
          'error',
          'llm',
          'No final content received after tool call rounds',
          2
        )
        throw new Error('LLM returned empty response after tool calls')
      }

      const result = responseCodec.decode(finalContent, {
        reportInput: true,
      })

      if (!result) {
        log(
          'error',
          'llm',
          `Attempt ${attempt}: failed to parse LLM response as JSON. Full response:`,
          2
        )
        log('error', 'llm', finalContent, 2)
        throw new Error('LLM returned empty or invalid response')
      }

      log(
        'success',
        'llm',
        `Successfully parsed ${result.resorts.length} candidate(s)`,
        1
      )
      return result.resorts
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(
        'error',
        'llm',
        `Attempt ${attempt}/${maxRetries} failed: ${message}`,
        1
      )
      if (attempt === maxRetries) {
        log('error', 'llm', 'Max retries reached, skipping this batch.')
        return []
      }
    }
  }

  return []
}

async function deduplicateWithLLM(
  candidates: Candidate[],
  existingNames: string[],
  model: string
): Promise<Candidate[]> {
  log(
    'info',
    'dedup',
    `Deduplicating ${candidates.length} candidates against ${existingNames.length} existing resorts`
  )
  if (existingNames.length === 0 || candidates.length === 0) {
    log(
      'info',
      'dedup',
      'Skipping deduplication (no existing resorts or no candidates)',
      1
    )
    return candidates
  }

  const existingLower = new Set(existingNames.map((n) => n.toLowerCase()))

  const afterExact = candidates.filter((c) => {
    if (existingLower.has(c.resortName.toLowerCase())) {
      log('info', 'dedup', `Exact duplicate removed: ${c.resortName}`, 1)
      return false
    }
    return true
  })

  log(
    'success',
    'dedup',
    `After exact dedup: ${afterExact.length} remain (removed ${candidates.length - afterExact.length})`,
    1
  )

  if (afterExact.length === 0) {
    log('warn', 'dedup', 'No candidates remain after exact dedup', 1)
    return afterExact
  }

  const dedupeSchema = z.object({
    duplicates: z.array(
      z.object({
        candidate: z.string(),
        reason: z.string(),
      })
    ),
  })

  const dedupeCodec = jsonCodec(dedupeSchema)

  const prompt = LLM_DEDUPE_USER_PROMPT(
    existingNames,
    afterExact.map((c) => c.resortName)
  )

  log('info', 'dedup', 'Calling LLM for fuzzy deduplication...', 1)
  try {
    const stream = await ollama.chat({
      stream: true,
      model,
      messages: [
        {
          role: 'system',
          content: LLM_DEDUPE_SYSTEM_PROMPT(DEDUPE_JSON_SCHEMA),
        },
        { role: 'user', content: prompt },
      ],
    })

    let content = ''
    await streamThinking(stream, (chunk) => {
      content += chunk
    })
    console.log()

    const result = dedupeCodec.decode(content, {
      reportInput: true,
    })

    if (!result) {
      log(
        'warn',
        'dedup',
        'Failed to parse dedup response as JSON. Full response:',
        1
      )
      log('warn', 'dedup', content, 1)
      return afterExact
    }

    const duplicateNames = new Set(result.duplicates.map((d) => d.candidate))
    const kept = afterExact.filter((c) => !duplicateNames.has(c.resortName))
    const removed = afterExact.filter((c) => duplicateNames.has(c.resortName))

    if (removed.length > 0) {
      log(
        'info',
        'dedup',
        `LLM identified ${removed.length} fuzzy duplicate(s):`,
        1
      )
      for (const d of result.duplicates) {
        log('info', 'dedup', `${d.candidate}: ${d.reason}`, 2)
      }
    }

    log(
      'success',
      'dedup',
      `After fuzzy dedup: ${kept.length} candidates remain`,
      1
    )
    return kept
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(
      'error',
      'dedup',
      `Deduplication LLM call failed: ${message}. Keeping all candidates.`,
      1
    )
    return afterExact
  }
}

async function confirmWithUser(candidates: Candidate[]): Promise<Candidate[]> {
  if (candidates.length === 0) {
    log('warn', 'seed', 'No candidates to review.')
    return []
  }

  console.log()
  console.log(`  ${ANSI_BOLD}Proposed resorts to add:${ANSI_RESET}`)
  for (const [i, c] of candidates.entries()) {
    console.log(
      `  \x1b[36m${i + 1}.\x1b[0m ${ANSI_BOLD}${c.resortName}${ANSI_RESET} ${ANSI_DIM}(${c.country})${ANSI_RESET}`
    )
  }
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('  Accept all? (y/n/remove): ')
    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'y' || trimmed === '') {
      return candidates
    }

    if (trimmed === 'n') {
      return []
    }

    const indicesToRemove = new Set<number>()
    const parts = trimmed.split(/[\s,]+/).filter(Boolean)
    for (const part of parts) {
      const idx = Number.parseInt(part, 10) - 1
      if (idx >= 0 && idx < candidates.length) {
        indicesToRemove.add(idx)
      }
    }

    return candidates.filter((_, i) => !indicesToRemove.has(i))
  } finally {
    rl.close()
  }
}

async function seed(options: {
  region: string
  batches: string
  model?: string
  dryRun?: boolean
  sources?: boolean
  seeded: string
}) {
  const region = options.region
  const batches = Number.parseInt(options.batches, 10)
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
  const sources = options.sources ? SOURCE_WEBSITES : undefined
  const includeDomains = options.sources ? SOURCE_WEBSITES : undefined
  const seededPath = path.resolve(options.seeded)

  log('info', 'seed', `Seeded file: ${seededPath}`)

  if (!REGIONS.includes(region as (typeof REGIONS)[number])) {
    log(
      'error',
      'seed',
      `Unknown region "${region}". Valid regions:\n${REGIONS.map((r) => `  - ${r}`).join('\n')}`
    )
    process.exit(1)
  }

  if (Number.isNaN(batches) || batches < 1) {
    log(
      'error',
      'seed',
      `Invalid batches "${options.batches}". Must be a positive integer.`
    )
    process.exit(1)
  }

  const dryRun = options.dryRun ?? false

  const existingSeeded = readJsonl<SeededResort>(seededPath)
  const existingSlugs = new Set(existingSeeded.map((r) => r.id))
  const existingNames = existingSeeded.map((r) => r.resortName)

  if (dryRun) {
    log(
      'info',
      'seed',
      `${ANSI_BOLD}Dry run mode${ANSI_RESET} (no file writes)`
    )
  }

  log('info', 'seed', `Seeding resorts for region: ${region}`)
  log(
    'info',
    'seed',
    `Up to ${batches} batch(es) (model: ${model}), stopping early if no new resorts found`,
    1
  )
  if (includeDomains) {
    log('info', 'seed', `Sources: ${includeDomains.join(', ')}`, 1)
  }

  log(
    'info',
    'seed',
    `Existing seeded resorts: ${existingSeeded.length} (${seededPath})`,
    1
  )

  const allCandidates: Candidate[] = []
  const seenCandidateNames = new Set<string>()

  for (let i = 0; i < batches; i++) {
    log(
      'info',
      'seed',
      `Batch ${i + 1}/${batches} (have ${allCandidates.length} unique so far)`,
      1
    )

    const existingResortNames = allCandidates.map((c) => c.resortName)
    const prompt = LLM_CANDIDATE_USER_PROMPT(
      region,
      sources,
      existingResortNames
    )
    const batchCandidates = await callLLM(
      prompt,
      model,
      LLM_MAX_RETRIES,
      existingResortNames,
      includeDomains
    )

    if (batchCandidates.length === 0) {
      log(
        'warn',
        'seed',
        `Batch ${i + 1} returned no candidates, stopping early.`,
        1
      )
      break
    }

    const prevCount = allCandidates.length
    for (const c of batchCandidates) {
      const key = c.resortName.toLowerCase()
      if (!seenCandidateNames.has(key)) {
        seenCandidateNames.add(key)
        allCandidates.push(c)
      }
    }
    const added = allCandidates.length - prevCount
    const dupes = batchCandidates.length - added
    log(
      'success',
      'seed',
      `Batch ${i + 1}: ${batchCandidates.length} found, ${dupes} duplicate(s), ${added} new (${allCandidates.length} unique total)`,
      1
    )

    if (added === 0) {
      log('warn', 'seed', 'No new resorts found, stopping early.', 1)
      break
    }
  }

  if (allCandidates.length === 0) {
    log('error', 'seed', 'No candidates returned from any batch. Aborting.')
    process.exit(1)
  }

  console.log()
  log(
    'success',
    'seed',
    `All batches complete. ${allCandidates.length} unique candidate(s):`
  )
  for (const c of allCandidates) {
    log('info', 'seed', `${c.resortName} (${c.country})`, 1)
  }

  const allExistingNames = [
    ...existingNames,
    ...existingSeeded.map((r) => r.resortName),
  ]
  const afterDedup = await deduplicateWithLLM(
    allCandidates,
    allExistingNames,
    model
  )
  log(
    'success',
    'seed',
    `After deduplication: ${afterDedup.length} candidate(s)`
  )

  const confirmed = dryRun ? afterDedup : await confirmWithUser(afterDedup)
  if (confirmed.length === 0) {
    log('warn', 'seed', 'No resorts confirmed. Aborting.')
    process.exit(0)
  }

  const newSeeded: SeededResort[] = confirmed.map((c) => {
    const id = slugify(c.resortName, region, c.country)
    return {
      id,
      resortName: c.resortName,
      country: c.country,
      region,
    }
  })

  const duplicateIds = newSeeded.filter((r) => existingSlugs.has(r.id))
  if (duplicateIds.length > 0) {
    log(
      'error',
      'seed',
      `Duplicate slug IDs generated: ${duplicateIds.map((r) => r.id).join(', ')}`
    )
    process.exit(1)
  }

  const allSeeded = [...existingSeeded, ...newSeeded]

  console.log()
  if (dryRun) {
    log(
      'info',
      'seed',
      `${newSeeded.length} resort(s) would be written to ${seededPath}:`
    )
    for (const r of newSeeded) {
      log('info', 'seed', `${r.resortName} (${r.country}) [id=${r.id}]`, 1)
    }
    log('success', 'seed', 'Dry run complete. No files written.')
  } else {
    writeJsonl(seededPath, allSeeded)
    log(
      'success',
      'seed',
      `Wrote ${newSeeded.length} new resort(s) to ${seededPath} (total: ${allSeeded.length})`
    )
  }
}

async function fetchCoordinates(
  resortName: string,
  country: string
): Promise<Coordinates | null> {
  log('info', 'enrich', 'Fetching coordinates from Exa...', 1)
  try {
    const [sourcedResponse, broadResponse] = await Promise.all([
      exa.search(EXA_COORDS_QUERY(resortName, country), {
        type: 'deep-lite',
        numResults: 3,
        useAutoprompt: true,
        includeDomains: [...ENRICH_SOURCE_WEBSITES],
        contents: { text: { maxCharacters: 2000 } },
        outputSchema: COORDS_SCHEMA,
      }),
      exa.search(EXA_COORDS_QUERY(resortName, country), {
        type: 'deep-lite',
        numResults: 3,
        useAutoprompt: true,
        contents: { text: { maxCharacters: 2000 } },
        outputSchema: COORDS_SCHEMA,
      }),
    ])

    const output = (sourcedResponse.output?.content ??
      broadResponse.output?.content) as
      | { latitude: string; longitude: string }
      | undefined
    if (output?.latitude && output?.longitude) {
      log(
        'success',
        'enrich',
        `Coordinates: ${output.latitude}, ${output.longitude}`,
        1
      )
      return { latitude: output.latitude, longitude: output.longitude }
    }
  } catch (err) {
    log('warn', 'enrich', `Deep search for coordinates failed: ${err}`, 1)
  }

  log('warn', 'enrich', 'No coordinates found, falling back to text search', 1)
  try {
    const results = await exa.search(EXA_COORDS_QUERY(resortName, country), {
      type: 'auto',
      numResults: 3,
      useAutoprompt: true,
      contents: {
        text: { maxCharacters: 2000 },
        highlights: {
          query: 'latitude longitude coordinates',
          maxCharacters: 1000,
        },
      },
    })

    const coordRegex = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/
    for (const result of results.results) {
      const textToSearch = [
        ...(result.highlights ?? []),
        result.text ?? '',
      ].join(' ')
      const match = textToSearch.match(coordRegex)
      if (match) {
        log(
          'success',
          'enrich',
          `Coordinates (from text): ${match[1]}, ${match[2]}`,
          1
        )
        return { latitude: match[1], longitude: match[2] }
      }
    }
  } catch (err) {
    log('warn', 'enrich', `Fallback coordinate search failed: ${err}`, 1)
  }

  log('error', 'enrich', 'Could not determine coordinates', 1)
  return null
}

async function enrichResort(
  resortName: string,
  country: string,
  model: string
): Promise<{ data: ResolvedEnrichData; coords: Coordinates | null } | null> {
  const responseCodec = jsonCodec(enrichSchema)

  log('info', 'enrich', `Enriching "${resortName}" via Exa+LLM`)

  const coords = await fetchCoordinates(resortName, country)

  log('info', 'enrich', 'Fetching source text from Exa...', 1)
  const [sourcedResults, broadResults] = await Promise.all([
    exa.search(EXA_SEARCH_QUERY(resortName, country), {
      type: 'auto',
      numResults: EXA_SOURCED_NUM_RESULTS,
      useAutoprompt: true,
      includeDomains: [...ENRICH_SOURCE_WEBSITES],
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
    exa.search(EXA_SEARCH_QUERY(resortName, country), {
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

  const userPrompt = LLM_USER_PROMPT(resortName, country, sourceText)

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
  const normalised = normalisePistePercentages(defaulted)
  if (
    normalised.beginnerPct !== result.beginnerPct ||
    normalised.intermediatePct !== result.intermediatePct ||
    normalised.advancedPct !== result.advancedPct
  ) {
    log(
      'info',
      'enrich',
      `Normalised piste %: ${result.beginnerPct}/${result.intermediatePct}/${result.advancedPct} -> ${normalised.beginnerPct}/${normalised.intermediatePct}/${normalised.advancedPct}`,
      1
    )
  }
  return { data: normalised, coords }
}

function displayEnrichedData(
  resortName: string,
  country: string,
  region: string,
  data: ResolvedEnrichData,
  coords: Coordinates | null
) {
  console.log()
  const location = region ? `${country}, ${region}` : country
  console.log(
    `  ${ANSI_BOLD}${resortName}${ANSI_RESET} ${ANSI_DIM}(${location})${ANSI_RESET}`
  )
  console.log()
  const coordsStr = coords
    ? `${coords.latitude}, ${coords.longitude}`
    : 'unknown'
  logSummary('Coordinates', coordsStr, 2)
  logSummary('Altitude', `${data.baseAltitude}m - ${data.summitAltitude}m`, 2)
  logSummary(
    'Airport',
    data.nearestAirport
      ? `${data.nearestAirport} (${data.transferTime})`
      : 'unknown',
    2
  )
  logSummary('Piste', `${data.pisteKm} km`, 2)
  logSummary('Beginner', `${data.beginnerPct}%`, 2)
  logSummary('Intermediate', `${data.intermediatePct}%`, 2)
  logSummary('Advanced', `${data.advancedPct}%`, 2)
  logSummary('Lifts', `${data.liftCount}`, 2)
  logSummary('Snow', data.snowReliability, 2)
  logSummary('Season', data.skiSeasonMonths, 2)
  logSummary('Websites', data.websites.join(', '), 2)
  logSummary('Linked Resorts', data.linkedResortsDescription, 2)
  logSummary('Description', `${data.description.slice(0, 100)}...`, 2)
}

async function confirmEnrichedData(
  resortName: string,
  country: string,
  region: string,
  data: ResolvedEnrichData,
  coords: Coordinates | null,
  autoAccept: boolean
): Promise<{
  accepted: boolean
  data: ResolvedEnrichData
  coords: Coordinates | null
  autoAcceptRest: boolean
}> {
  if (autoAccept) {
    return { accepted: true, data, coords, autoAcceptRest: true }
  }

  displayEnrichedData(resortName, country, region, data, coords)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('\n  Accept? (y/modify/auto/skip/quit): ')
    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'y' || trimmed === '') {
      return { accepted: true, data, coords, autoAcceptRest: false }
    }

    if (trimmed === 'auto') {
      log('info', 'enrich', 'Auto-accepting all remaining resorts.', 1)
      return { accepted: true, data, coords, autoAcceptRest: true }
    }

    if (trimmed === 'skip') {
      return { accepted: false, data, coords, autoAcceptRest: false }
    }

    if (trimmed === 'quit') {
      log('warn', 'enrich', 'Stopping enrichment.', 1)
      return { accepted: false, data, coords, autoAcceptRest: false }
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

      return { accepted: true, data: modified, coords, autoAcceptRest: false }
    }

    return { accepted: true, data, coords, autoAcceptRest: false }
  } finally {
    rl.close()
  }
}

function toEnrichedEntry(
  seededResort: SeededResort,
  data: ResolvedEnrichData,
  coords: Coordinates | null
): EnrichedResort {
  return {
    id: seededResort.id,
    description: data.description,
    latitude: coords?.latitude ?? '',
    longitude: coords?.longitude ?? '',
    summitAltitude: data.summitAltitude,
    baseAltitude: data.baseAltitude,
    nearestAirport: data.nearestAirport,
    transferTime: data.transferTime,
    pisteKm: data.pisteKm,
    beginnerPct: data.beginnerPct,
    intermediatePct: data.intermediatePct,
    advancedPct: data.advancedPct,
    liftCount: data.liftCount,
    snowReliability: data.snowReliability as 'high' | 'medium' | 'low' | '',
    skiSeasonMonths: data.skiSeasonMonths,
    websites: data.websites,
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
  seeded: string
  enriched: string
}) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
  const seededPath = path.resolve(options.seeded)
  const enrichedPath = path.resolve(options.enriched)
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
      model
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
      result.data,
      result.coords,
      autoAccept
    )
    autoAccept = confirmed.autoAcceptRest

    if (confirmed.accepted) {
      let enrichedEntry: EnrichedResort
      if (reEnrichMode && existing && mode === 'fill') {
        const merged = mergeEnriched(existing, confirmed.data, confirmed.coords)
        const lowFields = listLowQualityFields(existing)
        log('info', 'enrich', `Filled fields: ${lowFields.join(', ')}`, 1)
        enrichedEntry = merged
      } else {
        enrichedEntry = toEnrichedEntry(
          seededResort,
          confirmed.data,
          confirmed.coords
        )
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

async function encode(options: {
  seeded: string
  enriched: string
  encoded: string
}) {
  const seededPath = path.resolve(options.seeded)
  const enrichedPath = path.resolve(options.enriched)
  const encodedPath = path.resolve(options.encoded)

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

function build(options: {
  seeded: string
  enriched: string
  encoded: string
  output: string
}) {
  const seededPath = path.resolve(options.seeded)
  const enrichedPath = path.resolve(options.enriched)
  const encodedPath = path.resolve(options.encoded)
  const outputPath = path.resolve(options.output)

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
        latitude: e.latitude,
        longitude: e.longitude,
        summitAltitude: e.summitAltitude,
        baseAltitude: e.baseAltitude,
        nearestAirport: e.nearestAirport,
        transferTime: e.transferTime,
        pisteKm: e.pisteKm,
        beginnerPct: e.beginnerPct,
        intermediatePct: e.intermediatePct,
        advancedPct: e.advancedPct,
        liftCount: e.liftCount,
        snowReliability: e.snowReliability,
        skiSeasonMonths: e.skiSeasonMonths,
        websites: e.websites,
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

async function uploadResorts(filePath: string) {
  const resolved = path.resolve(filePath)
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
    'Seed ski resorts into a seeded JSONL file using LLM-generated candidates'
  )
  .requiredOption(
    '--region <region>',
    'Region name (must match a value from src/regions.ts)'
  )
  .requiredOption(
    '--batches <number>',
    'Maximum number of LLM batch calls (stops early if no new resorts found)'
  )
  .requiredOption('--seeded <path>', 'Path to seeded JSONL file')
  .option(
    '--model <model>',
    'LLM model to use (default: kimi-k2.6:cloud or OLLAMA_MODEL env var)'
  )
  .option(
    '--dry-run',
    'Run interactively without reading from or writing to any files'
  )
  .option(
    '--sources',
    'Include source website recommendations in the LLM prompt to guide web search'
  )
  .action(seed)

program
  .command('enrich')
  .description(
    'Enrich seeded resorts with detailed data using LLM and Exa search'
  )
  .requiredOption('--seeded <path>', 'Path to seeded JSONL file')
  .requiredOption('--enriched <path>', 'Path to enriched JSONL file')
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
  .requiredOption('--seeded <path>', 'Path to seeded JSONL file')
  .requiredOption('--enriched <path>', 'Path to enriched JSONL file')
  .requiredOption('--encoded <path>', 'Path to encoded JSONL file')
  .action(encode)

program
  .command('build')
  .description(
    'Build resort-data.jsonl from the intersection of seeded, enriched, and encoded files'
  )
  .requiredOption('--seeded <path>', 'Path to seeded JSONL file')
  .requiredOption('--enriched <path>', 'Path to enriched JSONL file')
  .requiredOption('--encoded <path>', 'Path to encoded JSONL file')
  .requiredOption('--output <path>', 'Path to output resort-data JSONL file')
  .action(build)

program
  .command('upload')
  .description(
    'Upload resort data to Appwrite Storage (overwrites existing file)'
  )
  .requiredOption('-f, --file <path>', 'path to resort-data.jsonl file')
  .action(async (options) => {
    await uploadResorts(options.file)
  })

program.parse()
