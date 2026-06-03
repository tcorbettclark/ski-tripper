#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import { aiJsonSafeParse } from 'ai-json-safe-parse'
import { Command } from 'commander'
import Exa, { type DeepObjectOutputSchema } from 'exa-js'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'
import { cleanUrls } from './clean-urls'

interface SeededResort {
  id: string
  resortName: string
  country: string
  region: string
}

interface EnrichedResort {
  id: string
  description: string
  latitude: string
  longitude: string
  summitAltitude: number
  baseAltitude: number
  nearestAirport: string
  transferTime: string
  pisteKm: number
  beginnerPct: number
  intermediatePct: number
  advancedPct: number
  liftCount: number
  snowReliability: 'high' | 'medium' | 'low' | ''
  skiSeasonMonths: string
  websites: string[]
  linkedResortsDescription: string
}

const SEEDED_PATH = path.join(process.cwd(), 'resorts', 'seeded.jsonl')
const ENRICHED_PATH = path.join(process.cwd(), 'resorts', 'enriched.jsonl')

const OLLAMA_HOST = 'https://ollama.com'
const DEFAULT_MODEL = 'kimi-k2.6:cloud'
const EXA_SOURCED_NUM_RESULTS = 4
const EXA_BROAD_NUM_RESULTS = 4
const EXA_MAX_CHARS = 8000 as const

const SOURCE_WEBSITES = [
  'skiresort.info',
  'onthesnow.com',
  'snow-forecast.com',
  'skimuggle.com',
  'piste-map.com',
  'weski.com',
  'en.wikipedia.org',
] as const

const EXA_SEARCH_QUERY = (resortName: string, country: string) =>
  `Official website and ski area information for ${resortName} ski resort in ${country}, including piste difficulty breakdown, lift status, altitude, nearest airport, transfer time, and resort facilities`

const EXA_COORDS_QUERY = (resortName: string, country: string) =>
  `Location and geographic coordinates of ${resortName} ski resort in ${country}`

const COORDS_SCHEMA: DeepObjectOutputSchema = {
  type: 'object',
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

const LLM_SYSTEM_PROMPT = `You are a ski resort data extractor. Given source text from web searches, extract factual data about the ski resort into a JSON object matching this schema:

{SCHEMA}

Rules:
- Extract only information that is explicitly stated in the source text
- Prefer data from "Authoritative source" sections over "General source" sections when values conflict
- If a value is not found in the text, set it to null — never fabricate data or guess specific numbers
- For altitude, the summitAltitude must be HIGHER than the baseAltitude
- For piste percentages (beginnerPct, intermediatePct, advancedPct), use the first reasonable estimate from the source text. Don't deliberate or reconsider — pick and move on
- Return valid JSON only, no explanatory text`

const LLM_USER_PROMPT = (
  resortName: string,
  country: string,
  sourceText: string
) =>
  `Extract ski resort data for "${resortName}" in ${country} from the following source text:

${sourceText}`

const ANSI_RESET = '\x1b[0m'
const ANSI_DIM = '\x1b[2m'
const ANSI_BOLD = '\x1b[1m'
const ANSI_CYAN = '\x1b[36m'
const ANSI_GREEN = '\x1b[32m'
const ANSI_YELLOW = '\x1b[33m'
const ANSI_RED = '\x1b[31m'

type LogLevel = 'info' | 'success' | 'warn' | 'error'

const LEVEL_STYLES: Record<LogLevel, { color: string; prefix: string }> = {
  info: { color: ANSI_CYAN, prefix: 'i' },
  success: { color: ANSI_GREEN, prefix: '\u2713' },
  warn: { color: ANSI_YELLOW, prefix: '!' },
  error: { color: ANSI_RED, prefix: '\u2717' },
}

function log(level: LogLevel, tag: string, message: string, indent = 0): void {
  const { color, prefix } = LEVEL_STYLES[level]
  const pad = '  '.repeat(indent)
  const tagStr = `${ANSI_BOLD}[${tag}]${ANSI_RESET}`
  const prefixStr = `${color}${prefix}${ANSI_RESET}`
  const output = `${pad}${prefixStr} ${tagStr} ${message}`
  if (level === 'error') {
    console.error(output)
  } else {
    console.log(output)
  }
}

function logSummary(label: string, value: string, indent = 0) {
  const pad = '  '.repeat(indent)
  console.log(
    `${pad}${ANSI_DIM}${label.padEnd(24)}${ANSI_RESET} ${ANSI_BOLD}${value}${ANSI_RESET}`
  )
}

const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
})

const exa = new Exa(process.env.EXA_API_KEY as string)

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
      'All URLs of websites with information about skiing at the resort, e.g. ["https://www.zermatt.ch/en/skiing"]. Include every relevant URL found in the source text; do not attempt to consolidate or deduplicate.'
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

function normalisePistePercentages(
  data: ResolvedEnrichData
): ResolvedEnrichData {
  const b = data.beginnerPct
  const i = data.intermediatePct
  const a = data.advancedPct
  const total = b + i + a
  if (total === 0) return data

  const ub = (b / total) * 100
  const ui = (i / total) * 100
  const ua = (a / total) * 100

  const round5 = (n: number) => Math.round(n / 5) * 5
  const rb = round5(ub)
  const ri = round5(ui)
  const ra = round5(ua)

  if (rb + ri + ra === 100) {
    return { ...data, beginnerPct: rb, intermediatePct: ri, advancedPct: ra }
  }

  return {
    ...data,
    beginnerPct: Math.round(ub),
    intermediatePct: Math.round(ui),
    advancedPct: Math.round(ua),
  }
}

interface Coordinates {
  latitude: string
  longitude: string
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
        includeDomains: [...SOURCE_WEBSITES],
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

function jsonCodec<T extends z.core.$ZodType>(schema: T) {
  return z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      const parsed = aiJsonSafeParse<Record<string, unknown>>(jsonString)
      if (parsed === null) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: 'Failed to extract valid JSON from LLM response',
        })
        return z.NEVER as never
      }
      return parsed as never
    },
    encode: (value) => JSON.stringify(value),
  })
}

function buildJsonSchema(): JSONSchema.JSONSchema {
  const nullable = (
    schema: JSONSchema.JSONSchema & { description?: string },
    desc: string
  ): JSONSchema.JSONSchema => ({
    anyOf: [schema, { type: 'null' }],
    description: `${desc}, or null if not found`,
  })

  return {
    type: 'object',
    properties: {
      description: nullable(
        { type: 'string' },
        'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights'
      ),
      summitAltitude: nullable(
        { type: 'integer' },
        'Summit altitude in metres above sea level'
      ),
      baseAltitude: nullable(
        { type: 'integer' },
        'Base altitude in metres above sea level'
      ),
      nearestAirport: nullable(
        { type: 'string' },
        'IATA code of the nearest airport, e.g. "GVA"'
      ),
      transferTime: nullable(
        { type: 'string' },
        'Transfer time from airport, e.g. "2h 00m"'
      ),
      pisteKm: nullable(
        { type: 'integer' },
        'Total groomed piste length in kilometres'
      ),
      beginnerPct: nullable(
        { type: 'integer' },
        'Approximate percentage of beginner (blue) piste, e.g. 25'
      ),
      intermediatePct: nullable(
        { type: 'integer' },
        'Approximate percentage of intermediate (red) piste, e.g. 50'
      ),
      advancedPct: nullable(
        { type: 'integer' },
        'Approximate percentage of advanced (black) piste, e.g. 25'
      ),
      liftCount: nullable({ type: 'integer' }, 'Number of ski lifts'),
      snowReliability: nullable(
        {
          type: 'string',
          enum: ['high', 'medium', 'low'],
        },
        'Snow reliability rating (high/medium/low)'
      ),
      skiSeasonMonths: nullable(
        { type: 'string' },
        'Typical ski season, e.g. "Dec-Apr"'
      ),
      websites: nullable(
        {
          type: 'array',
          items: { type: 'string' },
        },
        'All URLs of websites with information about skiing at the resort. Include every relevant URL found in the source text; do not attempt to consolidate or deduplicate.'
      ),
      linkedResortsDescription: nullable(
        { type: 'string' },
        'One sentence describing nearby linked resorts, e.g. "Part of the 3 Vallées ski area, linked to Méribel and Courchevel by lift."'
      ),
    },
    required: [],
  }
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
      includeDomains: [...SOURCE_WEBSITES],
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
  let thinking = ''
  let isThinking = true
  for await (const chunk of stream) {
    const thinkPart = (chunk.message as unknown as Record<string, unknown>)
      .thinking
    if (typeof thinkPart === 'string' && thinkPart) {
      thinking += thinkPart
      process.stdout.write(`${ANSI_DIM}${thinkPart}${ANSI_RESET}`)
    }
    if (chunk.message.content) {
      if (isThinking) {
        isThinking = false
        console.log()
        log('info', 'enrich', `Model thought for ${thinking.length} chars`, 1)
      }
      content += chunk.message.content
    }
  }
  if (isThinking && !content) {
    console.log()
    log('error', 'enrich', 'LLM returned empty content after thinking', 1)
    return null
  }
  try {
    console.log(JSON.stringify(JSON.parse(content), null, 2))
  } catch {
    console.log(content)
  }
  if (!content) {
    log('error', 'enrich', 'LLM returned empty content after thinking', 1)
    return null
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

function readSeededJsonl(): SeededResort[] {
  if (!fs.existsSync(SEEDED_PATH)) return []
  const lines = fs
    .readFileSync(SEEDED_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  return lines.map((line) => JSON.parse(line) as SeededResort)
}

function readEnrichedJsonl(): EnrichedResort[] {
  if (!fs.existsSync(ENRICHED_PATH)) return []
  const lines = fs
    .readFileSync(ENRICHED_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  return lines.map((line) => JSON.parse(line) as EnrichedResort)
}

function writeEnrichedJsonl(resorts: EnrichedResort[]): void {
  fs.mkdirSync(path.dirname(ENRICHED_PATH), { recursive: true })
  const content = `${resorts.map((r) => JSON.stringify(r)).join('\n')}\n`
  fs.writeFileSync(ENRICHED_PATH, content, 'utf-8')
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

async function enrich(options: { model?: string; autoAccept?: boolean }) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL

  const seeded = readSeededJsonl()
  if (seeded.length === 0) {
    log(
      'error',
      'enrich',
      `No seeded resorts found in ${SEEDED_PATH}. Run seed-resorts first.`
    )
    process.exit(1)
  }

  const existingEnriched = readEnrichedJsonl()
  const enrichedById = new Map(existingEnriched.map((r) => [r.id, r]))

  const toEnrich = seeded.filter((r) => !enrichedById.has(r.id))

  if (toEnrich.length === 0) {
    log(
      'success',
      'enrich',
      'All seeded resorts are already enriched. Nothing to do.'
    )
    return
  }

  log(
    'info',
    'enrich',
    `Found ${toEnrich.length} resort(s) to enrich (out of ${seeded.length} total, ${existingEnriched.length} already enriched)`
  )
  log('info', 'enrich', `Model: ${model}`)

  let enriched = 0
  let skipped = 0
  let autoAccept = options.autoAccept ?? false

  for (let i = 0; i < toEnrich.length; i++) {
    const seededResort = toEnrich[i]
    log(
      'info',
      'enrich',
      `[${i + 1}/${toEnrich.length}] Enriching ${seededResort.resortName} (${seededResort.country})...`
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
      const enrichedEntry: EnrichedResort = {
        id: seededResort.id,
        description: confirmed.data.description,
        latitude: confirmed.coords?.latitude ?? '',
        longitude: confirmed.coords?.longitude ?? '',
        summitAltitude: confirmed.data.summitAltitude,
        baseAltitude: confirmed.data.baseAltitude,
        nearestAirport: confirmed.data.nearestAirport,
        transferTime: confirmed.data.transferTime,
        pisteKm: confirmed.data.pisteKm,
        beginnerPct: confirmed.data.beginnerPct,
        intermediatePct: confirmed.data.intermediatePct,
        advancedPct: confirmed.data.advancedPct,
        liftCount: confirmed.data.liftCount,
        snowReliability: confirmed.data.snowReliability as
          | 'high'
          | 'medium'
          | 'low'
          | '',
        skiSeasonMonths: confirmed.data.skiSeasonMonths,
        websites: confirmed.data.websites,
        linkedResortsDescription: confirmed.data.linkedResortsDescription,
      }
      enrichedById.set(seededResort.id, enrichedEntry)
      enriched++
      log(
        'success',
        'enrich',
        `Written ${seededResort.resortName} to enriched.jsonl`,
        1
      )

      writeEnrichedJsonl(
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
    `Done. Enriched: ${enriched}, Skipped: ${skipped}, Total: ${toEnrich.length}`
  )
}

async function enrichStandalone(options: {
  model?: string
  resort?: string
  region?: string
  country?: string
  output?: string
}) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL

  if (!options.resort) {
    log('error', 'enrich', '--resort is required for standalone mode')
    process.exit(1)
  }

  const resortName = options.resort
  const country = options.country ?? options.region ?? ''
  log(
    'info',
    'enrich',
    `Mode: ${ANSI_BOLD}standalone${ANSI_RESET} (no file writes)`
  )
  log(
    'info',
    'enrich',
    `Resort: "${resortName}", Country: "${country}"${options.region ? `, Region: "${options.region}"` : ''}`
  )
  log('info', 'enrich', `Model: ${model}`)

  const result = await enrichResort(resortName, country, model)
  if (!result) {
    log('error', 'enrich', `Failed to enrich "${resortName}".`)
    process.exit(1)
  }

  if (options.output) {
    const outputData = {
      resortName,
      country,
      region: options.region,
      latitude: result.coords?.latitude ?? '',
      longitude: result.coords?.longitude ?? '',
      ...result.data,
    }
    await Bun.write(options.output, JSON.stringify(outputData, null, 2))
    log(
      'success',
      'enrich',
      `Written ${JSON.stringify(outputData).length} bytes to ${options.output}`
    )
  } else {
    displayEnrichedData(
      resortName,
      country,
      options.region ?? '',
      result.data,
      result.coords
    )
  }

  log('success', 'enrich', 'Done.')
}

const program = new Command()

program
  .name('enrich-resorts')
  .description('Enrich ski resorts with detailed data using LLM and Exa search')
  .version('1.0.0')
  .option(
    '--model <model>',
    'LLM model to use (default: kimi-k2.6:cloud or OLLAMA_MODEL env var)'
  )
  .option('--resort <name>', 'Resort name for standalone mode (no file writes)')
  .option(
    '--region <region>',
    'Region for standalone mode (used as country if --country not set)'
  )
  .option(
    '--country <country>',
    'Country for standalone mode (overrides --region as country)'
  )
  .option(
    '--output <path>',
    'Write enriched JSON to a file instead of stdout (standalone mode only)'
  )
  .option('--auto-accept', 'Auto-accept all enriched data without prompting')
  .action((options) => {
    if (options.resort) {
      enrichStandalone(options)
    } else {
      enrich(options)
    }
  })

program.parse()
